import { PDFDocument } from 'pdf-lib';
import { A4, INK, loadFonts, safeText, stampFooter, type Fonts } from './layout';
import { drawQuestionBlock, questionBlockHeight } from './print-questions';
import type { CheckSheetData } from './types';

/**
 * The class set of a check or a homework: one strip per student, no answers, a name line.
 *
 * Two strips per A4 when the questions fit in half a page - a three-question check always does -
 * with a dashed cut line between them, so one sheet through the photocopier serves two desks.
 * A longer homework falls back to one per page. The decision is measured, not assumed.
 */

const MARGIN = 36;
const HEADER_H = 58;

function stripHeight(fonts: Fonts, data: CheckSheetData, width: number): number {
    return HEADER_H + data.set.questions.reduce((s, q) => s + questionBlockHeight(fonts, q, width, false), 0) + 12;
}

function drawStrip(page: import('pdf-lib').PDFPage, fonts: Fonts, data: CheckSheetData, top: number, width: number): void {
    let y = top;
    page.drawText(safeText(data.school.name), { x: MARGIN, y: y - 12, size: 11, font: fonts.bold, color: INK.body });
    const meta = safeText(`${data.set.title} - ${data.subject} - Class ${data.className} - ${data.date}`);
    page.drawText(meta, { x: MARGIN, y: y - 26, size: 9, font: fonts.regular, color: INK.muted });
    y -= 40;

    // Name and roll: written by the student, read by the phone scanner's teacher.
    const nameLabel = 'Name';
    const rollLabel = 'Roll';
    page.drawText(nameLabel, { x: MARGIN, y: y - 9, size: 9, font: fonts.regular, color: INK.muted });
    page.drawLine({ start: { x: MARGIN + 30, y: y - 11 }, end: { x: MARGIN + width * 0.62, y: y - 11 }, thickness: 0.5, color: INK.body });
    page.drawText(rollLabel, { x: MARGIN + width * 0.68, y: y - 9, size: 9, font: fonts.regular, color: INK.muted });
    page.drawLine({ start: { x: MARGIN + width * 0.68 + 24, y: y - 11 }, end: { x: MARGIN + width, y: y - 11 }, thickness: 0.5, color: INK.body });
    y -= 18;

    for (const q of data.set.questions) {
        y -= drawQuestionBlock(page, fonts, q, { x: MARGIN, top: y, width, withAnswers: false });
    }
}

export async function renderCheckSheet(data: CheckSheetData): Promise<Uint8Array> {
    const doc = await PDFDocument.create();
    doc.setTitle(`${data.set.title} - Class ${data.className}`);
    const fonts = await loadFonts(doc);
    const width = A4.width - MARGIN * 2;
    const strip = stripHeight(fonts, data, width);
    const half = A4.height / 2;
    const twoUp = strip <= half - MARGIN;
    const copies = Math.max(1, Math.min(200, Math.round(data.copies)));

    let printed = 0;
    while (printed < copies) {
        const page = doc.addPage([A4.width, A4.height]);
        drawStrip(page, fonts, data, A4.height - MARGIN, width);
        printed += 1;
        if (twoUp && printed < copies) {
            // The cut line, dashed, exactly at the fold.
            page.drawLine({
                start: { x: MARGIN / 2, y: half }, end: { x: A4.width - MARGIN / 2, y: half },
                thickness: 0.5, color: INK.rule, dashArray: [4, 4],
            });
            drawStrip(page, fonts, data, half - MARGIN / 2, width);
            printed += 1;
        }
    }

    stampFooter(doc, fonts, `${data.set.title} - ${copies} copies`);
    return doc.save();
}
