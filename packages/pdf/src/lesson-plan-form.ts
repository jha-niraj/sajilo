import { PDFDocument } from 'pdf-lib';
import {
    INK, Cursor, loadFonts, rule, paragraph, documentHeader, stampFooter, fieldTable,
    nepaliOrEnglish, NO_DEVANAGARI_NOTICE, type Fonts,
} from './layout';
import type { LessonPlanData, LessonPlanFormData } from './types';

/**
 * The पाठ योजना: the eleven-section lesson plan form a head teacher signs and an inspector reads.
 *
 * ## Why a separate document
 *
 * The plan sheet is the teacher's working document, pages in order with pictures. The FORM is the
 * paper the office keeps: general information, aims, specific objectives, materials, previous
 * knowledge, introduction, presentation, comprehension questions, blackboard summary, evaluation,
 * homework, then two signatures. Same plan, different reader, different order - so it is drawn
 * here and not squeezed into the sheet.
 *
 * ## The Nepali headings
 *
 * Every section carries its Nepali name with the English beside it, because that is how the form
 * is known. They are drawn ONLY when a Unicode face is embedded (`fonts.unicode`): on the standard
 * face Devanagari falls back to "???", and a heading of question marks on a signed document is
 * worse than an English-only heading. The layout is the standard CDC one; province headings can
 * be added as a variant later.
 *
 * ## When there is no Nepali face, the form SAYS SO
 *
 * That fallback used to be silent, and it was not a theoretical state: the two variables that
 * configure the font (`PDF_FONT_REGULAR_URL`, `PDF_FONT_BOLD_URL`) were read by `apps/services`
 * and set nowhere in the repo, so every पाठ योजना printed in production came out fully in English
 * and looked deliberate. An inspector cannot tell that document from a correct one, and neither
 * could we. So the form now carries `NO_DEVANAGARI_NOTICE` on its first page whenever it falls
 * back. See `nepaliOrEnglish` in `layout.ts` for why a notice and not a refusal.
 */

const SECTIONS: { ne: string; en: string }[] = [
    { ne: 'सामान्य जानकारी', en: 'General information' },
    { ne: 'उद्देश्य', en: 'Aims' },
    { ne: 'विशिष्ट उद्देश्य', en: 'Specific objectives' },
    { ne: 'शैक्षिक सामग्री', en: 'Teaching materials' },
    { ne: 'पूर्व ज्ञान', en: 'Previous knowledge' },
    { ne: 'प्रस्तावना', en: 'Introduction' },
    { ne: 'प्रस्तुतीकरण', en: 'Presentation' },
    { ne: 'बोधात्मक प्रश्न', en: 'Comprehension questions' },
    { ne: 'कालोपाटी सारांश', en: 'Blackboard summary' },
    { ne: 'मूल्याङ्कन', en: 'Evaluation' },
    { ne: 'गृहकार्य', en: 'Homework' },
];

function heading(c: Cursor, fonts: Fonts, n: number): void {
    const sec = SECTIONS[n - 1]!;
    c.gap(6);
    c.ensure(30);
    // `nepaliOrEnglish` rather than an inline ternary so the downgrade is a value the document can
    // act on, not a decision that disappears into a string.
    const chosen = nepaliOrEnglish(fonts, sec.ne, sec.en);
    const label = `${n}. ${chosen.text}`;
    c.page.drawText(label, { x: c.left, y: c.y - 11, size: 11, font: fonts.bold, color: INK.body });
    if (chosen.usedNepali) {
        const w = fonts.bold.widthOfTextAtSize(label, 11);
        c.page.drawText(sec.en, { x: c.left + w + 8, y: c.y - 11, size: 8.5, font: fonts.regular, color: INK.muted });
    }
    c.y -= 16;
    rule(c, 0.4, INK.rule, 6);
}

function list(c: Cursor, items: string[], empty: string): void {
    if (items.length === 0) { paragraph(c, empty, { size: 9.5, color: INK.muted, after: 4 }); return; }
    for (const [i, it] of items.entries()) paragraph(c, `${i + 1}. ${it}`, { size: 10, after: 2 });
    c.gap(2);
}

