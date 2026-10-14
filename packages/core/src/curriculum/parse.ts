import type { ParsedTocLesson, ParsedTocUnit } from './types';
import { isValidTocPageRange, normalizeLessonPages, toPageInt } from './pages';

// ── Pure regex parser: pasted TOC text → structured units + lessons ─────────────
// Deterministic fallback used when the AI parser is unavailable or fails.

const UNIT_PATTERNS = [
    /^(?:unit|chapter|ch\.?|section)\s*(\d+|[a-z])[:\s]+(.+)/i,
    /^(\d+)\.\s+([A-Z].+)/,       // "1. Living World"
    /^([A-Z].+)\s*\(unit\s*\d+\)/i,
];
const LESSON_PATTERNS = [
    /^(\d+\.\d+)\s+(.+)/,          // "1.1 Characteristics..."
    /^[\s\t]+(\d+\.\d+)\s+(.+)/,   // indented "  1.1 ..."
    /^[-•]\s+(.+)/,                // "- topic"
];

/** Pull a trailing "(pp. A-B)" / "[A-B]" / "(12-30)" page range off a unit line. */
function extractPageRange(title: string): { title: string; startPage: number | null; endPage: number | null } {
    const m = title.match(/\s*[([]\s*(?:pp?\.?\s*)?(\d+)\s*[-–]\s*(\d+)\s*[)\]]\s*$/i);
    if (!m || m.index === undefined) return { title: title.trim(), startPage: null, endPage: null };
    const sp = parseInt(m[1]!, 10);
    const ep = parseInt(m[2]!, 10);
    if (!Number.isFinite(sp) || !Number.isFinite(ep) || sp < 1 || ep < sp) {
        return { title: title.trim(), startPage: null, endPage: null };
    }
    return { title: title.slice(0, m.index).trim(), startPage: sp, endPage: ep };
}

/** Parse pasted TOC text into structured units. Returns [] if nothing matched. */
export function parseTocText(text: string): ParsedTocUnit[] {
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    const units: ParsedTocUnit[] = [];
    let current: ParsedTocUnit | null = null;

    for (const line of lines) {
        let matchedUnit = false;
        for (const pat of UNIT_PATTERNS) {
            const m = line.match(pat);
            if (m) {
                const rawTitle = (m[2] ?? m[1] ?? line).trim();
                const { title, startPage, endPage } = extractPageRange(rawTitle);
                current = {
                    unitNumber: m[1]?.trim() ?? String(units.length + 1),
                    title: title || rawTitle,
                    startPage,
                    endPage,
                    lessons: [],
                };
                units.push(current);
                matchedUnit = true;
                break;
            }
        }
        if (matchedUnit) continue;

        if (current) {
            for (const pat of LESSON_PATTERNS) {
                const m = line.match(pat);
                if (m) {
                    current.lessons.push({
                        lessonNumber: m[2] ? m[1]!.trim() : String(current.lessons.length + 1),
                        title: (m[2] ?? m[1] ?? line).trim(),
                    });
                    break;
                }
            }
        }
    }
    return units;
}

// ── Coerce the AI's loose JSON into validated ParsedTocUnit[] ───────────────────

type RawAiLesson = { lessonNumber?: unknown; title?: unknown; startPage?: unknown; endPage?: unknown };
type RawAiUnit = {
    unitNumber?: unknown;
    title?: unknown;
    startPage?: unknown;
    endPage?: unknown;
    lessons?: RawAiLesson[];
};

/** Normalise the raw JSON returned by the TOC AI prompts into clean units. */
export function normalizeAiToc(raw: unknown): ParsedTocUnit[] {
    const rawUnits = (raw as { units?: RawAiUnit[] } | null)?.units;
    if (!Array.isArray(rawUnits)) return [];
    const units: ParsedTocUnit[] = [];
    for (let i = 0; i < rawUnits.length; i++) {
        const ru = rawUnits[i]!;
        const title = String(ru.title ?? '').trim();
        if (!title) continue;
        let uStart = toPageInt(ru.startPage);
        let uEnd = toPageInt(ru.endPage);
        if (uStart != null && uEnd != null && uEnd < uStart) { const t = uStart; uStart = uEnd; uEnd = t; }
        if (!isValidTocPageRange(uStart, uEnd)) { uStart = null; uEnd = null; }
        const lessons: ParsedTocLesson[] = [];
        if (Array.isArray(ru.lessons)) {
            for (let li = 0; li < ru.lessons.length; li++) {
                const rl = ru.lessons[li];
                const lTitle = String(rl?.title ?? '').trim();
                if (!lTitle) continue;
                const { startPage, endPage } = normalizeLessonPages(toPageInt(rl?.startPage), toPageInt(rl?.endPage));
                lessons.push({
                    lessonNumber: String(rl?.lessonNumber ?? '').trim() || String(li + 1),
                    title: lTitle,
                    startPage,
                    endPage,
                });
            }
        }
        units.push({
            unitNumber: String(ru.unitNumber ?? '').trim() || String(i + 1),
            title,
            startPage: uStart,
            endPage: uEnd,
            lessons,
        });
    }
    return units;
}
