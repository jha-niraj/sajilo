import { PDFDocument } from 'pdf-lib';
import {
    INK, Cursor, loadFonts, centered, rule, spread, table, documentHeader, stampFooter,
} from './layout';
import type { FeeCollectionSummaryData } from './types';

/**
 * The month's fee collection summary: four totals and the per-class breakdown behind them.
 *
 * ## Why this is a document
 *
 * It is the sheet an accountant hands the principal or the board at month end, and it is the only
 * way this page's numbers leave the system - there is no CSV export beside it. When print IS the
 * export, printing the app is not good enough.
 *
 * ## The bug this fixes
 *
 * The page is a bounded `h-[var(--gk-page-h)]` layout whose class table scrolls inside its own
 * `ScrollArea`. `window.print()` prints the visible box, so a school with twelve classes printed
 * whichever six happened to be on screen - and the Total row, which lives at the bottom of the
 * scroller, printed a figure that did not match the rows above it. Here the table is laid out on
 * the page, so every class is on the paper and the total is arithmetic the reader can check.
 *
 * ## Every figure is a finished string
 *
 * The caller has already netted carry-forward out of Total Billed and excluded reversed, pending
 * and ADVANCE-wallet payments from Collected. Re-deriving any of that here would let the PDF and
 * the screen disagree about the school's money, which is the one thing a finance document may
 * never do.
 */

export async function renderFeeCollectionSummary(data: FeeCollectionSummaryData): Promise<Uint8Array> {
    const doc = await PDFDocument.create();
    const fonts = await loadFonts(doc);
    const c = new Cursor(doc, fonts, { top: 52, right: 56, bottom: 56, left: 56 });

    await documentHeader(c, doc, {
        school: { ...data.school, email: null },
        badge: {
            label: 'FEE COLLECTION SUMMARY',
            ref: data.monthLabel,
            lines: [data.academicYearLabel],
        },
    });

    c.gap(6);
    spread(c,
        { label: 'Month', value: data.monthLabel },
        { label: 'Academic year', value: data.academicYearLabel });
    c.gap(10);
    rule(c, 0.75, INK.rule, 12);

    // ── The four headline figures ────────────────────────────────────────────────────────
    // As a table rather than four boxes: on paper a reader compares numbers down a column, and a
    // right-aligned money column is what makes "pending vs overdue" legible at a glance.
    centered(c, 'SUMMARY', { size: 9, bold: true, color: INK.muted, after: 8 });
    table(c,
        [
            { header: 'Measure', width: 0.44 },
            { header: 'Amount', width: 0.30, align: 'right' },
            { header: 'Basis', width: 0.26, align: 'right' },
        ],
        [
            ['Collected this month', data.collectedThisMonth, `${data.paymentCount} payments`],
            ['Total billed (academic year)', data.totalBilled, data.academicYearLabel],
            ['Pending', data.totalPending, 'Unpaid bills'],
            ['Overdue', data.totalOverdue, 'Past due date'],
        ],
    );
    c.gap(14);

    // ── Per class ────────────────────────────────────────────────────────────────────────
    rule(c, 0.75, INK.rule, 10);
    centered(c, `COLLECTION BY CLASS - ${data.monthLabel.toUpperCase()}`, {
        size: 9, bold: true, color: INK.muted, after: 8,
    });

    if (data.classes.length === 0) {
        // A zero month is a real finding an accountant needs stated. Widening the window to find a
        // non-zero figure, or leaving the section blank, both mislead.
        centered(c, `No payments were received in ${data.monthLabel}.`, {
            size: 10, color: INK.muted, after: 8,
        });
    } else {
        table(c,
            [
                { header: 'Class', width: 0.40 },
                { header: 'Payments', width: 0.24, align: 'right' },
                { header: 'Collected', width: 0.36, align: 'right' },
            ],
            [
                ...data.classes.map((r) => [r.className, String(r.paymentCount), r.collected]),
                // `emphasiseLast` gives this the toolkit's totals styling - bold with a rule above.
                // The total comes from the caller, never re-summed here: a rounded sum of rounded
                // parts does not always equal the rounded whole.
                ['Total', String(data.paymentCount), data.collectedThisMonth],
            ],
            { repeatHeader: true, emphasiseLast: true },
        );
    }

    // ── Signatures ───────────────────────────────────────────────────────────────────────
    c.gap(26);
    c.ensure(38);
    const half = c.contentWidth / 2 - 20;
    for (const [i, label] of ['Prepared by (Accounts)', 'Principal'].entries()) {
        const x = i === 0 ? c.left : c.right - half;
        c.page.drawLine({
            start: { x, y: c.y }, end: { x: x + half, y: c.y },
            thickness: 0.5, color: INK.rule,
        });
        c.page.drawText(label, { x, y: c.y - 10, size: 8, font: fonts.regular, color: INK.muted });
    }
    c.y -= 22;

    stampFooter(doc, fonts, `Fee collection summary - ${data.generatedOn}`);
    return doc.save();
}
