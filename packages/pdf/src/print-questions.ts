import { rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { answerSpaceLines, answerSpaceHeight, ANSWER_LINE_GAP, ANSWER_SPACE_TOP_PAD } from '@repo/core/questionpaper/answer-space';
import { INK, wrap, type Fonts } from './layout';
import type { PrintQuestion } from './types';

/**
 * One printed question, shared by the teacher's plan sheet and the class set.
 *
 * The student answers with a PEN: a tick in a box for a choice or true/false, a number on a short
 * line, sentences on ruled lines sized to the marks (`answerSpaceLines`, the same ladder the
 * question paper uses). Nothing here is a form field; a school photocopies these.
 *
 * Measured before it is drawn (`questionBlockHeight`), so a caller can keep a question whole on a
 * page - a stem on one page and its boxes on the next is unusable at a desk.
 */

const BOX = 9;
const LINE = 13;
const STEM_SIZE = 10;
const OPTION_SIZE = 9.5;
const RULE_INK = rgb(0.80, 0.80, 0.80);
const KEY_TINT = rgb(0.996, 0.949, 0.949);
const NUM_W = 24;

function stemLines(fonts: Fonts, q: PrintQuestion, width: number): string[] {
    return wrap(fonts.regular, q.prompt, STEM_SIZE, width - NUM_W - 40);
}

function optionLines(fonts: Fonts, q: PrintQuestion, width: number): { text: string; lines: string[] }[] {
    const choices = q.type === 'TRUE_FALSE' ? ['True', 'False'] : (q.choices ?? []);
    return choices.map((c, i) => ({
        text: c,
        lines: wrap(fonts.regular, `${String.fromCharCode(65 + i)}. ${c}`, OPTION_SIZE, width - NUM_W - BOX - 16),
    }));
}

function ruledCount(q: PrintQuestion, withAnswers: boolean): number {
    if (q.type === 'MCQ' || q.type === 'TRUE_FALSE') return 0;
    if (q.type === 'NUMERICAL') return withAnswers ? 0 : 1;
    return answerSpaceLines({ marks: q.marks, options: null, isAnswerKey: withAnswers });
}

export function questionBlockHeight(fonts: Fonts, q: PrintQuestion, width: number, withAnswers: boolean): number {
    const stem = stemLines(fonts, q, width).length * 14;
    const options = optionLines(fonts, q, width).reduce((s, o) => s + Math.max(1, o.lines.length) * LINE, 0);
    const ruled = answerSpaceHeight(ruledCount(q, withAnswers));
    const key = withAnswers && q.answer ? wrap(fonts.regular, `Answer: ${q.answer}`, 9, width - NUM_W).length * 12 + 12 : 0;
    return stem + options + ruled + key + 10;
}

/** Draws the block with its top-left at (x, top) and returns the height used. */
export function drawQuestionBlock(
    page: PDFPage, fonts: Fonts, q: PrintQuestion,
    opts: { x: number; top: number; width: number; withAnswers: boolean },
): number {
    const { x, width, withAnswers } = opts;
    let y = opts.top;
    const regular: PDFFont = fonts.regular;

    page.drawText(`${q.number}.`, { x, y: y - 10, size: STEM_SIZE, font: fonts.bold, color: INK.body });
    const marks = `[${q.marks}]`;
    page.drawText(marks, { x: x + width - regular.widthOfTextAtSize(marks, 9), y: y - 10, size: 9, font: regular, color: INK.muted });
    for (const [i, line] of stemLines(fonts, q, width).entries()) {
        page.drawText(line, { x: x + NUM_W, y: y - 10 - i * 14, size: STEM_SIZE, font: regular, color: INK.body });
    }
    y -= stemLines(fonts, q, width).length * 14;

    // A box to tick, then the option. Boxes on the student copy AND the teacher copy: the
    // teacher's sheet is what gets photocopied when the printer is down.
    for (const o of optionLines(fonts, q, width)) {
        page.drawRectangle({ x: x + NUM_W, y: y - 10, width: BOX, height: BOX, borderWidth: 0.6, borderColor: INK.body });
        for (const [i, line] of o.lines.entries()) {
            page.drawText(line, { x: x + NUM_W + BOX + 6, y: y - 9.5 - i * LINE, size: OPTION_SIZE, font: regular, color: INK.body });
        }
        y -= Math.max(1, o.lines.length) * LINE;
    }

    const ruled = ruledCount(q, withAnswers);
    if (ruled > 0) {
        y -= ANSWER_SPACE_TOP_PAD;
        for (let i = 0; i < ruled; i++) {
            const ly = y - i * ANSWER_LINE_GAP;
            // A number gets one short line and its unit; prose gets the full width.
            const end = q.type === 'NUMERICAL' ? x + NUM_W + 120 : x + width;
            page.drawLine({ start: { x: x + NUM_W, y: ly }, end: { x: end, y: ly }, thickness: 0.5, color: RULE_INK });
            if (q.type === 'NUMERICAL' && q.unit) {
                page.drawText(q.unit, { x: end + 6, y: ly + 2, size: 9, font: regular, color: INK.muted });
            }
        }
        y -= ruled * ANSWER_LINE_GAP;
    }

    if (withAnswers && q.answer) {
        const lines = wrap(regular, `Answer: ${q.answer}`, 9, width - NUM_W);
        const h = lines.length * 12 + 10;
        page.drawRectangle({ x: x + NUM_W, y: y - h, width: width - NUM_W, height: h, color: KEY_TINT });
        for (const [i, line] of lines.entries()) {
            page.drawText(line, { x: x + NUM_W + 6, y: y - 11 - i * 12, size: 9, font: regular, color: INK.body });
        }
        y -= h + 2;
    }

    return opts.top - y + 10;
}
