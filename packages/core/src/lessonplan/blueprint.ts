/**
 * Lesson-blueprint generation: the shape the model must return, the parser, and the code-level
 * quality gate.
 *
 * Lives in @repo/core because TWO callers now run it and they must behave identically:
 *   - apps/worker  - the Durable Object, for "Build all units" across a whole subject
 *   - apps/admin   - a server action, for a single unit generated inline
 *
 * Duplicating it would mean the same unit produced different quality depending on which button
 * was pressed. These validators ARE the quality control here - there is no second model pass - so
 * they are the last thing that should ever fork.
 *
 * Everything here is pure: no DB, no fetch, no Node built-ins. That is what lets it run unchanged
 * inside a Cloudflare Worker and inside a Next server action.
 */

const BANNED_PHRASES = ['appreciate', 'understand deeply', 'be aware', 'explore the concept', 'familiarise', 'familiarize', 'gain an understanding', 'develop an appreciation'];
const ALWAYS_AVAILABLE = ['board', 'chalk', 'duster', 'textbook', 'notebook', 'pen', 'pencil', 'ruler', 'everyday objects'];

export interface RawLesson {
    lessonIndex?: number;
    title?: string;
    nonNegotiables?: { text?: string; why?: string; chunkId?: string }[];
    objectives?: string[];
    successCriteria?: string[];
    boardPlan?: { step?: number; content?: string }[];
    activities?: { minutes?: number; what?: string; artefact?: string; materials?: string[] }[];
    misconceptions?: { belief?: string; correction?: string; chunkId?: string }[];
    vocabulary?: { en?: string; ne?: string; definition?: string; chunkId?: string }[];
    exitCheck?: { q?: string; type?: string; answer?: string; mapsToNonNegotiableIndex?: number }[];
    homeworkDraft?: unknown;
    degradeOrder?: string[];
    nextHook?: string;
    citedChunkIds?: string[];
}


export function parseLessons(raw: string): RawLesson[] | null {
    try {
        const start = raw.indexOf('{');
        const end = raw.lastIndexOf('}');
        if (start === -1 || end === -1) return null;
        const obj = JSON.parse(raw.slice(start, end + 1)) as { lessons?: RawLesson[] };
        return Array.isArray(obj.lessons) ? obj.lessons : null;
    } catch { return null; }
}

/** Code validation + repair. The model's prose is accepted only where it passes these hard checks. */
export function validateLesson(l: RawLesson, index: number, periodMinutes: number, suppliedIds: Set<string>) {
    // Non-negotiables: keep only cited ones, clamp to 2-4, assign stable ids.
    const nn = (l.nonNegotiables ?? [])
        .filter((n) => n.text && (!n.chunkId || suppliedIds.has(n.chunkId)))
        .slice(0, 4)
        .map((n, i) => ({ id: `nn_${index}_${i}`, text: n.text!, why: n.why ?? '', chunkId: n.chunkId && suppliedIds.has(n.chunkId) ? n.chunkId : null, sourceRef: null }));

    // Objectives: drop any containing a banned phrase (untestable).
    const objectives = (l.objectives ?? []).filter((o) => o && !BANNED_PHRASES.some((b) => o.toLowerCase().includes(b))).slice(0, 3);

    // Activities: repair minutes to sum to the period length (pad/trim the last).
    let activities = (l.activities ?? []).filter((a) => a.what).map((a) => ({
        minutes: Math.max(1, Math.round(a.minutes ?? 0)),
        what: a.what!,
        artefact: a.artefact ?? null,
        materials: (a.materials ?? []).filter((m) => typeof m === 'string'),
    }));
    if (activities.length === 0) activities = [{ minutes: periodMinutes, what: 'Teach and practise from the textbook', artefact: 'textbook', materials: ALWAYS_AVAILABLE.slice(0, 3) }];
    const sum = activities.reduce((s, a) => s + a.minutes, 0);
    if (sum !== periodMinutes && activities.length > 0) {
        activities[activities.length - 1]!.minutes = Math.max(1, activities[activities.length - 1]!.minutes + (periodMinutes - sum));
    }

    // Exit check: exactly 3, mapped to a valid non-negotiable id.
    const nnIds = nn.map((n) => n.id);
    const exit = (l.exitCheck ?? []).filter((q) => q.q).slice(0, 3).map((q, i) => ({
        q: q.q!, type: (['recall', 'apply', 'stretch'].includes(q.type ?? '') ? q.type : 'recall') as string,
        answer: q.answer ?? '', mapsToNonNegotiableId: nnIds[Math.min(q.mapsToNonNegotiableIndex ?? i, Math.max(0, nnIds.length - 1))] ?? (nnIds[0] ?? 'nn_0'),
    }));
    while (exit.length < 3 && nnIds.length > 0) {
        const i = exit.length;
        exit.push({ q: `Check: ${nn[Math.min(i, nn.length - 1)]?.text ?? 'the key idea'}`, type: i === 0 ? 'recall' : i === 1 ? 'apply' : 'stretch', answer: '', mapsToNonNegotiableId: nnIds[Math.min(i, nnIds.length - 1)]! });
    }

    const boardPlan = (l.boardPlan ?? []).filter((b) => b.content).map((b, i) => ({ step: b.step ?? i + 1, content: b.content! }));
    const misconceptions = (l.misconceptions ?? []).filter((m) => m.belief && m.correction).map((m) => ({ belief: m.belief!, correction: m.correction!, chunkId: m.chunkId && suppliedIds.has(m.chunkId) ? m.chunkId : null }));
    const citedIds = (l.citedChunkIds ?? []).filter((id) => suppliedIds.has(id));
    const citations = citedIds.map((id) => ({ chunkId: id, pageStart: null, pageEnd: null }));

    // Grounding score: fraction of citable fields that actually carry a citation.
    const citableFilled = [nn.some((n) => n.chunkId), misconceptions.some((m) => m.chunkId), citedIds.length > 0].filter(Boolean).length;
    const groundingScore = citableFilled / 3;

    return {
        lessonIndex: index,
        title: l.title ?? `Lesson ${index}`,
        nonNegotiables: nn.length >= 2 ? nn : nn.concat([{ id: `nn_${index}_x`, text: l.title ?? 'Key idea of this lesson', why: '', chunkId: null, sourceRef: null }]).slice(0, Math.max(2, nn.length)),
        objectives,
        successCriteria: (l.successCriteria ?? []).slice(0, 3),
        boardPlan,
        activities,
        misconceptions,
        exitCheck: exit,
        homeworkDraft: l.homeworkDraft ?? null,
        degradeOrder: (l.degradeOrder ?? []).slice(0, 4),
        nextHook: l.nextHook,
        citations,
        groundingScore,
    };
}

