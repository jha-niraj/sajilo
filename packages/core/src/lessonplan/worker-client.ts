/**
 * How the apps hand a generation job to the worker.
 *
 * Both apps/admin and apps/main deploy to Cloudflare alongside the worker, so the preferred path is
 * the `LESSONPLAN_WORKER` service binding: the request never leaves Cloudflare, needs no shared
 * secret on the wire, and skips a DNS + TLS round trip.
 *
 * The public-URL fetch stays as a fallback for `next dev`, where there are no bindings.
 *
 * The important behavioural change is the return value. The old code did a bare `fetch` inside a
 * `try {} catch {}` that swallowed everything, so an unreachable worker looked exactly like a
 * successful queue - which is how a job sat PENDING for hours while the UI said "queued". This
 * reports truthfully, and the caller decides what to tell the user.
 */

/** Minimal shape of a Cloudflare service binding - avoids depending on workers types in Next apps. */
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

export async function pokeLessonPlanWorker(opts: {
    jobId: string;
    binding?: WorkerBinding | null;
    workerUrl?: string | null;
    workerSecret?: string | null;
}): Promise<PokeResult> {
    await refuseWhileViewing();
    const body = JSON.stringify({ jobId: opts.jobId });

    if (opts.binding) {
        try {
            const res = await opts.binding.fetch(new Request('https://worker/api/lessonplan/generate/start', {
                method: 'POST',
                // The secret goes over the binding too. The worker is reachable at a public URL as
                // well, so it cannot treat "arrived via a binding" as proof of anything - that
                // would just be a header, and headers are attacker-controlled.
                headers: {
                    'Content-Type': 'application/json',
                    ...(opts.workerSecret ? { 'X-Worker-Secret': opts.workerSecret } : {}),
                },
                body,
            }));
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
        const res = await fetch(`${opts.workerUrl}/api/lessonplan/generate/start`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(opts.workerSecret ? { 'X-Worker-Secret': opts.workerSecret } : {}),
            },
            body,
        });
        if (res.ok) return { delivered: true, via: 'http' };
        return { delivered: false, via: 'http', reason: `worker responded ${res.status}` };
    } catch (err) {
        return { delivered: false, via: 'http', reason: err instanceof Error ? err.message : String(err) };
    }
}
