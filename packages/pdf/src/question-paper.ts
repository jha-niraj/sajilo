import { PDFDocument, rgb } from 'pdf-lib';
import type { QuestionPaperExportData } from './types';
import {
    A4, Cursor, INK, centered, centeredImage, embedLogo, loadFonts, paragraph, rule, stampFooter,
    wrap,
} from './layout';
import { drawFigure, isDrawableFigure, FIGURE_HEIGHT } from './question-figure';
import {
    answerSpaceLines, answerSpaceHeight, ANSWER_LINE_GAP, ANSWER_SPACE_TOP_PAD,
} from '@repo/core/questionpaper/answer-space';

/**
 * The question paper (and its answer key), drawn with pdf-lib.
 *
 * Ported from the react-pdf document; see docs/worker-bundle-size.md section 10 for why.
 *
 * The layout rule that matters here is that a question must not be split across a page break -
 * a stem on one page with its options on the next is unusable in an exam hall. react-pdf expressed
 * that with `wrap={false}`; here each question is measured first and the page is broken BEFORE it
 * is drawn if the whole block will not fit.
 */

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

const PANEL = rgb(0.976, 0.976, 0.980);
const KEY_TINT = rgb(0.996, 0.949, 0.949);
const KEY_INK = rgb(0.624, 0.071, 0.224);

// The ruled writing lines. Light enough to be written over in pen without the rule showing
// through the answer, dark enough to survive a school photocopier - which is how most of these
// papers actually reach a student.
const RULE_INK = rgb(0.80, 0.80, 0.80);

