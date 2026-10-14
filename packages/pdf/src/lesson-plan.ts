import { PDFDocument } from 'pdf-lib';
import { isDrawablePuzzle } from '@repo/core/lessonplan/puzzle';
import { drawPuzzle } from './puzzle';
import { isDrawableDiagram, type DiagramSpec } from '@repo/core/diagram';
import { rgb } from 'pdf-lib';
import {
    INK, Cursor, loadFonts, centered, rule, spread, table, documentHeader, stampFooter, paragraph, embedRaster, centeredImage, safeText, wrap,
    type RowExtra, type Fonts,
} from './layout';
import { renderLessonPlanForm } from './lesson-plan-form';
import { drawDiagram, diagramHeightFor } from './diagram';
import { drawQuestionBlock, questionBlockHeight } from './print-questions';
import type { LessonPlanActivity, LessonPlanData, LessonPlanPrintPage, LessonPlanPrintPart, LessonPlanPrintQuestion, PrintQuestionSet } from './types';

/**
 * One lesson plan, as the sheet a teacher hands in.
 *
 * ## Why this is a document
 *
 * It carries two signature lines - the teacher's and the principal's or HOD's. A page with a
 * countersignature block on it is, by definition, something that gets signed, filed and produced
 * again later. It is also the artefact a supervisor reads during an observation.
 *
 * ## The bug in the version this replaces
 *
 * `handlePrint` did `document.body.appendChild(printRoot)` to hoist the preview out of the sheet
 * so `@media print` could show it. It never put the node back, so after one print the preview was
 * gone from the drawer and the second Print produced an empty page. Nothing here moves the DOM,
 * because nothing here is DOM.
 *
 * ## Empty sections are omitted, absent ones are not implied
 *
 * Objectives, materials and activities always render - a plan with no objectives is a plan someone
 * needs to see is incomplete, and hiding the heading would make it look finished. Homework, notes
 * and differentiation are genuinely optional and are dropped when unset.
 */

/**
 * The Time column, kept as a constant because it is also the diagram's indent.
 *
 * A diagram lines up with the ACTIVITY block it belongs to, leaving the time gutter clear the way
 * a question number's gutter is left clear on a paper. It cannot be indented to the Description
 * column instead: that starts 177pt in and `DIAGRAM_WIDTH` is 320, which overruns the right
 * margin of an A4 content column.
 */
const TIME_COLUMN = 0.11;

const ACTIVITY_COLUMNS = [
    // `gutterRight`: right-aligned and NOT the last column, so without it the cell ends
    // exactly where Activity begins - the sheet printed "TimeActivity" and
    // "10 minHop along the line".
    { header: 'Time', width: TIME_COLUMN, align: 'right' as const, gutterRight: 8 },
    { header: 'Activity', width: 0.25 },
    { header: 'Description', width: 0.46 },
    { header: "Bloom's", width: 0.18 },
];

/**
 * The Description cell: the say-aloud prose, then each written field under a label. Explicit
 * newlines are honoured by the table's wrapper, which is what makes the labels sit on their own
 * lines. A plan from before the writer has only `description`, and prints exactly as it did.
 */
function printedDescription(a: LessonPlanActivity): string {
    const parts: string[] = [a.description];
    const board = (a.board ?? []).filter((l) => typeof l === 'string' && l.trim());
    if (board.length > 0) parts.push(`On the board:\n${board.map((l) => `  ${l}`).join('\n')}`);
    if (a.example?.trim()) parts.push(`Worked example:\n${a.example.trim()}`);
    if (a.askTheClass?.trim()) parts.push(`Ask the class: ${a.askTheClass.trim()}`);
    if (a.listenFor?.trim()) parts.push(`Listen for: ${a.listenFor.trim()}`);
    return parts.filter(Boolean).join('\n\n');
}

/** Ruled lines under a written answer, sized to the model answer, never fewer than one. */
const LINE_GAP = 18;
const BOX = 9;

/**
 * The example, shaped or plain. A table draws as a table with its last row tinted, equations as a
 * left-aligned run with the last line bold, steps numbered; plain text prints as it was written.
 */
