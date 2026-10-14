import { PALETTES, type PaletteName } from './palette';
import type { ArtKey } from './motifs';

/**
 * Subject name -> artwork.
 *
 * ## Why this is a matcher and not a lookup table
 *
 * Schools name their own subjects. The same subject arrives as "Maths", "Mathematics", "Math",
 * "Compulsory Mathematics", "गणित", or "Mathematics (Compulsory)" depending on who typed it into the
 * curriculum screen. A `Record<string, Art>` keyed on an exact name would give a real cover to the
 * spelling we happened to think of and the fallback to every other school - and it would fail
 * silently, which is the worst kind of failure for something visual.
 *
 * So matching is on a NORMALISED string against ordered keyword rules, and the order matters:
 * "Optional Mathematics" has to be tested before "Mathematics", "Computer Science" before "Science",
 * or the more general rule swallows the specific one. Every rule below that could be swallowed sits
 * above the rule that would swallow it, and the checks in `registry.check.ts` assert exactly that.
 *
 * Devanagari names are matched too, because a Nepali-medium school types them.
 */

export interface SubjectArt {
    key: ArtKey;
    palette: PaletteName;
}

const FALLBACK: SubjectArt = { key: 'generic', palette: 'gold' };

/**
 * Lowercased, punctuation stripped, whitespace collapsed. Combining marks are KEPT - stripping
 * `\p{M}` destroys Devanagari conjuncts, which is a bug this codebase has already shipped once in
 * the distress screen and once in the reading scorer.
 */
export function normaliseSubject(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\p{M}\s]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Ordered. The FIRST rule whose every keyword-group matches wins.
 *
 * ## Colours are assigned so a real grid does not repeat itself
 *
 * The eight subjects of a Nepali secondary class arrive alphabetically, and the first draft put
 * English and Health next to each other in rose, and Nepali next to Optional Mathematics in orange -
 * two pairs of near-identical cards on one screen, which reads as a rendering bug rather than a
 * palette. English moved to `ink` (a book is black on paper, and one neutral card stops the grid
 * looking like a paint chart) and Optional Mathematics to `amber`. The resulting rows are
 * lime/ink/rose, gold/orange/amber, teal/emerald - eight subjects, eight distinct colours, and
 * nothing repeats beside or directly above anything else. Computer Science on lime is also the
 * closest thing here to a phosphor terminal, which is what its drawing is.
 */
const RULES: Array<{ any: string[]; art: SubjectArt }> = [
    // ── Specific-before-general. Moving any of these below its parent breaks the match. ──
    { any: ['optional math', 'opt math', 'additional math', 'अतिरिक्त गणित'], art: { key: 'optionalMathematics', palette: 'amber' } },
    { any: ['computer', 'informatics', 'ict', 'programming', 'कम्प्युटर'], art: { key: 'computerScience', palette: 'lime' } },
    { any: ['social studies', 'social science', 'सामाजिक'], art: { key: 'socialStudies', palette: 'emerald' } },
    { any: ['environment', 'evs', 'वातावरण'], art: { key: 'environment', palette: 'lime' } },
    { any: ['physical education', 'health', 'hpe', 'स्वास्थ्य', 'शारीरिक'], art: { key: 'health', palette: 'rose' } },
    { any: ['business', 'entrepreneur', 'management'], art: { key: 'business', palette: 'amber' } },
    { any: ['account', 'economic', 'finance', 'लेखा', 'अर्थशास्त्र'], art: { key: 'accounts', palette: 'amber' } },

    // ── Sciences ──
    { any: ['physics', 'भौतिक'], art: { key: 'physics', palette: 'teal' } },
    { any: ['chemistry', 'रसायन'], art: { key: 'chemistry', palette: 'lime' } },
    { any: ['biology', 'botany', 'zoology', 'जीव'], art: { key: 'biology', palette: 'emerald' } },
    { any: ['science', 'विज्ञान'], art: { key: 'science', palette: 'teal' } },

    // ── Humanities ──
    { any: ['geography', 'भूगोल'], art: { key: 'geography', palette: 'emerald' } },
    { any: ['history', 'civic', 'इतिहास'], art: { key: 'history', palette: 'amber' } },
    { any: ['moral', 'value education', 'नैतिक'], art: { key: 'moral', palette: 'amber' } },

    // ── Languages ──
    { any: ['english', 'अंग्रेजी'], art: { key: 'english', palette: 'ink' } },
    { any: ['nepali', 'nepalee', 'नेपाली'], art: { key: 'nepali', palette: 'orange' } },
    { any: ['sanskrit', 'hindi', 'maithili', 'newari', 'language', 'संस्कृत'], art: { key: 'nepali', palette: 'ink' } },

    // ── Arts ──
    { any: ['music', 'संगीत'], art: { key: 'music', palette: 'rose' } },
    { any: ['art', 'drawing', 'craft', 'design', 'कला'], art: { key: 'arts', palette: 'orange' } },

    // ── Mathematics last among its family, so the two rules above still win. ──
    { any: ['math', 'गणित', 'algebra', 'geometry', 'statistic'], art: { key: 'mathematics', palette: 'gold' } },

    // ── The everyday tools. Not subjects, but the same artwork system. ──
    { any: ['typing', 'keyboard'], art: { key: 'typing', palette: 'gold' } },
    { any: ['read aloud', 'reading'], art: { key: 'reading', palette: 'teal' } },
    { any: ['word', 'vocabulary'], art: { key: 'words', palette: 'lime' } },
    { any: ['daily set', 'today'], art: { key: 'daily', palette: 'amber' } },
    { any: ['doubt', 'ask'], art: { key: 'doubt', palette: 'rose' } },
    { any: ['practice', 'quiz'], art: { key: 'practice', palette: 'orange' } },
    { any: ['library', 'book', 'resource'], art: { key: 'library', palette: 'emerald' } },
    { any: ['leaderboard', 'rank', 'achievement'], art: { key: 'leaderboard', palette: 'gold' } },
];

/** The artwork for a subject name. Never throws, never returns nothing. */
export function resolveSubjectArt(name: string): SubjectArt {
    const n = normaliseSubject(name);
    if (!n) return FALLBACK;
    for (const rule of RULES) {
        if (rule.any.some((kw) => n.includes(kw))) return rule.art;
    }
    return FALLBACK;
}

/**
 * A stable fallback palette for an unmatched subject, so two unknown subjects in one grid do not
 * both come out the same shade of gold.
 *
 * FNV-1a over the name. Deterministic, so a subject keeps its colour between sessions and between
 * the server render and the client one - a colour that changes on hydration is a flash of the wrong
 * thing on every load.
 */
const SPREAD: PaletteName[] = ['gold', 'teal', 'emerald', 'amber', 'orange', 'rose', 'lime'];

export function fallbackPalette(name: string): PaletteName {
    let h = 0x811c9dc5;
    for (let i = 0; i < name.length; i += 1) {
        h ^= name.charCodeAt(i);
        h = Math.imul(h, 0x01000193) >>> 0;
    }
    return SPREAD[h % SPREAD.length]!;
}

export { PALETTES };
