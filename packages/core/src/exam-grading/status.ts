/**
 * The live status of an online exam, derived from its window rather than from a column.
 *
 * ## Why this exists
 *
 * `online_exams.status` used to be flipped SCHEDULED -> ACTIVE -> COMPLETED by a cron that ran
 * EVERY MINUTE. The cadence was not chosen because a minute of accuracy was needed; it was
 * chosen because the stored column is only as fresh as the last sweep, so the sweep had to be
 * relentless to stop an exam sitting SCHEDULED after its start time.
 *
 * That cost was enormous and entirely avoidable. Neon's serverless compute autosuspends after 5
 * idle minutes; a job touching the database every 60 seconds meant it never got 5 idle minutes,
 * so compute ran 24/7 - roughly 182 CU-hours a month against a 100 CU-hour allowance - to
 * discover, 1,439 times out of 1,440, that nothing had changed.
 *
 * The window is already in the row. `startTime` and `endTime` are `notNull`, so the status is a
 * pure function of them and the current time. Computing it on read is exact to the second, costs
 * nothing, and cannot be stale. The cron drops to hourly and becomes a janitor: it auto-submits
 * abandoned attempts and persists the terminal status for reporting.
 *
 * ## What this deliberately does NOT do
 *
 * Only the three time-driven states are derived. Everything else is a decision a person made,
 * and the clock must not overrule it:
 *
 *   - `DRAFT` / `READY`   - not published yet. A draft whose start time has passed is still a
 *                           draft; it is not secretly live.
 *   - `CANCELLED`         - called off. An exam cancelled mid-window must not read as ACTIVE.
 *   - `RESULTS_PUBLISHED` - downstream of COMPLETED. Deriving would walk it backwards.
 *
 * Passing any of those through unchanged is the entire safety property here, so the guard is a
 * positive allow-list of exactly the three states the cron ever wrote, not a deny-list. A status
 * added later is left alone by default rather than being silently reinterpreted by the clock.
 */

/** Every status an online exam can hold. Mirrors `apps/main/types/online-exam.ts`. */
export type OnlineExamLifecycleStatus =
    | 'DRAFT'
    | 'READY'
    | 'SCHEDULED'
    | 'ACTIVE'
    | 'COMPLETED'
    | 'RESULTS_PUBLISHED'
    | 'CANCELLED';

/**
 * The states the transitions cron used to own, and therefore the only ones safe to recompute.
 * If it is not in here, the stored value wins.
 */
const TIME_DRIVEN: ReadonlySet<string> = new Set(['SCHEDULED', 'ACTIVE', 'COMPLETED']);

/** The fields needed to place an exam on its own timeline. */
export interface OnlineExamWindow {
    status: string;
    startTime: Date | string;
    endTime: Date | string;
}

/**
 * Parse a timestamp that may arrive as a `Date` or as a string.
 *
 * The neon-http driver returns `timestamp without time zone` columns as bare strings with no
 * offset, and `new Date('2026-08-15 09:00:00')` parses those as LOCAL time. On a machine at
 * UTC+5:45 that shifts every exam window by nearly six hours - which would show a class an exam
 * as ACTIVE while it is still scheduled. Appending `Z` pins the bare form to UTC, which is what
 * the column actually stores.
 *
 * Drizzle with `mode: 'date'` normally hands us real `Date` objects, so this is a guard for the
 * paths that do not - raw SQL, a JSON round-trip through a Worker binding, a cached payload.
 */
function toTime(value: Date | string): number {
    if (value instanceof Date) return value.getTime();
    // Already carries a zone or a `T` separator with one - trust it.
    if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(value)) return Date.parse(value);
    return Date.parse(`${value.replace(' ', 'T')}Z`);
}

/**
 * The status this exam actually has right now.
 *
 * Returns the stored status untouched for any state the clock does not own, and for a row whose
 * timestamps cannot be parsed - a garbled window must never silently reclassify an exam.
 *
 * @param now Injectable for tests and for keeping one instant consistent across a list.
 */
export function deriveOnlineExamStatus<T extends OnlineExamWindow>(
    exam: T,
    now: Date = new Date(),
): OnlineExamLifecycleStatus {
    const stored = exam.status as OnlineExamLifecycleStatus;
    if (!TIME_DRIVEN.has(exam.status)) return stored;

    const start = toTime(exam.startTime);
    const end = toTime(exam.endTime);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return stored;

    const t = now.getTime();
    if (t < start) return 'SCHEDULED';
    // `>= end` closes the exam the instant its window ends, matching the cron's `endTime <= now`.
    if (t >= end) return 'COMPLETED';
    return 'ACTIVE';
}

/**
 * Replace `status` on a row with its derived value.
 *
 * Use this at the edge of a query so everything downstream - UI, filters, permission checks -
 * sees one consistent answer and nobody has to remember to call the deriver.
 */
export function withDerivedStatus<T extends OnlineExamWindow>(exam: T, now: Date = new Date()): T {
    return { ...exam, status: deriveOnlineExamStatus(exam, now) };
}

/**
 * Same, for a list. Takes ONE `now` for the whole batch so two rows on either side of a tick
 * boundary cannot disagree about what time it is.
 */
export function withDerivedStatuses<T extends OnlineExamWindow>(exams: T[], now: Date = new Date()): T[] {
    return exams.map((e) => withDerivedStatus(e, now));
}

/**
 * Translate a caller's status filter into the set of STORED statuses that could satisfy it.
 *
 * This is the part that is easy to get wrong. Once status is derived on read, a query that does
 * `WHERE status = 'ACTIVE'` is asking the wrong question: the row for a live exam may still say
 * SCHEDULED because no sweep has run since it opened. Filtering in SQL on the stored column
 * would miss exactly the exams the user is looking for.
 *
 * So a filter on a time-driven status must widen to all three stored values and then be narrowed
 * in memory by `deriveOnlineExamStatus`. Callers that filter on a non-time-driven status
 * (DRAFT, CANCELLED, ...) get that value back unchanged and can filter in SQL as before.
 */
export function storedStatusesFor(filter: string): string[] {
    return TIME_DRIVEN.has(filter) ? ['SCHEDULED', 'ACTIVE', 'COMPLETED'] : [filter];
}

/** Is this status one the clock owns? Exposed so callers can branch without re-deriving the set. */
export function isTimeDrivenStatus(status: string): boolean {
    return TIME_DRIVEN.has(status);
}