function printExample(c: Cursor, fonts: Fonts, page: LessonPlanPrintPage): void {
    const layout = page.exampleLayout;
    if (!layout) { paragraph(c, page.example, { size: 10, after: 4 }); return; }
    if (layout.kind === 'steps') {
        for (const [i, st] of layout.steps.entries()) paragraph(c, `${i + 1}. ${st}`, { size: 10, bold: i === layout.steps.length - 1 && layout.steps.length > 2, after: 2 });
        c.gap(2);
        return;
    }
    if (layout.kind === 'equations') {
        for (const [i, l] of layout.lines.entries()) paragraph(c, l, { size: 10, bold: i === layout.lines.length - 1, after: 2 });
        c.gap(2);
        return;
    }
    const cols = layout.columns.length;
    const colW = c.contentWidth / cols;
    const rowH = 15;
    c.ensure(rowH * (layout.rows.length + 1) + 6);
    let y = c.y;
    for (const [i, col] of layout.columns.entries()) {
        c.page.drawText(safeText(col), { x: c.left + i * colW + 4, y: y - 10, size: 8, font: fonts.bold, color: INK.muted });
    }
    y -= rowH;
    c.page.drawLine({ start: { x: c.left, y: y + 3 }, end: { x: c.right, y: y + 3 }, thickness: 0.5, color: INK.rule });
    for (const [ri, row] of layout.rows.entries()) {
        const last = ri === layout.rows.length - 1 && layout.rows.length > 1;
        if (last) c.page.drawRectangle({ x: c.left, y: y - rowH + 3, width: c.contentWidth, height: rowH, color: rgb(0.98, 0.95, 0.88) });
        for (const [ci, cell] of row.entries()) {
            c.page.drawText(safeText(cell), { x: c.left + ci * colW + 4, y: y - 10, size: 9.5, font: last ? fonts.bold : fonts.regular, color: INK.body });
        }
        y -= rowH;
    }
    c.y = y - 4;
}

/**
 * One question on paper.
 *
 * On a lesson page it is READ: the text, its options, its note. On a class copy it is WRITTEN ON:
 * a box per option, ruled lines for a written answer sized to the model answer, a box with its unit
 * for a number, an underlined gap for a blank, two circles for true or false, two columns with a
 * line between to match, numbered boxes to put in order. Nothing here is a form field; a school
 * photocopies these.
 */
