/**
 * The one puzzle in an AI-generated lesson plan: the prompt that asks for it, and the gate that
 * throws it away.
 *
 * ## Why both halves are in one file
 *
 * Same reason as `./ai-diagrams.ts`. The prompt describes exactly what `validatePuzzle` accepts;
 * split across two files they drift silently, the model keeps emitting things that are dropped, and
 * plans just quietly stop having puzzles with nothing failing anywhere.
 *
 * ## The rule
 *
 * A refused puzzle costs a puzzle. A failed generation costs the teacher a whole lesson plan after
 * credits have been spent. So `sanitisePuzzle` DELETES and returns a reason; it has no failure mode
 * and cannot throw.
 *
 * ## Why the model is told the exclusions and not just the inclusions
 *
 * Asked for "a game", a language model reaches for a word search or an odd-one-out, because those
 * are what the word "game" is attached to in its training data. Both are excluded here on purpose,
 * and a prompt that only lists what IS allowed gets them anyway, dressed as one of the four.
 */

import { validatePuzzle, PUZZLE_KINDS, MAX_SQUARE, MAX_LADDER, MAX_MATCH, type PuzzleSpec } from './puzzle';

type LessonPlanLanguage = 'en' | 'ne';

/**
 * One line per kind, with every cap the validator enforces.
 *
 * Typed as a full record of the kind union on purpose: adding a fifth kind to
 * `@repo/core/lessonplan/puzzle` fails to compile here, which is the only mechanism that stops the
 * prompt from falling behind the spec.
 */
const KIND_LINES: Record<(typeof PUZZLE_KINDS)[number], string> = {
    latinSquare: `latinSquare - an n x n grid where every symbol appears exactly once per row and column. REQUIRED size (4-${MAX_SQUARE}), symbols (exactly "size" distinct SHORT strings - one or two characters, they are printed inside a cell), solution (row-major, size*size entries, a valid latin square), given (row-major, size*size, each entry either null for a blank or the SAME value as solution at that position). Leave between a third and two thirds of the cells blank. Good for place value, number properties, unit families, symbol sets.`,
    sequenceLadder: `sequenceLadder - put items in order by one stated measurable property. REQUIRED orderBy (the property, e.g. "distance from the Sun, nearest first"), items (3-${MAX_LADDER} DISTINCT strings, in shuffled order as they will be printed), solution (indices into items, in correct order, a permutation). Optional keys (one per item, the value that decides its place, e.g. "58m km") - every key must be DIFFERENT or the order is not unique and the puzzle is thrown away. Good for chronology, magnitude, reactivity, process steps.`,
    matchGrid: `matchGrid - pair two sets by elimination. REQUIRED leftLabel, rightLabel, left (3-${MAX_MATCH} strings), right (same length), solution (for each left index, the right index it pairs with, a permutation), clues - an ARRAY OF CONSTRAINTS, never sentences: {"type":"is","left":0,"right":2} means they pair, {"type":"not","left":1,"right":0} means they do not. Give ENOUGH clues that only ONE matching is possible; too few and the puzzle is thrown away. Good for term to definition, organ to function, instrument to quantity.`,
    balanceEquation: `balanceEquation - balance a chemical equation. REQUIRED reactants and products, each 1-6 of {formula (as printed, e.g. "H2O"), atoms (element symbol to count in ONE unit, e.g. {"H":2,"O":1}), coefficient (the correct whole number, 1-30)}. The totals per element must be EQUAL on both sides and the coefficients must share no common factor. Chemistry only.`,
};

/** What the model must not reach for, and why. Stated so it does not dress one of these as a kind. */
const EXCLUSIONS = [
    'Do NOT make an odd-one-out. It usually has more than one defensible answer and punishes the student who thought harder.',
    'Do NOT make a word search, an anagram or a crossword. The mechanic is letter-hunting, not the subject.',
    'Do NOT make anything scored on speed. It cannot be done on paper.',
    'Do NOT make a puzzle whose answer is a date, a definition or a recalled fact. That is a question, and questions go in the check.',
].join('\n');

/**
 * The puzzle is asked for in its OWN call, not as a field on the lesson-plan response.
 *
 * ## Why, measured rather than assumed
 *
 * It was a field first. The section was 3,125 characters, it described the four kinds in full, the
 * schema block was opened up to permit the key, and gpt-4o-mini emitted `puzzle` ZERO times out of
 * two runs on "Balancing chemical equations" - the single most obviously-a-puzzle topic in the
 * whole set. `offered: false` both times, so nothing was being rejected; the model was not writing
 * one at all. The plan prompt already carries the schema, the slot table, the writing rules, the
 * grounding extracts, the diagram catalogue and the figure library, and a fifth optional structure
 * at the end of that simply loses the competition for attention.
 *
 * A separate call fixes more than the attention problem:
 *   - a puzzle that fails cannot damage a plan the teacher paid eight credits for
 *   - the puzzle can be re-rolled without regenerating the lesson
 *   - the prompt is short enough to reason about, and cheap enough to run at a low token cap
 */
export const PUZZLE_SYSTEM = 'You write ONE puzzle for a school lesson in Nepal, or you decline. Return only JSON.';

