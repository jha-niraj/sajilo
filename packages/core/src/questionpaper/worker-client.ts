/**
 * How apps/main hands a question-paper generation job to the worker.
 *
 * Mirrors `lessonplan/worker-client.ts` deliberately, including the part that matters most:
 * the return value is honest. A bare `fetch` in a `try {} catch {}` treats "the worker replied
 * 401" as success, because a non-2xx response does not throw. That is how the answer-sheet
 * kickoff could leave a paper QUEUED forever while the UI reported that it had started - the
 * one failure mode a background job must never have, since there is no user watching a request
 * to notice it never came back.
 *
 * Prefers the `LESSONPLAN_WORKER` service binding when present (same worker, one service):
 * the call stays inside Cloudflare and a delivery failure is a real error rather than a
 * network timeout the caller has to guess about. Falls back to the public URL for `next dev`,
 * where there are no bindings.
 */

export interface WorkerBinding { fetch: (req: Request) => Promise<Response> }

export type PokeResult =
    | { delivered: true; via: 'binding' | 'http' }
    | { delivered: false; via: 'binding' | 'http' | 'none'; reason: string };

/**
 * Support impersonation is view only (plan/admin/security/impersonation.md): no job starts while
 * Gurukul support is viewing an account. The check lives in @repo/db (not a dependency here) and is
 * published under a well-known global key (`WRITE_GUARD_GLOBAL` in packages/db/src/write-guard.ts).
 */
async function refuseWhileViewing(): Promise<void> {
    const guard = (globalThis as Record<symbol, unknown>)[Symbol.for('gurukul.db.assertWritesAllowed')];
    if (typeof guard === 'function') await (guard as () => Promise<void>)();
}

async function poke(path: string, body: string, opts: {
    binding?: WorkerBinding | null;
    workerUrl?: string | null;
    workerSecret?: string | null;
}): Promise<PokeResult> {
    await refuseWhileViewing();
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        // The secret travels over the binding too. The worker is also reachable at a public
        // URL, so "this arrived over a binding" can only ever be a claim in a header, and a
        // header is precisely what an attacker controls.
        ...(opts.workerSecret ? { 'X-Worker-Secret': opts.workerSecret } : {}),
    };

    if (opts.binding) {
        try {
            const res = await opts.binding.fetch(new Request(`https://worker${path}`, { method: 'POST', headers, body }));
            if (res.ok) return { delivered: true, via: 'binding' };
            return { delivered: false, via: 'binding', reason: `worker responded ${res.status}` };
        } catch (err) {
            return { delivered: false, via: 'binding', reason: err instanceof Error ? err.message : String(err) };
        }
    }

    if (!opts.workerUrl) {
        return { delivered: false, via: 'none', reason: 'no worker binding and no WORKER_URL configured' };
    }

    try {
        const res = await fetch(`${opts.workerUrl}${path}`, { method: 'POST', headers, body });
        if (res.ok) return { delivered: true, via: 'http' };
        return { delivered: false, via: 'http', reason: `worker responded ${res.status}` };
    } catch (err) {
        return { delivered: false, via: 'http', reason: err instanceof Error ? err.message : String(err) };
    }
}

/** Start (or resume) a bulk question generation job. */
export function pokeQuestionPaperWorker(opts: {
    jobId: string;
    binding?: WorkerBinding | null;
    workerUrl?: string | null;
    workerSecret?: string | null;
}): Promise<PokeResult> {
    return poke('/api/question-paper/generate/start', JSON.stringify({ jobId: opts.jobId }), opts);
}

/**
 * Start (or resume) a Studio quick-quiz generation.
 *
 * Lives beside the question-paper pokes because the transport is identical in every respect that
 * matters - same worker, same shared secret, same honest `PokeResult`. What differs is on the
 * other side: the quiz generator writes its questions back in CHUNKS and re-arms, so this poke
 * both STARTS a run and RESUMES a stalled one, and calling it twice is safe.
 */