// ── Prompt ───────────────────────────────────────────────────────────────────

export interface BlueprintChunk { id: string; content: string | null; pageStart: number | null; pageEnd: number | null }

const EXCERPT_CHARS = 700;

export const BLUEPRINT_SYSTEM =
    'You create lesson blueprints for a real classroom that has only a board, chalk and a textbook. '
    + 'Ground EVERYTHING in the source excerpts. Objectives must start with an action verb and name a concrete noun. '
    + 'NEVER use vague words like appreciate, understand deeply, be aware, explore, familiarise. Return ONLY valid JSON.';

/**
 * Build the user prompt for a unit.
 *
 * `lessonCount` is how many lessons to return. The inline path passes 1 and calls this once per
 * lesson so each request stays inside a server action's budget; the worker passes the unit's full
 * count so the model can see the whole arc at once and make lesson 3 build on lesson 2.
 *
 * `focusTitle` names the specific lesson when generating one at a time - without it, N independent
 * calls tend to converge on the same opening lesson.
 */
export function buildBlueprintPrompt(opts: {
    unitTitle: string;
    subject?: string;
    grade?: string;
    lessonCount: number;
    chunks: BlueprintChunk[];
    focusTitle?: string;
    focusIndex?: number;
}): string {
    const excerpts = opts.chunks.map((c) => {
        const pages = c.pageStart != null ? ` | p.${c.pageStart}${c.pageEnd != null ? '-' + c.pageEnd : ''}` : '';
        return `  [${c.id}${pages}] "${(c.content ?? '').slice(0, EXCERPT_CHARS).replace(/\s+/g, ' ').trim()}"`;
    }).join('\n');

    const context = [opts.subject, opts.grade ? `Class ${opts.grade}` : null].filter(Boolean).join(' ');
    const focus = opts.focusTitle
        ? `\nGenerate ONLY lesson ${opts.focusIndex ?? 1}: "${opts.focusTitle}". Return it as the single item in the array.`
        : '';

    return [
        `${context ? context + ' | ' : ''}UNIT: ${opts.unitTitle} | ${opts.lessonCount} lesson${opts.lessonCount === 1 ? '' : 's'} of 45 minutes each.`,
        focus,
        '', 'SOURCE EXCERPTS (the only facts you may use):', excerpts, '',
        `Return exactly ${opts.lessonCount} lesson${opts.lessonCount === 1 ? '' : 's'}. For each: lessonIndex, title, nonNegotiables (2-4 {text,why,chunkId}), objectives (2-3, action verb + concrete noun), successCriteria, boardPlan [{step,content}], activities [{minutes,what,artefact,materials}] minutes sum to 45, misconceptions, exitCheck EXACTLY 3 {q,type,answer,mapsToNonNegotiableIndex}, homeworkDraft {items:[...]}, degradeOrder, citedChunkIds (from the list only, REQUIRED).`,
        'Output JSON exactly: {"lessons":[{...}]}',
    ].join('\n');
}

// ── Cost ─────────────────────────────────────────────────────────────────────
//
// There is no fixed price here any more. `CREDITS_PER_BLUEPRINT` (2) and `blueprintCost` were retired
// 2026-10-10: a blueprint is charged on the AI meter at its real tokens (`@repo/billing/ai-meter`,
// plan/main/credits/ai-credit-metering.md), and the preview's estimate is priced by the same meter.
