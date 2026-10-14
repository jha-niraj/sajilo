/**
 * How much room a student gets to write, decided by what the question is worth.
 *
 * ## Why this exists
 *
 * Our printed question papers gave the student NO writing space at all. The variable called
 * `answerLines` in `packages/pdf/src/question-paper.ts` held the model answer, wrapped - it was the
 * answer key, not an answer area, and it only ever rendered on the teacher's copy.
 *
 * Reading Chalkie's Class 10 Physics worksheet page by page (2026-08-28, written up in
 * `srs/competitor-analysis/lesson-content-tools/01-where-we-stand.md`), the single most useful
 * thing on it was that **the layout encodes the mark scheme**: a 1-mark part gets two ruled lines,
 * a 2-mark part gets five, the 6-mark extended response gets sixteen and most of a page. A student
 * can tell how much to write without being told, and a teacher marking forty scripts can see at a
 * glance who attempted what.
 *
 * That is a layout rule, not intelligence, and it is the highest value per hour on the whole
 * competitive list. This module is the rule.
 *
 * ## The ladder
 *
 * `3 * marks - 1`, clamped. Against the measured Chalkie ladder:
 *
 * | marks | Chalkie | here |
 * |---|---|---|
 * | 1 | 2  | 2  |
 * | 2 | 5  | 5  |
 * | 6 | 16 | 17 |
 *
 * Deliberately super-linear rather than proportional. A 6-mark answer is not six times a 1-mark
 * answer: it needs room for working, for a crossing-out, and for the sentence a student adds after
 * re-reading the question. Space is cheap, and a student who runs out of it writes up the margin.
 */

/** Never fewer than this, even for a half-mark part. One line is not somewhere to write. */
const MIN_LINES = 2;

/**
 * Never more than this. Beyond about eighteen lines the answer area has become a blank page, and a
 * blank page reads as a printing error rather than as an invitation.
 */
const MAX_LINES = 18;

export type AnswerSpaceInput = {
    /** What the question is worth. Non-numeric or missing is treated as one mark. */
    marks?: number | null;
    /** Multiple-choice options. A question that has any gets no ruled lines - the student ticks. */
    options?: unknown[] | null;
    /**
     * True when this is the teacher's answer-key copy. Keys print the model answer where the ruled
     * lines would be, so reserving writing space there would double the height of every question.
     */
    isAnswerKey?: boolean;
};

/**
 * How many ruled lines to print under a question. Zero means print none.
 *
 * Zero for multiple choice and zero on the answer key, so the two copies stay the same shape
 * question-for-question and a teacher can mark against the student's page without hunting.
 */
export function answerSpaceLines(input: AnswerSpaceInput): number {
    if (input.isAnswerKey) return 0;
    if (Array.isArray(input.options) && input.options.length > 0) return 0;

    const raw = typeof input.marks === 'number' && Number.isFinite(input.marks) ? input.marks : 1;
    const marks = Math.max(0, raw);

    const lines = Math.round(3 * marks - 1);
    return Math.min(MAX_LINES, Math.max(MIN_LINES, lines));
}

/** Vertical distance between two ruled lines, in PDF points. Sized for adult handwriting at 10pt. */
export const ANSWER_LINE_GAP = 16;

/** Space between the question text and the first ruled line. */
export const ANSWER_SPACE_TOP_PAD = 6;

/** Total height an answer area occupies, so a caller can measure a question before drawing it. */
export function answerSpaceHeight(lines: number): number {
    return lines > 0 ? ANSWER_SPACE_TOP_PAD + lines * ANSWER_LINE_GAP : 0;
}