function printQuestion(c: Cursor, fonts: Fonts, q: LessonPlanPrintQuestion, n: number, worksheet: boolean, answers: boolean): void {
    c.ensure(40);
    paragraph(c, `${n}. ${q.type === 'FILL' ? q.question.replace(/_{3,}/g, '________________') : q.question}`, { size: 10, after: 2 });
    const x0 = c.left + 18;

    if (q.type === 'MCQ' || q.type === 'SELECT') {
        for (const [oi, o] of q.options.entries()) {
            const lines = wrap(fonts.regular, `${String.fromCharCode(65 + oi)}. ${o}`, 9.5, c.contentWidth - 18 - BOX - 8);
            c.ensure(lines.length * 13 + 2);
            if (worksheet) c.page.drawRectangle({ x: x0, y: c.y - 10, width: BOX, height: BOX, borderWidth: 0.6, borderColor: INK.body });
            for (const [li, line] of lines.entries()) {
                c.page.drawText(safeText(line), { x: x0 + (worksheet ? BOX + 6 : 0), y: c.y - 9.5 - li * 13, size: 9.5, font: fonts.regular, color: INK.body });
            }
            c.y -= lines.length * 13;
        }
    } else if (q.type === 'TRUE_FALSE') {
        c.ensure(16);
        let x = x0;
        for (const label of ['True', 'False']) {
            if (worksheet) c.page.drawCircle({ x: x + 5, y: c.y - 6, size: 5, borderWidth: 0.6, borderColor: INK.body });
            c.page.drawText(label, { x: x + (worksheet ? 14 : 0), y: c.y - 9.5, size: 9.5, font: fonts.regular, color: INK.body });
            x += 70;
        }
        c.y -= 16;
    } else if (q.type === 'NUMERIC') {
        if (worksheet) {
            c.ensure(24);
            c.page.drawRectangle({ x: x0, y: c.y - 20, width: 90, height: 18, borderWidth: 0.6, borderColor: INK.body });
            if (q.unit) c.page.drawText(safeText(q.unit), { x: x0 + 96, y: c.y - 14, size: 9.5, font: fonts.regular, color: INK.muted });
            c.y -= 24;
        }
    } else if (q.type === 'MATCH' && q.match) {
        const half = (c.contentWidth - 18) / 2;
        const rows = Math.max(q.match.left.length, q.match.right.length);
        c.ensure(rows * 14 + 4);
        for (let i = 0; i < rows; i += 1) {
            const l = q.match.left[i];
            const r = q.match.right[i];
            if (l !== undefined) c.page.drawText(safeText(`${i + 1}. ${l}`), { x: x0, y: c.y - 10, size: 9.5, font: fonts.regular, color: INK.body });
            if (worksheet) c.page.drawLine({ start: { x: x0 + half - 40, y: c.y - 7 }, end: { x: x0 + half - 4, y: c.y - 7 }, thickness: 0.4, color: INK.rule });
            if (r !== undefined) c.page.drawText(safeText(`${String.fromCharCode(65 + i)}. ${r}`), { x: x0 + half, y: c.y - 10, size: 9.5, font: fonts.regular, color: INK.body });
            c.y -= 14;
        }
        c.gap(2);
    } else if (q.type === 'ORDER' && q.items) {
        const lines = q.items.map((it, i) => `${String.fromCharCode(65 + i)}. ${it}`);
        for (const line of lines) paragraph(c, line, { size: 9.5, after: 1 });
        if (worksheet) {
            c.ensure(22);
            c.page.drawText('Order:', { x: x0, y: c.y - 14, size: 9, font: fonts.regular, color: INK.muted });
            let x = x0 + 40;
            for (let i = 0; i < q.items.length; i += 1) {
                c.page.drawRectangle({ x, y: c.y - 19, width: 18, height: 16, borderWidth: 0.6, borderColor: INK.body });
                x += 24;
            }
            c.y -= 22;
        }
    }

    if (q.note && !worksheet) paragraph(c, q.note, { size: 8.5, color: INK.muted, after: 2 });
    if (worksheet && q.type === 'NUMERIC' && q.unit) { /* the unit is beside the box */ }

    // The lines a written answer needs, on the class copy only.
    if (worksheet && (q.type === 'SHORT' || (q.type === 'FILL' && q.lines > 1))) {
        c.ensure(q.lines * LINE_GAP + 4);
        for (let i = 0; i < q.lines; i += 1) {
            c.page.drawLine({ start: { x: x0, y: c.y - LINE_GAP * (i + 1) + 4 }, end: { x: c.right, y: c.y - LINE_GAP * (i + 1) + 4 }, thickness: 0.4, color: INK.rule });
        }
        c.y -= q.lines * LINE_GAP + 2;
    }

    if (answers && q.answer) paragraph(c, `Answer: ${q.answer}`, { size: 9.5, bold: true, after: 1 });
    if (answers && q.why) paragraph(c, q.why, { size: 8.5, color: INK.muted, after: 2 });
    c.gap(3);
}