export async function renderLessonPlanForm(data: LessonPlanData, form: LessonPlanFormData): Promise<Uint8Array> {
    const doc = await PDFDocument.create();
    const fonts = await loadFonts(doc);
    const c = new Cursor(doc, fonts, { top: 52, right: 52, bottom: 60, left: 52 });

    const title = nepaliOrEnglish(fonts, 'पाठ योजना \u00b7 LESSON PLAN', 'LESSON PLAN FORM');

    await documentHeader(c, doc, {
        school: { ...data.school, email: null },
        badge: {
            label: title.text,
            ref: form.date,
            lines: [`${data.subject} - Class ${data.className}${form.section ? ` ${form.section}` : ''}`],
        },
    });

    // The one line that stops an English fallback from reading as a deliberate English form. It
    // goes at the top, above the first section, because that is where somebody checking the form
    // against the CDC layout starts looking for the Nepali headings they expected.
    if (!title.usedNepali) {
        paragraph(c, NO_DEVANAGARI_NOTICE, { size: 8, color: INK.muted, after: 6 });
        rule(c, 0.4, INK.rule, 4);
    }

    // 1. General information
    heading(c, fonts, 1);
    fieldTable(c, [
        { label: 'School', value: data.school.name },
        { label: 'Subject', value: data.subject },
        { label: 'Class', value: `${data.className}${form.section ? ` ${form.section}` : ''}` },
        { label: 'Unit', value: data.unitLabel ?? '-' },
        { label: 'Lesson', value: data.lessonLabel ?? data.topic },
        { label: 'Topic', value: data.topic },
        { label: 'Date', value: form.date },
        { label: 'Period', value: form.periodLabel ?? '-' },
        { label: 'Time', value: `${data.durationMinutes} minutes` },
        { label: 'Teacher', value: form.teacherName ?? '-' },
    ], { size: 9.5, labelWidth: 90 });

    heading(c, fonts, 2);
    list(c, form.aims, 'No aims recorded.');

    heading(c, fonts, 3);
    list(c, form.specificObjectives, 'No objectives recorded.');

    heading(c, fonts, 4);
    paragraph(c, form.materials.length > 0 ? form.materials.join(', ') : 'Textbook, exercise book, blackboard and chalk.', { size: 10, after: 4 });

    heading(c, fonts, 5);
    paragraph(c, form.previousKnowledge || '-', { size: 10, after: 4 });

    heading(c, fonts, 6);
    paragraph(c, form.introduction || '-', { size: 10, after: 4 });

    heading(c, fonts, 7);
    if (form.presentation.length === 0) {
        paragraph(c, 'No pages written yet.', { size: 9.5, color: INK.muted, after: 4 });
    } else {
        const stepW = 150;
        const minW = 44;
        const whatW = c.contentWidth - stepW - minW;
        for (const [i, row] of form.presentation.entries()) {
            const stepLines = wrapText(fonts, `${i + 1}. ${row.step}`, 9.5, stepW - 8);
            const whatLines = wrapText(fonts, row.what, 9.5, whatW - 8);
            const h = Math.max(stepLines.length, whatLines.length) * 12.5 + 8;
            c.ensure(h);
            const top = c.y;
            stepLines.forEach((l, li) => c.page.drawText(l, { x: c.left, y: top - 10 - li * 12.5, size: 9.5, font: fonts.bold, color: INK.body }));
            whatLines.forEach((l, li) => c.page.drawText(l, { x: c.left + stepW, y: top - 10 - li * 12.5, size: 9.5, font: fonts.regular, color: INK.body }));
            c.page.drawText(`${row.minutes} min`, { x: c.left + stepW + whatW + 4, y: top - 10, size: 9, font: fonts.regular, color: INK.muted });
            c.y = top - h;
            c.page.drawLine({ start: { x: c.left, y: c.y + 3 }, end: { x: c.right, y: c.y + 3 }, thickness: 0.3, color: INK.rule });
        }
        c.gap(4);
    }

    heading(c, fonts, 8);
    if (form.comprehension.length === 0) {
        paragraph(c, 'No questions recorded.', { size: 9.5, color: INK.muted, after: 4 });
    } else {
        for (const [i, qa] of form.comprehension.entries()) {
            paragraph(c, `${i + 1}. ${qa.question}`, { size: 10, after: 1 });
            if (qa.answer) paragraph(c, `Answer: ${qa.answer}`, { size: 9, color: INK.muted, after: 3 });
        }
    }

    heading(c, fonts, 9);
    if (form.boardSummary.length === 0) {
        paragraph(c, 'Nothing set down for the board.', { size: 9.5, color: INK.muted, after: 4 });
    } else {
        for (const line of form.boardSummary) paragraph(c, line, { size: 10, after: 2 });
        c.gap(2);
    }

    heading(c, fonts, 10);
    list(c, form.evaluation, 'No check questions written.');

    heading(c, fonts, 11);
    paragraph(c, form.homework || '-', { size: 10, after: 4 });

    // Signatures. The teacher's and the head's, with a line for the date under each.
    c.gap(28);
    c.ensure(50);
    const half = c.contentWidth / 2 - 20;
    for (const [i, label] of [`Teacher${form.teacherName ? `: ${form.teacherName}` : ''}`, `Head teacher${form.headName ? `: ${form.headName}` : ''}`].entries()) {
        const x = c.left + i * (half + 40);
        c.page.drawLine({ start: { x, y: c.y }, end: { x: x + half, y: c.y }, thickness: 0.5, color: INK.body });
        c.page.drawText(label, { x, y: c.y - 12, size: 9, font: fonts.regular, color: INK.muted });
        c.page.drawText('Date: ______________', { x, y: c.y - 24, size: 8.5, font: fonts.regular, color: INK.faint });
    }

    stampFooter(doc, fonts, `Lesson plan form - ${data.topic}`);
    return doc.save();
}

function wrapText(fonts: Fonts, text: string, size: number, width: number): string[] {
    const words = text.split(/\s+/).filter(Boolean);
    const out: string[] = [];
    let line = '';
    for (const w of words) {
        const next = line ? `${line} ${w}` : w;
        if (fonts.regular.widthOfTextAtSize(next, size) <= width) line = next;
        else { if (line) out.push(line); line = w; }
    }
    if (line) out.push(line);
    return out.length ? out : [''];
}
