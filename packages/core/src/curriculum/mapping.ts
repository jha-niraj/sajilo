// ── Page → TOC unit/lesson mapping (used by the worker's CHUNK stage) ───────────
// Goal: EVERY page of a curriculum PDF connects to a unit (and a lesson where we
// can tell), so a school can retrieve real content for any unit even when the TOC
// carries no page numbers (e.g. an AI-generated TOC). Strategy, in priority order:
//
//   1. RANGE      - unit has explicit startPage/endPage (admin always provides these).
//   2. HEADING    - detect a unit/lesson heading in the page text (title or "Chapter N").
//   3. CARRY      - a page with no signal inherits the previous page's unit/lesson.
//   4. PROPORTIONAL - no signal anywhere: split pages evenly across units in order.
//
// A little slop (a chunk landing a page or two early/late) is acceptable; the point
// is that no page is ever left unlinked when a TOC exists.

export type MappableLesson = {
    id: string;
    lessonNumber: string;
    title: string;
    startPage: number | null;
    endPage: number | null;
};

export type MappableUnit = {
    id: string;
    unitNumber: string;
    title: string;
    startPage: number | null;
    endPage: number | null;
    lessons: MappableLesson[];
};

export type PageMatchSource = 'range' | 'heading' | 'carry' | 'proportional' | 'none';

export type PageAssignment = {
    tocUnitId: string | null;
    tocLessonId: string | null;
    source: PageMatchSource;
};

const HEAD_CHARS = 400; // headings sit at the top of a page