export function puzzlePrompt(input: {
    subject: string;
    className: string;
    topic: string;
    objectives: string[];
    language: LessonPlanLanguage;
}): string {
    return `A Class ${input.className} ${input.subject} lesson in Nepal on: ${input.topic}
The objectives are:
${input.objectives.map((o, i) => `${i + 1}. ${o}`).join('\n')}

Write ONE puzzle for this lesson, if and only if the reasoning in it genuinely IS one of the four
mechanics below. The test: would five plain questions lose anything? If they would not, decline.

${PUZZLE_KINDS.map((k) => `- ${KIND_LINES[k]}`).join('\n')}

${EXCLUSIONS}

The puzzle is PRINTED on paper as well as shown on a screen, so it must work with a pencil.
It must have EXACTLY ONE correct answer. A puzzle with two correct answers means a student is
marked wrong for a right answer, and it will be discarded.

Return JSON, and nothing else, in ONE of these two shapes:
  {"puzzle": null, "why": "one short line saying why none of the four fits this lesson"}
  {"puzzle": { "kind": one of ${PUZZLE_KINDS.map((k) => `"${k}"`).join(', ')}, "instructions": one short sentence telling the student what to do${input.language === 'ne' ? ' IN NEPALI' : ''}, ...the fields that kind requires... }}`;
}

export interface PuzzleSanitiseResult {
    /** The puzzle, or null when there was none or it was refused. */
    puzzle: PuzzleSpec | null;
    /** Why it was refused, for the log. Null when there was nothing to refuse. */
    droppedReason: string | null;
}

/**
 * The ONLY validation point for a puzzle on the write path.
 *
 * Cannot throw. A plan without a puzzle is a normal plan; a plan that failed to save because its
 * puzzle was malformed is eight credits gone.
 */
export function sanitisePuzzle(value: unknown): PuzzleSanitiseResult {
    if (value === undefined || value === null) return { puzzle: null, droppedReason: null };
    try {
        const verdict = validatePuzzle(value);
        if (!verdict.ok) return { puzzle: null, droppedReason: verdict.reason };
        return { puzzle: value as PuzzleSpec, droppedReason: null };
    } catch (e) {
        return { puzzle: null, droppedReason: e instanceof Error ? e.message : 'puzzle validation threw' };
    }
}

/**
 * The proposal prompt: the model names the SUBJECT MATTER of one puzzle and nothing else.
 *
 * No grid, no givens, no clues, no coefficients - `buildPuzzle` lays those out and proves them. The
 * model chose the symbols, the ordered items with the fact that orders them, the pairs, or the
 * molecules; that is the part only a model can do and the part it does well.
 */
export const PUZZLE_PROPOSAL_SYSTEM = 'You propose the subject matter of ONE puzzle for a school lesson in Nepal, or you decline. Return only JSON.';

export function puzzleProposalPrompt(input: {
    subject: string;
    className: string;
    topic: string;
    objectives: string[];
    language: LessonPlanLanguage;
    /** What the last proposal failed on, quoted back, so the next one is different. */
    feedback?: string | null;
}): string {
    return `A Class ${input.className} ${input.subject} lesson in Nepal on: ${input.topic}
The objectives are:
${input.objectives.map((o, i) => `${i + 1}. ${o}`).join('\n')}

Propose ONE puzzle for this lesson, if and only if the reasoning in it genuinely IS one of the four
mechanics below. The test: would five plain questions lose anything? If they would not, decline.
You give ONLY the subject matter; the grid, the blanks, the clues and the coefficients are worked out
and checked by a program afterwards.

- latinSquare: 4 to ${MAX_SQUARE} distinct SHORT symbols (one to three characters each) from the lesson - digits of a
  base, unit symbols, element symbols. {"kind":"latinSquare","instructions":"...","symbols":["0","1","2","3"]}
- sequenceLadder: 3 to ${MAX_LADDER} items with ONE measurable property that orders them, each with the VALUE of
  that property as "key" (every key different). {"kind":"sequenceLadder","instructions":"...","orderBy":"binary value, smallest first","items":[{"text":"1010","key":"10"},...]} - items in the CORRECT order.
- matchGrid: 3 to ${MAX_MATCH} pairs that belong together, term to meaning, organ to function, in the CORRECT pairing.
  {"kind":"matchGrid","instructions":"...","leftLabel":"Term","rightLabel":"Meaning","pairs":[["bit","0 or 1"],...]}
- balanceEquation: chemistry only. The molecules on each side with their atom counts, NO coefficients.
  {"kind":"balanceEquation","instructions":"...","reactants":[{"formula":"H2","atoms":{"H":2}},{"formula":"O2","atoms":{"O":2}}],"products":[{"formula":"H2O","atoms":{"H":2,"O":1}}]}

${EXCLUSIONS}

"instructions" is one short sentence telling the student what to do${input.language === 'ne' ? ' IN NEPALI' : ''}.
${input.feedback ? `\nYOUR LAST PROPOSAL COULD NOT BE MADE INTO A PUZZLE: ${input.feedback}\nPropose something different.\n` : ''}
Return JSON, and nothing else, in ONE of these two shapes:
  {"puzzle": null, "why": "one short line saying why none of the four fits this lesson"}
  {"puzzle": { ...one of the four shapes above... }}`;
}
