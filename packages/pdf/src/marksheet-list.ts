import { PDFDocument } from 'pdf-lib';
import {
    A4_LANDSCAPE, INK, Cursor, loadFonts, centered, rule, spread, table, documentHeader, stampFooter,
} from './layout';
import type { Column } from './layout';
import type { MarksheetListData } from './types';

/**
 * The mark sheet list: every sheet the page's filters select, on paper.
 *
 * ## Why this replaced `window.print()`
 *
 * The page printed itself through a hidden print-only `<table>` and a block of `@media print` CSS.
 * It had already been patched once - the live card holds one page of rows, so printing it printed
 * 20 of 462 - and it was still the browser deciding where the pages broke, whether the header
 * repeated, and what the margins were, differently in every browser and not at all on a phone.
 * Niraj, 2026-10-08: every remaining `window.print()` becomes a real PDF. This is the same move the
 * tabulation sheet, the attendance report and the fee summary already made.
 *
 * ## Landscape, because of the columns
 *
 * Nine columns, one of them a full name. On a portrait A4 at a readable size the name column gets
 * about 90pt and every second name wraps, which doubles the page count for nothing.
 *
 * ## A cut list says it is cut
 *
 * The route caps a print at 2,000 sheets. When the filters match more, the scope block says
 * "showing the first N of M" in the document itself - a toast on the screen does not travel with
 * the paper, and a list that silently stops at 2,000 reads as the whole school.
 */

const COLUMNS: Column[] = [
    { header: 'Student', width: 0.22 },
    { header: 'Student ID', width: 0.12 },
    { header: 'Class', width: 0.08 },
    { header: 'Section', width: 0.08 },
    { header: 'Obtained / total', width: 0.14, align: 'right', gutterRight: 10 },
    { header: '%', width: 0.08, align: 'right', gutterRight: 10 },
    { header: 'Grade', width: 0.08, align: 'center' },
    { header: 'Rank', width: 0.08, align: 'center' },
    { header: 'Result', width: 0.12, align: 'center' },
];

export async function renderMarksheetList(data: MarksheetListData): Promise<Uint8Array> {
    const doc = await PDFDocument.create();
    const fonts = await loadFonts(doc);
    const c = new Cursor(doc, fonts, { top: 44, right: 40, bottom: 52, left: 40 }, A4_LANDSCAPE);

    await documentHeader(c, doc, {
        school: { ...data.school, email: null },
        badge: {
            label: 'MARK SHEETS',
            ref: data.examLabel ?? 'All exams',
            lines: [`${data.rows.length} ${data.rows.length === 1 ? 'sheet' : 'sheets'}`],
        },
    });

    c.gap(4);
    spread(c,
        { label: 'Exam', value: data.examLabel ?? 'All exams' },
        { label: 'Showing', value: data.scope || 'All classes' });
    c.gap(6);

    if (data.totalMatching > data.rows.length) {
        centered(c,
            `Showing the first ${data.rows.length} of ${data.totalMatching} matching sheets. Narrow the filters to print the rest.`,
            { size: 9, bold: true, color: INK.muted, after: 6 });
    }
    rule(c, 0.75, INK.rule, 10);

    if (data.rows.length === 0) {
        // An empty filter is a real answer and is stated, never a blank page.
        centered(c, 'No mark sheets match these filters.', { size: 10, color: INK.muted, after: 8 });
    } else {
        table(c, COLUMNS,
            data.rows.map((r) => [
                r.student, r.studentId, r.className, r.section,
                r.obtained, r.percentage, r.grade, r.rank, r.result,
            ]),
            // The header on every page: a 400-row list is a dozen pages, and page 7 of bare figures
            // with no heading is not readable.
            { repeatHeader: true, size: 9 },
        );
    }

    stampFooter(doc, fonts, `Mark sheets - ${data.generatedOn}`);
    return doc.save();
}