function normalize(s: string): string {
    return s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Does the top of `pageText` look like the start of this unit? (title or "Chapter/Unit N") */
function pageStartsUnit(headNorm: string, headRaw: string, unit: MappableUnit): boolean {
    const title = normalize(unit.title);
    if (title.length >= 4 && headNorm.includes(title)) return true;
    const num = unit.unitNumber.trim();
    if (num && /^[0-9]+$/.test(num)) {
        const re = new RegExp(`\\b(?:unit|chapter|ch|lesson)\\s*0*${escapeRegex(num)}\\b`, 'i');
        if (re.test(headRaw)) return true;
    }
    return false;
}

/** Does the top of `pageText` look like the start of this lesson? (number "1.2" or title) */
function pageStartsLesson(headNorm: string, headRaw: string, lesson: MappableLesson): boolean {
    const num = lesson.lessonNumber.trim();
    if (num && /^[0-9]+(?:\.[0-9]+)+$/.test(num)) {
        const re = new RegExp(`(?:^|\\s)${escapeRegex(num)}(?:\\s|$|[.:)])`);
        if (re.test(headRaw)) return true;
    }
    const title = normalize(lesson.title);
    if (title.length >= 5 && headNorm.includes(title)) return true;
    return false;
}

/**
 * Find a monotonic start page-index (0-based) for each item, or -1 if not found.
 * `matcher(headNorm, headRaw, item)` decides whether a page starts that item.
 * Only searches within [fromIdx, toIdx).
 */
function detectStarts<T>(
    pageTexts: string[],
    items: T[],
    matcher: (headNorm: string, headRaw: string, item: T) => boolean,
    fromIdx: number,
    toIdx: number,
): number[] {
    const starts = new Array<number>(items.length).fill(-1);
    let searchFrom = fromIdx;
    for (let i = 0; i < items.length; i++) {
        for (let p = searchFrom; p < toIdx; p++) {
            const headRaw = pageTexts[p]!.slice(0, HEAD_CHARS);
            const headNorm = normalize(headRaw);
            if (matcher(headNorm, headRaw, items[i]!)) {
                starts[i] = p;
                searchFrom = p + 1;
                break;
            }
        }
    }
    return starts;
}

/**
 * Assign lessons within a unit's page span [spanStart, spanEnd] (0-based, inclusive).
 * Uses lesson page ranges first, else heading detection, else leaves lessons unset
 * (unit-level mapping still stands). Mutates `result`.
 */
function assignLessons(
    result: PageAssignment[],
    pageTexts: string[],
    unit: MappableUnit,
    spanStart: number,
    spanEnd: number,
): void {
    if (unit.lessons.length === 0 || spanStart > spanEnd) return;

    // 1) Lesson page ranges (1-based) that fall inside the span.
    const ranged = unit.lessons.filter((l) => l.startPage != null);
    if (ranged.length > 0) {
        const sorted = [...ranged].sort((a, b) => (a.startPage as number) - (b.startPage as number));
        for (let li = 0; li < sorted.length; li++) {
            const l = sorted[li]!;
            const from = Math.max(spanStart, (l.startPage as number) - 1);
            const explicitEnd = l.endPage != null ? (l.endPage as number) - 1 : null;
            const nextStart = li + 1 < sorted.length ? (sorted[li + 1]!.startPage as number) - 2 : spanEnd;
            const to = Math.min(spanEnd, explicitEnd ?? nextStart);
            for (let p = from; p <= to; p++) if (result[p]) result[p]!.tocLessonId = l.id;
        }
        return;
    }

    // 2) Heading detection within the span, then carry-forward.
    const starts = detectStarts(pageTexts, unit.lessons, pageStartsLesson, spanStart, spanEnd + 1);
    const found = unit.lessons
        .map((l, i) => ({ id: l.id, at: starts[i]! }))
        .filter((x) => x.at >= 0)
        .sort((a, b) => a.at - b.at);
    if (found.length === 0) return;
    for (let fi = 0; fi < found.length; fi++) {
        const from = found[fi]!.at;
        const to = fi + 1 < found.length ? found[fi + 1]!.at - 1 : spanEnd;
        for (let p = from; p <= to; p++) if (result[p]) result[p]!.tocLessonId = found[fi]!.id;
    }
}

/**
 * Map each page (index = pageNumber - 1) to a unit + optional lesson.
 * Returns one assignment per page. Never returns a null unit when `units` is
 * non-empty (falls back to carry / proportional).
 */
export function mapPagesToUnits(pageTexts: string[], units: MappableUnit[]): PageAssignment[] {
    const n = pageTexts.length;
    const result: PageAssignment[] = Array.from({ length: n }, () => ({ tocUnitId: null, tocLessonId: null, source: 'none' as PageMatchSource }));
    if (n === 0 || units.length === 0) return result;

    const ranged = units.filter((u) => u.startPage != null && u.endPage != null);

    if (ranged.length > 0) {
        // ── RANGE mode ──────────────────────────────────────────────────────────
        for (const u of ranged) {
            const from = Math.max(0, (u.startPage as number) - 1);
            const to = Math.min(n - 1, (u.endPage as number) - 1);
            for (let p = from; p <= to; p++) { result[p] = { tocUnitId: u.id, tocLessonId: null, source: 'range' }; }
            assignLessons(result, pageTexts, u, from, to);
        }
        // Carry-fill any pages outside a declared range so nothing is left unlinked.
        // Forward pass: inherit the previous page's unit.
        for (let p = 1; p < n; p++) {
            if (result[p]!.tocUnitId == null && result[p - 1]!.tocUnitId != null) {
                result[p] = { tocUnitId: result[p - 1]!.tocUnitId, tocLessonId: result[p - 1]!.tocLessonId, source: 'carry' };
            }
        }
        // Backward pass: leading pages before the first range inherit the next unit.
        for (let p = n - 2; p >= 0; p--) {
            if (result[p]!.tocUnitId == null && result[p + 1]!.tocUnitId != null) {
                result[p] = { tocUnitId: result[p + 1]!.tocUnitId, tocLessonId: null, source: 'carry' };
            }
        }
        return result;
    }

    // ── HEADING mode (no page ranges - typical AI-generated TOC) ────────────────
    const unitStarts = detectStarts(pageTexts, units, pageStartsUnit, 0, n);
    const found = units
        .map((u, i) => ({ unit: u, at: unitStarts[i]! }))
        .filter((x) => x.at >= 0)
        .sort((a, b) => a.at - b.at);

    if (found.length > 0) {
        // Leading pages (before the first detected unit) belong to the first unit.
        for (let fi = 0; fi < found.length; fi++) {
            const spanStart = fi === 0 ? 0 : found[fi]!.at;
            const spanEnd = fi + 1 < found.length ? found[fi + 1]!.at - 1 : n - 1;
            for (let p = spanStart; p <= spanEnd; p++) {
                result[p] = { tocUnitId: found[fi]!.unit.id, tocLessonId: null, source: p === found[fi]!.at ? 'heading' : 'carry' };
            }
            assignLessons(result, pageTexts, found[fi]!.unit, spanStart, spanEnd);
        }
        return result;
    }

    // ── PROPORTIONAL mode (no signal at all) ────────────────────────────────────
    // Split pages as evenly as possible across units, preserving order.
    const per = n / units.length;
    for (let p = 0; p < n; p++) {
        const ui = Math.min(units.length - 1, Math.floor(p / per));
        result[p] = { tocUnitId: units[ui]!.id, tocLessonId: null, source: 'proportional' };
    }
    return result;
}
