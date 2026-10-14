// Page-range validation + coercion helpers, shared by every TOC authoring surface.

/**
 * UNIT ranges must be a full pair for the chunker to slice pages: allow both-null
 * (unknown) or both-set; reject only-one-set. When both set, require
 * startPage >= 1 and endPage >= startPage.
 */
export function isValidTocPageRange(startPage: number | null, endPage: number | null): boolean {
    const hasStart = startPage != null;
    const hasEnd = endPage != null;
    if (hasStart !== hasEnd) return false;
    if (hasStart && hasEnd) {
        if (!Number.isInteger(startPage) || !Number.isInteger(endPage)) return false;
        if ((startPage as number) < 1 || (endPage as number) < (startPage as number)) return false;
    }
    return true;
}

/** Same rule as {@link isValidTocPageRange} but returns a user-facing error message. */
export function validateTocPageRange(
    startPage: number | null,
    endPage: number | null,
): { ok: true } | { ok: false; error: string } {
    const hasStart = startPage != null;
    const hasEnd = endPage != null;
    if (hasStart !== hasEnd) {
        return { ok: false, error: 'Provide both start and end page, or leave both blank.' };
    }
    if (hasStart && hasEnd) {
        if (!Number.isInteger(startPage) || !Number.isInteger(endPage)) {
            return { ok: false, error: 'Page numbers must be whole numbers.' };
        }
        if ((startPage as number) < 1) {
            return { ok: false, error: 'Start page must be at least 1.' };
        }
        if ((endPage as number) < (startPage as number)) {
            return { ok: false, error: 'End page must be greater than or equal to start page.' };
        }
    }
    return { ok: true };
}

/**
 * LESSON ranges are looser than units: a TOC usually prints only a lesson's start
 * page, so a start-only range is allowed. Returns a sanitised pair (drops an
 * invalid / inverted end; promotes a lone end to the start).
 */
export function normalizeLessonPages(
    start: number | null,
    end: number | null,
): { startPage: number | null; endPage: number | null } {
    let s = start;
    let e = end;
    if (s == null && e != null) { s = e; e = null; }
    if (s != null && (!Number.isInteger(s) || s < 1)) { s = null; e = null; }
    if (e != null && (s == null || !Number.isInteger(e) || e < s)) e = null;
    return { startPage: s, endPage: e };
}

/** Coerce an unknown JSON value to a valid 1-based page integer, or null. */
export function toPageInt(v: unknown): number | null {
    const n = typeof v === 'number' ? v : typeof v === 'string' ? parseInt(v, 10) : NaN;
    return Number.isInteger(n) && n >= 1 ? n : null;
}