/** One content page on paper: a titled block with its parts under small labels. */
async function printContentPage(
    c: Cursor, fonts: Awaited<ReturnType<typeof loadFonts>>, doc: PDFDocument,
    page: LessonPlanPrintPage, n: number, total: number, answers: boolean, questionsOnly: boolean,
): Promise<void> {
    c.gap(8);
    c.ensure(48);
    c.page.drawText(`${page.kindLabel.toUpperCase()} · ${questionsOnly ? `SET ${n} OF ${total}` : `PAGE ${n} OF ${total}`}${page.minutes && !questionsOnly ? ` · ${page.minutes} MIN` : ''}`, { x: c.left, y: c.y, size: 7.5, font: fonts.bold, color: INK.muted });
    c.y -= 12;
    paragraph(c, page.title, { size: 12.5, bold: true, after: 4 });
    if (page.lead) paragraph(c, page.lead, { size: 10.5, after: 5 });
    for (const p of page.points) paragraph(c, `- ${p}`, { size: 10, after: 2 });
    if (page.terms.length > 0) {
        c.gap(3);
        for (const t of page.terms) paragraph(c, `${t.term}: ${t.meaning}`, { size: 10, after: 2 });
    }
    if (page.example || page.exampleLayout) {
        c.gap(3);
        paragraph(c, page.kindLabel === 'Worked example' ? 'Worked solution' : 'Example', { size: 8, bold: true, color: INK.muted, after: 2 });
        printExample(c, fonts, page);
    }
    if (page.questions.length > 0) {
        c.gap(3);
        // The answers print ONLY on the teacher's copy; the route omits them from every other
        // request, so a class copy cannot carry one however this is called.
        for (const [i, q] of page.questions.entries()) printQuestion(c, fonts, q, i + 1, questionsOnly, answers && !questionsOnly);
    }
    if (page.summary.length > 0) {
        c.gap(3);
        for (const [i, l] of page.summary.entries()) paragraph(c, `${i + 1}. ${l}`, { size: 10, after: 2 });
    }
    // A video on paper is its title and the questions around it; the link is on the plan page.
    if (page.video && !questionsOnly) {
        c.gap(3);
        paragraph(c, `Watch: ${page.video.title}${page.video.duration ? ` (${page.video.duration})` : ''}${page.video.channel ? ` - ${page.video.channel}` : ''}`, { size: 9.5, bold: true, after: 2 });
        for (const [i, q] of page.video.before.entries()) paragraph(c, `Before ${i + 1}. ${q}`, { size: 9.5, after: 1 });
        if (page.video.after) paragraph(c, `After. ${page.video.after}`, { size: 9.5, after: 2 });
    }
    if (isDrawableDiagram(page.diagram)) {
        const spec: DiagramSpec = page.diagram;
        const h = diagramHeightFor(spec);
        if (h > 0) {
            c.ensure(DIAGRAM_PAD_TOP + h + DIAGRAM_PAD_BOTTOM);
            drawDiagram({ page: c.page, font: fonts.regular, ink: INK.body, x: c.left + TIME_COLUMN * c.contentWidth, y: c.y - DIAGRAM_PAD_TOP - h }, spec);
            c.y -= DIAGRAM_PAD_TOP + h + DIAGRAM_PAD_BOTTOM;
        }
    }
    // The generated picture. The bytes arrive with the payload - see `LessonPlanPrintFigure` for
    // why - so nothing here touches the network and a page whose figure could not be fetched has
    // simply arrived without one. The text above it is untouched either way.
    //
    // Never on a class copy: `questionsOnly` is the student's cut-down sheet, which is photocopied
    // per head, and a full-width raster on forty copies is a toner bill, not a teaching aid.
    if (page.figure && !questionsOnly) {
        const embedded = await embedRaster(doc, page.figure.data, page.figure.mime);
        if (embedded) {
            c.gap(4);
            centeredImage(c, embedded, c.contentWidth, page.figure.caption ? 2 : 8, FIGURE_MAX_HEIGHT);
            if (page.figure.caption) paragraph(c, page.figure.caption, { size: 8.5, color: INK.muted, after: 6 });
        }
    }
    c.gap(4);
    rule(c, 0.5, INK.rule, 6);
}

/**
 * The header of a class copy: what the student fills in before the first question. Name, roll,
 * class and section, date. Drawn as labelled lines, because a photocopied sheet is written on with
 * a pen and a blank with no label gets left blank.
 */
