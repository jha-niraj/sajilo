import { PDFDocument } from 'pdf-lib';
import {
    INK, Cursor, loadFonts, centered, rule, spread, table, documentHeader, stampFooter,
} from './layout';
import type { AttendanceReportData } from './types';

/**
 * The monthly attendance register for one class.
 *
 * ## Why this is a document and not a print view
 *
 * It is the record a school shows an inspector, attaches to a board pack, or files against a
 * student's promotion. It is also the evidence behind a below-75% warning letter, so it has to
 * be a file that still reads the same six months later.
 *
 * ## The bug this fixes, which is the real reason it had to move
 *
 * The page it replaces paginates the table at 50 students and `window.print()` prints only the
 * DOM - so a 154-student class printed 50 rows, with no gap, no ellipsis and no page-2 marker.
 * The sheet looked complete and was not. The route feeds this renderer the FULL result set, and
 * the total is printed in the header so a short report is self-evidently short.
 *
 * ## Threshold marking
 *
 * Below-threshold students are marked with a `*` against the percentage and named again in a
 * summary block at the end, rather than shaded. Shading is the web table's device and it does not
 * survive a mono laser printer, which is what schools here actually print on.
 */

/** Column shares of the content width. `table` takes 0-1 fractions, not absolute points. */
const COLUMNS = [
    { header: 'Roll', width: 0.09 },
    { header: 'Student', width: 0.35 },
    { header: 'Present', width: 0.10, align: 'right' as const },
    { header: 'Absent', width: 0.09, align: 'right' as const },
    { header: 'Late', width: 0.08, align: 'right' as const },
    { header: 'Half', width: 0.08, align: 'right' as const },
    { header: 'Days', width: 0.09, align: 'right' as const },
    { header: '%', width: 0.12, align: 'right' as const },
];

export async function renderAttendanceReport(data: AttendanceReportData): Promise<Uint8Array> {
    const doc = await PDFDocument.create();
    const fonts = await loadFonts(doc);
    const c = new Cursor(doc, fonts, { top: 52, right: 44, bottom: 56, left: 44 });

    const classLabel = data.section ? `Class ${data.className}-${data.section}` : `Class ${data.className}`;

    await documentHeader(c, doc, {
        school: { ...data.school, email: null },
        badge: {
            label: 'ATTENDANCE REPORT',
            ref: data.monthLabel,
            lines: [classLabel],
        },
    });

    // ── Scope of the sheet ───────────────────────────────────────────────────────────────
    // Stated explicitly, because the number a reader trusts is the one on the paper. If the
    // caller ever sends a partial set again, the count here contradicts the row count and the
    // discrepancy is visible instead of silent.
    c.gap(6);
    spread(c,
        { label: 'Class', value: classLabel },
        { label: 'Month', value: data.monthLabel });
    spread(c,
        { label: 'Students', value: String(data.rows.length) },
        { label: 'Threshold', value: `${data.thresholdPercent}%` });
    c.gap(10);
    rule(c, 0.75, INK.rule, 12);

    if (data.rows.length === 0) {
        // "No records" is a finding, not an empty page. A blank sheet reads as a failed print.
        centered(c, `No attendance was marked for ${classLabel} in ${data.monthLabel}.`, {
            size: 10.5, color: INK.muted, after: 8,
        });
        centered(c, 'This is not zero attendance - no register was taken.', {
            size: 9, color: INK.muted, after: 8,
        });
        stampFooter(doc, fonts, `Monthly attendance report - ${data.generatedOn}`);
        return doc.save();
    }

    // ── The register ─────────────────────────────────────────────────────────────────────
    // `repeatHeader` because this table routinely runs to three or four pages, and a continuation
    // page of bare numbers with no column headings is unreadable.
    table(c, COLUMNS,
        data.rows.map((r) => [
            r.rollNumber,
            r.name,
            String(r.present),
            String(r.absent),
            String(r.late),
            String(r.halfDay),
            String(r.totalDays),
            r.percentage === null ? 'Not marked' : `${r.percentage}%${r.belowThreshold ? ' *' : ''}`,
        ]),
        { repeatHeader: true, size: 9 },
    );

    // ── Summary ──────────────────────────────────────────────────────────────────────────
    c.gap(14);
    rule(c, 0.75, INK.rule, 10);
    centered(c, 'SUMMARY', { size: 9, bold: true, color: INK.muted, after: 8 });

    const flagged = data.rows.filter((r) => r.belowThreshold);
    /*
     * Averaged over students, which is what the class figure means here. Averaging the percentages
     * is NOT the same as total-present over total-days when students have different day counts -
     * the per-student mean is the one the threshold list is consistent with.
     *
     * Students with no register taken are EXCLUDED from the mean rather than counted as zero.
     * Including them dragged the printed class average down by a child nobody had measured, and the
     * denominator has to drop with them or the same error arrives through the division instead.
     * With nobody marked at all there is no average to print, and the sheet says so.
     */
    const measured = data.rows.filter((r): r is typeof r & { percentage: number } => r.percentage !== null);
    const average = measured.length > 0
        ? Math.round(measured.reduce((sum, r) => sum + r.percentage, 0) / measured.length)
        : null;

    spread(c,
        { label: 'Students on register', value: String(data.rows.length) },
        { label: 'Class average', value: average === null ? 'Not marked' : `${average}%` });
    spread(c,
        { label: `Below ${data.thresholdPercent}%`, value: String(flagged.length) },
        { label: 'Marked *', value: flagged.length > 0 ? 'see list below' : 'none' });

    if (flagged.length > 0) {
        c.gap(10);
        centered(c, `BELOW ${data.thresholdPercent}% - ${flagged.length} STUDENT${flagged.length === 1 ? '' : 'S'}`, {
            size: 8.5, bold: true, color: INK.muted, after: 6,
        });
        // Named again rather than only starred in the register: the action a school takes from this
        // sheet is writing to these families, and hunting asterisks across four pages is how one
        // gets missed.
        table(c,
            [
                { header: 'Roll', width: 0.12 },
                { header: 'Student', width: 0.58 },
                { header: 'Days', width: 0.15, align: 'right' },
                { header: '%', width: 0.15, align: 'right' },
            ],
            flagged.map((r) => [r.rollNumber, r.name, String(r.totalDays), `${r.percentage ?? 0}%`]),
            { repeatHeader: true, size: 9 },
        );
    }

    stampFooter(doc, fonts, `Monthly attendance report - ${data.generatedOn}`);
    return doc.save();
}