export async function renderQuestionPaper(
    data: QuestionPaperExportData,
    withAnswers: boolean,
): Promise<Uint8Array> {
    const doc = await PDFDocument.create();
    doc.setTitle(`${data.title}${withAnswers ? ' (Answer Key)' : ''}`);
    doc.setAuthor(data.school?.name ?? 'Gurukul');
    doc.setProducer('Gurukul');
    doc.setCreator('Gurukul');

    const fonts = await loadFonts(doc);
    const margins = { top: 44, right: 48, bottom: 48, left: 48 };
    const c = new Cursor(doc, fonts, margins, A4);

    // ─── Header ───────────────────────────────────────────────────────────────────────────────────
    const logo = await embedLogo(doc, data.school?.logo ?? null);
    if (logo) centeredImage(c, logo, 40, 6);
    centered(c, data.school?.name ?? 'School', { size: 15, bold: true });
    if (data.school?.address) centered(c, data.school.address, { size: 9, color: INK.muted });

    c.gap(10);
    centered(c, data.title, { size: 13, bold: true, after: withAnswers ? 4 : 10 });

    if (withAnswers) {
        // Loud on purpose. A key that reaches a student is worse than no key.
        const label = 'ANSWER KEY - FOR TEACHER USE ONLY';
        const w = fonts.bold.widthOfTextAtSize(label, 9) + 16;
        c.ensure(20);
        c.page.drawRectangle({ x: c.left + (c.contentWidth - w) / 2, y: c.y - 16, width: w, height: 16, color: KEY_TINT });
        c.page.drawText(label, { x: c.left + (c.contentWidth - w) / 2 + 8, y: c.y - 12, size: 9, font: fonts.bold, color: KEY_INK });
        c.y -= 16;
        c.gap(10);
    }

    // ─── Meta rows ────────────────────────────────────────────────────────────────────────────────
    const metaRow = (left: string, right: string) => {
        c.ensure(15);
        const y = c.y - 9.5;
        c.page.drawText(left, { x: c.left, y, size: 9.5, font: fonts.regular, color: INK.body });
        const w = fonts.regular.widthOfTextAtSize(right, 9.5);
        c.page.drawText(right, { x: c.right - w, y, size: 9.5, font: fonts.regular, color: INK.body });
        c.y -= 15;
    };
    metaRow(`Class: ${data.class}  ·  Subject: ${data.subject}`, `Term: ${data.term}  ·  ${data.academicYear}`);
    metaRow(`Time: ${data.duration} min`, `Full Marks: ${data.totalMarks}`);

    c.gap(4);
    rule(c, 1, INK.body, 12);

    // ─── General instructions ─────────────────────────────────────────────────────────────────────
    if (data.instructions.length > 0) {
        c.page.drawText('General Instructions', { x: c.left, y: c.y - 9.5, size: 9.5, font: fonts.bold, color: INK.body });
        c.y -= 15;
        data.instructions.forEach((ins, i) => paragraph(c, `${i + 1}. ${ins}`, { size: 9, color: INK.muted }));
        c.gap(8);
    }

    // ─── Sections ─────────────────────────────────────────────────────────────────────────────────
    data.sections.forEach((section, si) => {
        const heading = section.sectionName || `Section ${si + 1}`;
        // `${section.totalMarks} marks` printed the literal "undefined marks" on every section
        // header of every generated paper - the stored total is 0/absent and a template string
        // renders undefined happily. Sum the questions, which is the real figure, and print nothing
        // rather than a label with no number.
        const sectionMarks = section.totalMarks
            || section.questions.reduce((a, q) => a + (Number(q.marks) || 0), 0);
        const marks = sectionMarks > 0 ? `${sectionMarks} marks` : '';

        c.ensure(28);
        c.page.drawRectangle({ x: c.left, y: c.y - 20, width: c.contentWidth, height: 20, color: PANEL });
        c.page.drawText(heading, { x: c.left + 8, y: c.y - 14, size: 10.5, font: fonts.bold, color: INK.body });
        if (marks) {
            const mw = fonts.bold.widthOfTextAtSize(marks, 9.5);
            c.page.drawText(marks, { x: c.right - 8 - mw, y: c.y - 14, size: 9.5, font: fonts.bold, color: INK.muted });
        }
        c.y -= 20;
        c.gap(6);

        if (section.instructions) paragraph(c, section.instructions, { size: 8.5, color: INK.muted, after: 4 });

        section.questions.forEach((q, qi) => {
            const numText = `${q.questionNumber ?? qi + 1}.`;
            const marksText = `[${q.marks}]`;
            const numW = 22;
            const marksW = fonts.regular.widthOfTextAtSize(marksText, 9.5) + 6;
            const textW = c.contentWidth - numW - marksW;

            const stem = wrap(fonts.regular, q.questionText, 10, textW);
            const options = (q.options ?? []).map((opt, oi) => `(${LETTERS[oi] ?? oi + 1}) ${opt}`);
            // Options are laid out in COLUMNS across the width, the way a printed paper does it.
            // Two columns when every option is short enough to fit one, otherwise one column - a
            // long option silently overlapping its neighbour is worse than a tall list.
            const optionColW = (textW - 10) / 2;
            const optionsFitTwoUp = options.length > 1
                && options.every((o) => fonts.regular.widthOfTextAtSize(o, 9.5) <= optionColW - 8);
            const optionCols = optionsFitTwoUp ? 2 : 1;
            const optionRows = Math.ceil(options.length / optionCols);
            const optionLines = optionsFitTwoUp
                ? new Array(optionRows).fill('')
                : options.flatMap((o) => wrap(fonts.regular, o, 9.5, textW - 10));
            const answer = withAnswers ? (q.correctAnswer ?? q.sampleAnswer ?? null) : null;
            const answerLines = answer ? wrap(fonts.regular, answer, 9, textW - 16) : [];

            // Mark-weighted writing space, on the STUDENT copy only. Before this a printed paper
            // gave the student no ruled area at all - `answerLines` above is the model answer
            // wrapped, which is a different thing that happens to have a similar name.
            //
            // Sizing the space to the marks means the layout carries the mark scheme: a student can
            // see how much to write without being told. See the module for the ladder and where it
            // was measured from.
            const ruledLines = answerSpaceLines({
                marks: q.marks, options: q.options ?? null, isAnswerKey: withAnswers,
            });
            const ruledH = answerSpaceHeight(ruledLines);

            // Measure the WHOLE question, then break before drawing if it will not fit. This is the
            // `wrap={false}` guarantee: a stem stranded on one page with its options on the next is
            // unusable in an exam hall.
            // A figure is measured WITH the question, never added after the fit check. Drawing it
            // afterwards would let a stem sit at the foot of a page with its diagram overflowing
            // onto the next - the same split the wrap={false} rule exists to prevent, just moved.
            const figure = isDrawableFigure(q.figure) ? q.figure : null;
            const figureH = figure ? FIGURE_HEIGHT : 0;
            const height = stem.length * 14 + optionLines.length * 13 + figureH
                + (answer ? answerLines.length * 12 + 18 : 0) + ruledH + 8;
            if (c.y - height < c.margins.bottom) c.ensure(Math.min(height, A4.height));

            c.page.drawText(numText, { x: c.left, y: c.y - 10, size: 10, font: fonts.bold, color: INK.body });
            const mW = fonts.regular.widthOfTextAtSize(marksText, 9.5);
            c.page.drawText(marksText, { x: c.right - mW, y: c.y - 10, size: 9.5, font: fonts.regular, color: INK.muted });
            stem.forEach((line, i) => {
                c.page.drawText(line, { x: c.left + numW, y: c.y - 10 - i * 14, size: 10, font: fonts.regular, color: INK.body });
            });
            c.y -= stem.length * 14;

            if (figure) {
                // Reserve and consume the SAME box the measurement above assumed. Advancing by
                // anything else is how a figure ends up drawn over the next question.
                drawFigure(
                    { page: c.page, font: fonts.regular, ink: INK.body, x: c.left + numW, y: c.y - FIGURE_HEIGHT },
                    figure,
                );
                c.y -= FIGURE_HEIGHT;
            }

            if (optionsFitTwoUp) {
                for (let r = 0; r < optionRows; r++) {
                    for (let col = 0; col < optionCols; col++) {
                        const opt = options[r * optionCols + col];
                        if (!opt) continue;
                        c.page.drawText(opt, {
                            x: c.left + numW + 10 + col * optionColW,
                            y: c.y - 9.5, size: 9.5, font: fonts.regular, color: INK.body,
                        });
                    }
                    c.y -= 13;
                }
            } else optionLines.forEach((line) => {
                c.page.drawText(line, { x: c.left + numW + 10, y: c.y - 9.5, size: 9.5, font: fonts.regular, color: INK.body });
                c.y -= 13;
            });

            if (ruledLines > 0) {
                // Measured with the question above, so this never triggers a break on its own - the
                // whole block was already guaranteed to fit before anything was drawn.
                c.y -= ANSWER_SPACE_TOP_PAD;
                for (let i = 0; i < ruledLines; i++) {
                    const y = c.y - i * ANSWER_LINE_GAP;
                    c.page.drawLine({
                        start: { x: c.left + numW, y },
                        end: { x: c.right, y },
                        thickness: 0.5,
                        color: RULE_INK,
                    });
                }
                c.y -= ruledLines * ANSWER_LINE_GAP;
            }

            if (answer) {
                const h = answerLines.length * 12 + 16;
                c.ensure(h);
                c.page.drawRectangle({ x: c.left + numW, y: c.y - h, width: c.contentWidth - numW, height: h, color: KEY_TINT });
                c.page.drawText('Answer', { x: c.left + numW + 8, y: c.y - 11, size: 7.5, font: fonts.bold, color: KEY_INK });
                answerLines.forEach((line, i) => {
                    c.page.drawText(line, { x: c.left + numW + 8, y: c.y - 22 - i * 12, size: 9, font: fonts.regular, color: INK.body });
                });
                c.y -= h;
            }

            c.gap(8);
        });

        c.gap(6);
    });

    stampFooter(
        doc, fonts,
        `${data.school?.name ?? 'School'} · ${data.title}${withAnswers ? ' · Answer Key' : ''} · Generated with Gurukul`,
        margins,
    );

    return doc.save();
}