function worksheetHeader(c: Cursor, fonts: Fonts, title: string, className: string): void {
    c.ensure(50);
    paragraph(c, title, { size: 11, bold: true, after: 8 });
    const y = c.y - 10;
    const w = c.contentWidth;
    const field = (label: string, x: number, width: number, value?: string) => {
        // The label sits on the baseline; the line runs after it, four points lower, so the two
        // never touch even at a photocopier's resolution.
        c.page.drawText(label, { x, y: y + 2, size: 8.5, font: fonts.regular, color: INK.muted });
        const lx = x + fonts.regular.widthOfTextAtSize(label, 8.5) + 8;
        c.page.drawLine({ start: { x: lx, y: y - 3 }, end: { x: x + width, y: y - 3 }, thickness: 0.5, color: INK.body });
        if (value) c.page.drawText(safeText(value), { x: lx + 4, y: y + 1, size: 9.5, font: fonts.regular, color: INK.body });
    };
    field('Name', c.left, w * 0.46);
    field('Roll', c.left + w * 0.5, w * 0.16);
    field('Class', c.left + w * 0.7, w * 0.3, className);
    c.y -= 22;
    field('Date', c.left, w * 0.3);
    field('Section', c.left + w * 0.5, w * 0.2);
    c.y -= 26;
    rule(c, 0.5, INK.rule, 8);
}

/** The answer key, on its own page at the end of the teacher's copy. */
function answerKey(c: Cursor, pages: LessonPlanPrintPage[]): void {
    c.newPage();
    paragraph(c, 'Answer key', { size: 13, bold: true, after: 2 });
    paragraph(c, 'For the teacher. The pages before this are the class copy.', { size: 9, color: INK.muted, after: 8 });
    for (const [pi, page] of pages.entries()) {
        c.ensure(30);
        paragraph(c, `${page.kindLabel} ${pi + 1} · ${page.title}`, { size: 9.5, bold: true, after: 3 });
        for (const [i, q] of page.questions.entries()) {
            paragraph(c, `${i + 1}. ${q.answer ?? '-'}`, { size: 9.5, after: 1 });
            if (q.why) paragraph(c, q.why, { size: 8.5, color: INK.muted, after: 2 });
        }
        c.gap(6);
    }
}

/** Air above and below a diagram, so it does not touch the row text or the rule under it. */
const DIAGRAM_PAD_TOP = 8;
const DIAGRAM_PAD_BOTTOM = 6;

/**
 * The tallest a generated figure may print, in points.
 *
 * The width bound is the content column, which is what the page wants. The HEIGHT bound is the one
 * that matters: every figure the generator produces is square (1024x1024 measured on the live
 * rows), so bounding width alone gives a 475pt picture - two thirds of the printable height of an
 * A4 page - and the page's own text is pushed onto the next sheet. 300pt is about 4.2 inches, big
 * enough to read a label on and small enough that a page still fits its picture and its words.
 */
const FIGURE_MAX_HEIGHT = 300;

/** A titled block with the same rule-under-heading the print sheet used. */
function section(c: Cursor, title: string): void {
    c.gap(4);
    c.ensure(20);
    c.page.drawText(title.toUpperCase(), {
        x: c.left, y: c.y, size: 8.5, font: c.fonts.bold, color: INK.muted,
    });
    c.y -= 6;
    rule(c, 0.5, INK.rule, 8);
}

