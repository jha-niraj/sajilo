import { PDFDocument } from 'pdf-lib';
import {
    INK, Cursor, loadFonts, centered, rule, spread, table, documentHeader, stampFooter,
    A4_LANDSCAPE, type Column,
} from './layout';
import type { TabulationSheetData } from './types';

/**
 * The tabulation sheet: every student in an exam against every subject, one grid.
 *
 * ## Why this is a document
 *
 * It is the official per-exam record - the sheet a school files, a board sees, and a result
 * dispute is settled against. The version it replaces was an HTML string handed to
 * `openPrintWindow`, so what came out depended on the popup blocker, the browser's table
 * pagination and whatever the user's print margins happened to be.
 *
 * ## Landscape, and banded when the subjects do not fit
 *
 * Subjects are COLUMNS here, so the sheet grows sideways with the curriculum, not downwards with
 * the roll. Portrait runs out at about four subjects. Landscape holds around eight; past that the
 * subjects are split into bands, each band repeating Roll and Student so a row is still readable,
 * and the totals block printed once at the end of the last band.
 *
 * The alternative - shrinking the columns until everything fits - is what the HTML version did,
 * and at eleven subjects it produced 5pt text nobody could read. A second band is legible; a
 * squeezed single page is not.
 */

/** Absolute point widths. Converted to the 0-1 fractions `table` wants once the band is known. */
const W_ROLL = 46;
const W_NAME = 150;
const W_TOTAL = 62;
const W_PERCENT = 46;
const W_GRADE = 46;
const W_RANK = 40;
/** Below this a subject column cannot hold "100" plus a wrapped two-word header legibly. */
const MIN_SUBJECT = 48;

const TAIL_WIDTH = W_TOTAL + W_PERCENT + W_GRADE + W_RANK;

export async function renderTabulationSheet(data: TabulationSheetData): Promise<Uint8Array> {
    const doc = await PDFDocument.create();
    const fonts = await loadFonts(doc);
    const c = new Cursor(doc, fonts, { top: 44, right: 36, bottom: 50, left: 36 }, A4_LANDSCAPE);

    await documentHeader(c, doc, {
        school: { ...data.school, email: null },
        badge: {
            label: 'TABULATION SHEET',
            ref: data.examName,
            lines: data.classLabel ? [data.classLabel] : [],
        },
    });

    c.gap(4);
    spread(c,
        { label: 'Examination', value: data.examName },
        { label: 'Class', value: data.classLabel ?? '-' });
    spread(c,
        { label: 'Students', value: String(data.rows.length) },
        { label: 'Subjects', value: String(data.subjects.length) });
    c.gap(8);
    rule(c, 0.75, INK.rule, 10);

    if (data.rows.length === 0) {
        centered(c, `No mark sheets have been generated for ${data.examName}.`, {
            size: 11, color: INK.muted, after: 8,
        });
        stampFooter(doc, fonts, `Tabulation sheet - ${data.generatedOn}`, {
            top: 44, right: 36, bottom: 38, left: 36,
        });
        return doc.save();
    }

    // ── How many subjects fit beside the fixed columns ───────────────────────────────────
    // The last band also has to carry the totals block, so it is the tighter of the two and sets
    // the limit for all of them - a uniform band width keeps the grids visually aligned.
    const forSubjects = c.contentWidth - W_ROLL - W_NAME - TAIL_WIDTH;
    const perBand = Math.max(1, Math.floor(forSubjects / MIN_SUBJECT));

    const bands: string[][] = [];
    for (let i = 0; i < data.subjects.length; i += perBand) {
        bands.push(data.subjects.slice(i, i + perBand));
    }
    // A sheet with no subjects at all still needs one pass, or the totals never print.
    if (bands.length === 0) bands.push([]);

    bands.forEach((subjects, bandIndex) => {
        const isLastBand = bandIndex === bands.length - 1;

        if (bandIndex > 0) {
            // Each extra band starts on its own page - a hard break, not `ensure`, which would
            // only break if the band happened not to fit.
            c.newPage();
            centered(c, `${data.examName} - continued (subjects ${bandIndex * perBand + 1}-${bandIndex * perBand + subjects.length})`, {
                size: 9, bold: true, color: INK.muted, after: 10,
            });
        }

        // TAIL_WIDTH is reserved on EVERY band, not just the last one that fills it.
        //
        // This is what makes the uniform-width claim above true. Subtracting it only on the last
        // band gave earlier bands wider subject columns, so a subject sat at a different x on page
        // 1 than on page 2 - and a tabulation sheet is read by running a finger DOWN one column and
        // ACROSS the pages. The reserved strip is left blank on earlier bands; a little unused
        // paper is a much smaller cost than grids that do not line up.
        const subjectWidth = subjects.length > 0
            ? (c.contentWidth - W_ROLL - W_NAME - TAIL_WIDTH) / subjects.length
            : 0;

        const pts: Array<{ header: string; w: number; align?: 'right' | 'center' }> = [
            { header: 'Roll', w: W_ROLL },
            { header: 'Student', w: W_NAME },
            ...subjects.map((s) => ({ header: s, w: subjectWidth, align: 'right' as const })),
        ];
        if (isLastBand) {
            pts.push(
                { header: 'Total', w: W_TOTAL, align: 'right' },
                { header: '%', w: W_PERCENT, align: 'right' },
                { header: 'Grade', w: W_GRADE, align: 'right' },
                { header: 'Rank', w: W_RANK, align: 'right' },
            );
        } else {
            // The reserved strip, as one empty column. Without it the normalisation below would
            // stretch the subject columns back out to fill the width and undo the alignment.
            pts.push({ header: '', w: TAIL_WIDTH });
        }

        // `table` takes fractions of the content width, so the absolute plan above is normalised
        // here. Normalising against the SUM rather than contentWidth guarantees they total 1 even
        // when rounding leaves a fraction of a point unaccounted for.
        const total = pts.reduce((sum, p) => sum + p.w, 0);
        const columns: Column[] = pts.map((p) => ({
            header: p.header,
            width: p.w / total,
            align: p.align,
        }));

        table(c, columns,
            data.rows.map((r) => {
                const cells = [
                    r.rollNumber,
                    r.name,
                    // A subject the student did not sit is '-'; a subject they sat and missed is
                    // 'Ab'. Collapsing the two would turn an absence into a not-enrolled.
                    ...subjects.map((s) => r.marks[s] ?? '-'),
                ];
                // Cell count must match the column count exactly, including the reserved
                // spacer - a short row would shift every cell after it into the wrong column.
                if (isLastBand) cells.push(r.total, r.percentage, r.grade, r.rank);
                else cells.push('');
                return cells;
            }),
            { repeatHeader: true, size: 8.5 },
        );
    });

    // ── Signatures ───────────────────────────────────────────────────────────────────────
    c.gap(22);
    c.ensure(38);
    const third = c.contentWidth / 3 - 30;
    for (const [i, label] of ['Prepared by', 'Checked by', 'Principal'].entries()) {
        const x = c.left + i * (c.contentWidth / 3);
        c.page.drawLine({
            start: { x, y: c.y }, end: { x: x + third, y: c.y },
            thickness: 0.5, color: INK.rule,
        });
        c.page.drawText(label, { x, y: c.y - 10, size: 8, font: fonts.regular, color: INK.muted });
    }
    c.y -= 22;

    stampFooter(doc, fonts, `Tabulation sheet - ${data.examName} - ${data.generatedOn}`, {
        top: 44, right: 36, bottom: 38, left: 36,
    });
    return doc.save();
}