export function pokeStudioQuizWorker(opts: {
    itemId: string;
    schoolId: string;
    binding?: WorkerBinding | null;
    workerUrl?: string | null;
    workerSecret?: string | null;
}): Promise<PokeResult> {
    return poke(
        '/api/studio/quiz/start',
        JSON.stringify({ itemId: opts.itemId, schoolId: opts.schoolId }),
        opts,
    );
}

/** Start (or resume) the worked-answer sheet for a paper. */
export function pokeAnswerSheetWorker(opts: {
    questionPaperId: string;
    schoolId: string;
    binding?: WorkerBinding | null;
    workerUrl?: string | null;
    workerSecret?: string | null;
}): Promise<PokeResult> {
    return poke(
        '/api/answer-sheet/start',
        JSON.stringify({ questionPaperId: opts.questionPaperId, schoolId: opts.schoolId }),
        opts,
    );
}

/**
 * Start a document-AI transcription of one scanned answer sheet.
 *
 * Lives here alongside the other pokes rather than in its own module because the transport is the
 * same in every respect that matters - same worker, same shared secret, same honest `PokeResult`.
 *
 * `sourceUrl` is a signed URL for the scan, minted by the caller. The worker has no storage
 * credentials of its own, and passing the URL is what keeps it that way.
 */
export function pokeDocAiWorker(opts: {
    sheetId: string;
    schoolId: string;
    /** Page 1. Kept as its own field so a worker deployed before multi-page still works. */
    sourceUrl: string;
    /** Every page, in order, page 1 included. Optional for the same reason. */
    sourceUrls?: string[];
    binding?: WorkerBinding | null;
    workerUrl?: string | null;
    workerSecret?: string | null;
}): Promise<PokeResult> {
    return poke(
        '/api/doc-ai/start',
        JSON.stringify({
            sheetId: opts.sheetId,
            schoolId: opts.schoolId,
            sourceUrl: opts.sourceUrl,
            sourceUrls: opts.sourceUrls ?? [opts.sourceUrl],
        }),
        opts,
    );
}

/**
 * Start (or resume) an AI writing run over a report-card batch.
 *
 * Lives beside the other pokes rather than in a `reports/` module of its own for the same reason
 * `pokeDocAiWorker` does: the transport is identical in every respect that matters - same worker,
 * same shared secret, same honest `PokeResult`. A second copy of `poke()` is a second place for the
 * "a 401 is not success" bug to come back.
 */
export function pokeReportBatchWorker(opts: {
    jobId: string;
    binding?: WorkerBinding | null;
    workerUrl?: string | null;
    workerSecret?: string | null;
}): Promise<PokeResult> {
    return poke('/api/reports/generate/start', JSON.stringify({ jobId: opts.jobId }), opts);
}

/**
 * Start indexing one Saathi document (embed its chunks into `document_chunks`).
 *
 * Beside the other pokes for the same reason they are all here: one transport, one secret, one
 * honest `PokeResult`. The caller has already written the chunks without vectors and marked the
 * document `processing`; the worker reads who pays from the document's uploader, so the body is
 * only the id - and a watchdog resume, which has no body to give, charges the same person.
 */
export function pokeDocumentIndexWorker(opts: {
    documentId: string;
    binding?: WorkerBinding | null;
    workerUrl?: string | null;
    workerSecret?: string | null;
}): Promise<PokeResult> {
    return poke('/api/documents/index/start', JSON.stringify({ documentId: opts.documentId }), opts);
}

/**
 * Start (or resume) a school data export (plan/repo/compliance/launch-readiness.md D1). Lives here
 * for the same transport as the pokes above; safe to call twice - a running export re-arms.
 */
export function pokeSchoolExportWorker(opts: {
    exportId: string;
    binding?: WorkerBinding | null;
    workerUrl?: string | null;
    workerSecret?: string | null;
}): Promise<PokeResult> {
    return poke('/api/school-export/start', JSON.stringify({ exportId: opts.exportId }), opts);
}