export async function renderLessonPlan(data: LessonPlanData): Promise<Uint8Array> {
    // The eleven-section form is its own document: a different layout, a different reader.
    if (data.part === 'form' && data.form) return renderLessonPlanForm(data, data.form);

    const doc = await PDFDocument.create();
    const fonts = await loadFonts(doc);
    const c = new Cursor(doc, fonts, { top: 52, right: 52, bottom: 56, left: 52 });

    await documentHeader(c, doc, {
        school: { ...data.school, email: null },
        badge: {
            label: 'LESSON PLAN',
            ref: data.date,
            lines: [`${data.subject} - Class ${data.className}`],
        },
    });

    c.gap(6);
    spread(c,
        { label: 'Subject', value: data.subject },
        { label: 'Class', value: data.className });
    spread(c,
        { label: 'Topic', value: data.topic },
        { label: 'Duration', value: `${data.durationMinutes} min` });
    spread(c,
        { label: 'Teacher', value: data.teacherName ?? '-' },
        { label: "Bloom's level", value: data.bloomsLabel ?? '-' });
    if (data.unitLabel || data.lessonLabel) {
        spread(c,
            { label: 'Unit', value: data.unitLabel ?? '-' },
            { label: 'Lesson', value: data.lessonLabel ?? '-' });
    }
    c.gap(10);
    rule(c, 0.75, INK.rule, 12);

    // ── Objectives ───────────────────────────────────────────────────────────────────────
    section(c, 'Learning objectives');
    if (data.objectives.length === 0) {
        paragraph(c, 'No objectives recorded.', { size: 9.5, color: INK.muted, after: 6 });
    } else {
        for (const [i, o] of data.objectives.entries()) {
            paragraph(c, `${i + 1}. ${o}`, { size: 10, after: 3 });
        }
    }

    // ── Materials ────────────────────────────────────────────────────────────────────────
    section(c, 'Materials required');
    paragraph(c, data.materials.length > 0 ? data.materials.join(' - ') : 'None listed.', {
        size: 10, color: data.materials.length > 0 ? INK.body : INK.muted, after: 6,
    });

    // ── A v2 plan: the content pages, and nothing for the teacher ──────────────────────
    // The sheet a teacher hands in or a student reads. The teacher layer (what to say, what to
    // ask and the answer, what to listen for, the board plan) lives on the plan page's right tab
    // and is deliberately not printable here; the check questions print without their answers.
    if (data.pages && data.pages.length > 0) {
        const part: LessonPlanPrintPart = data.part ?? 'lesson';
        const wanted = part === 'lesson' || part === 'form' ? data.pages
            : data.pages.filter((p) => (part.startsWith('check') ? p.kind === 'CHECK' : p.kind === 'PRACTICE'));
        const answers = part.endsWith('-answers');
        /*
         * A `-answers` part is the CLASS COPY followed by the answer key on its own last page. It
         * used to print the answers inline under every question, which was a sheet nobody could
         * hand out; now the teacher's copy is the same paper the class gets, plus the key, so one
         * print serves both jobs and the key can be torn off.
         */
        if (part !== 'lesson') {
            c.gap(4);
            worksheetHeader(c, fonts, `${part.startsWith('check') ? 'Check' : 'Practice'} · ${data.topic}`, data.className);
        }
        if (wanted.length === 0) paragraph(c, 'This plan has no pages of that kind.', { size: 10, color: INK.muted, after: 6 });
        for (const [i, page] of wanted.entries()) await printContentPage(c, fonts, doc, page, i + 1, wanted.length, false, part !== 'lesson');
        if (answers) answerKey(c, wanted);
        c.gap(26);
        c.ensure(40);
        const half = c.contentWidth / 2 - 20;
        for (const [i, label] of ['Teacher signature', 'Principal / HOD signature'].entries()) {
            const x = i === 0 ? c.left : c.right - half;
            c.page.drawLine({ start: { x, y: c.y }, end: { x: x + half, y: c.y }, thickness: 0.5, color: INK.rule });
            c.page.drawText(label, { x, y: c.y - 10, size: 8, font: fonts.regular, color: INK.muted });
        }
        c.y -= 24;
        stampFooter(doc, fonts, `Lesson plan - ${data.generatedOn}`);
        return doc.save();
    }

    // ── Activities ───────────────────────────────────────────────────────────────────────
    section(c, 'Activities');
    if (data.activities.length === 0) {
        paragraph(c, 'No activities recorded.', { size: 9.5, color: INK.muted, after: 6 });
    } else {
        const indent = TIME_COLUMN * c.contentWidth;
        table(c, ACTIVITY_COLUMNS,
            data.activities.map((a) => [
                `${a.durationMinutes} min`,
                a.activity,
                printedDescription(a),
                a.bloomsLabel ?? '-',
            ]),
            {
                repeatHeader: true,
                size: 9,
                // The diagram for THIS step, drawn under its own row rather than collected at the
                // end: a figure separated from the activity it illustrates is a picture the
                // teacher has to match up by hand while teaching.
                //
                // `diagramHeightFor` is the only source of the height, and `table` reserves it
                // WITH the row before drawing either, so a diagram can never be split by a page
                // break or spill past the bottom margin - where pdf-lib draws it silently and the
                // reader gets a blank space. The stored value is `unknown`, so the same
                // `isDrawableDiagram` the screen uses decides: a spec it refuses reserves nothing
                // and draws nothing, and the rest of the activity is untouched.
                rowExtra: (i): RowExtra | null => {
                    const spec: unknown = data.activities[i]?.diagram;
                    if (!isDrawableDiagram(spec)) return null;
                    const figure: DiagramSpec = spec;
                    const drawn = diagramHeightFor(figure);
                    if (drawn <= 0) return null;
                    return {
                        height: DIAGRAM_PAD_TOP + drawn + DIAGRAM_PAD_BOTTOM,
                        draw: (page, top) => drawDiagram(
                            {
                                page, font: fonts.regular, ink: INK.body,
                                x: c.left + indent,
                                y: top - DIAGRAM_PAD_TOP - drawn,
                            },
                            figure,
                        ),
                    };
                },
            },
        );
        c.gap(6);
    }

    // ── The check and the homework, as QUESTIONS with their answers ──────────────────────
    // This is the teacher's sheet, so the answers are on it. The class set (no answers, one
    // strip per student) is `check-sheet.ts`. When the plan has generated rows the sentences the
    // first pass wrote are superseded and not printed twice.
    const questionSet = (set: PrintQuestionSet, title: string) => {
        section(c, title);
        for (const q of set.questions) {
            const h = questionBlockHeight(fonts, q, c.contentWidth, true);
            c.ensure(h);
            c.y -= drawQuestionBlock(c.page, fonts, q, { x: c.left, top: c.y, width: c.contentWidth, withAnswers: true });
        }
        c.gap(4);
    };

    // The puzzle goes on the TEACHER's sheet with its answer shown. This is the copy that stays on
    // the desk, so the solution belongs on it; the class set comes off the check sheet and the deck,
    // neither of which draws an answer.
    if (isDrawablePuzzle(data.puzzle)) {
        section(c, 'Puzzle');
        c.y -= drawPuzzle({
            page: c.page, font: fonts.regular, bold: fonts.bold,
            x: c.left, y: c.y, width: c.contentWidth, showSolution: true,
        }, data.puzzle);
        c.gap(6);
    }

    if (data.check && data.check.questions.length > 0) {
        questionSet(data.check, 'Check - end of the period');
    } else {
        section(c, 'Assessment strategy');
        paragraph(c, data.assessment?.trim() || 'Not recorded.', {
            size: 10, color: data.assessment?.trim() ? INK.body : INK.muted, after: 6,
        });
    }

    if (data.homeworkQuestions && data.homeworkQuestions.questions.length > 0) {
        questionSet(data.homeworkQuestions, 'Homework');
    } else if (data.homework?.trim()) {
        section(c, 'Homework / assignment');
        paragraph(c, data.homework.trim(), { size: 10, after: 6 });
    }

    if (data.differentiationSupport?.trim() || data.differentiationStretch?.trim()) {
        section(c, 'Differentiation');
        if (data.differentiationSupport?.trim()) {
            paragraph(c, `Support: ${data.differentiationSupport.trim()}`, { size: 10, after: 4 });
        }
        if (data.differentiationStretch?.trim()) {
            paragraph(c, `Stretch: ${data.differentiationStretch.trim()}`, { size: 10, after: 4 });
        }
    }

    if (data.notes?.trim()) {
        section(c, 'Teacher notes');
        paragraph(c, data.notes.trim(), { size: 10, after: 6 });
    }

    // ── Signatures ───────────────────────────────────────────────────────────────────────
    // `ensure` for the whole block, not per line: a countersignature block split across a page
    // break leaves a sheet whose last page is two lines and a date, which reads as a printing
    // fault rather than a document.
    c.gap(26);
    c.ensure(40);
    const half = c.contentWidth / 2 - 20;
    for (const [i, label] of ['Teacher signature', 'Principal / HOD signature'].entries()) {
        const x = i === 0 ? c.left : c.right - half;
        c.page.drawLine({
            start: { x, y: c.y }, end: { x: x + half, y: c.y },
            thickness: 0.5, color: INK.rule,
        });
        c.page.drawText(label, { x, y: c.y - 10, size: 8, font: fonts.regular, color: INK.muted });
    }
    c.y -= 24;

    stampFooter(doc, fonts, `Lesson plan - ${data.generatedOn}`);
    return doc.save();
}
