import { PDFDocument } from 'pdf-lib';
import {
    Cursor,
    INK,
    centered,
    documentHeader,
    loadFonts,
    paragraph,
    rule,
    spread,
    stampFooter,
    table,
} from './layout';
import type { PayslipData } from './types';

/**
 * A single month's payslip.
 *
 * ## Why this is a document and not a print view
 *
 * It is a money document that goes to a member of staff, and staff keep payslips - for a loan
 * application, a visa, a tax return, a dispute about a deduction. The `window.print()` version it
 * replaces produced something that existed only while the print dialog was open and looked
 * different on every machine. A payslip someone may have to produce two years later has to be a
 * file.
 *
 * ## Deductions are shown even when there are none
 *
 * The old HTML omitted the whole deductions block when the list was empty. That is worse than an
 * empty section: "no deductions section" and "deductions section showing zero" look identical to
 * someone checking whether tax was withheld. The section always renders, with an explicit
 * "No deductions this period" line when it is empty, so the absence is stated rather than implied.
 *
 * ## Rounding
 *
 * Every figure is rounded ONCE, here, at display time - and the totals come from the caller
 * already computed. The renderer never re-derives `gross` or `net` from the lines, because a
 * rounded sum of rounded parts does not always equal the rounded whole, and a payslip whose
 * columns do not add up is a support ticket.
 */

/** Column shares. `table` takes 0-1 fractions of the content width, not absolute points. */
const DESC_COL = 0.68;
const MONEY_COL = 0.32;

function money(currency: string, amount: number): string {
    return `${currency} ${Math.round(amount).toLocaleString()}`;
}

export async function renderPayslip(data: PayslipData): Promise<Uint8Array> {
    const doc = await PDFDocument.create();
    const fonts = await loadFonts(doc);
    const c = new Cursor(doc, fonts, { top: 52, right: 56, bottom: 56, left: 56 });

    await documentHeader(c, doc, {
        school: { ...data.school, email: null },
        badge: { label: 'SALARY SLIP', ref: data.payPeriod, lines: [data.employee.name] },
    });

    // ── Employee ─────────────────────────────────────────────────────────────────────────
    c.gap(6);
    spread(c,
        { label: 'Employee', value: data.employee.name },
        { label: 'Pay period', value: data.payPeriod });
    spread(c,
        { label: 'Role', value: data.employee.role },
        { label: 'Status', value: data.status });
    spread(c,
        { label: 'Email', value: data.employee.email },
        { label: 'Employee ID', value: data.employee.employeeId ?? '-' });
    c.gap(10);
    rule(c, 0.75, INK.rule, 12);

    // ── Earnings ─────────────────────────────────────────────────────────────────────────
    centered(c, 'EARNINGS', { size: 9, bold: true, color: INK.muted, after: 8 });
    table(c,
        [
            { header: 'Description', width: DESC_COL },
            { header: 'Amount', width: MONEY_COL, align: 'right' },
        ],
        [
            ['Basic salary', money(data.currency, data.basicSalary)],
            ...data.allowances.map((a) => [a.label, money(data.currency, a.amount)]),
            // `emphasiseLast` draws this in bold with a rule above - the toolkit's totals styling,
            // rather than a hand-placed line that drifts out of step with the other documents.
            ['Gross salary', money(data.currency, data.grossSalary)],
        ],
        { emphasiseLast: true },
    );
    c.gap(12);

    // ── Deductions - always rendered, see the note at the top ────────────────────────────
    centered(c, 'DEDUCTIONS', { size: 9, bold: true, color: INK.muted, after: 8 });
    if (data.deductions.length === 0) {
        centered(c, 'No deductions this period.', { size: 9.5, color: INK.muted, after: 8 });
    } else {
        table(c,
            [
                { header: 'Description', width: DESC_COL },
                { header: 'Amount', width: MONEY_COL, align: 'right' },
            ],
            [
                ...data.deductions.map((d) => [d.label, money(data.currency, d.amount)]),
                ['Total deductions', money(data.currency, data.totalDeductions)],
            ],
            { emphasiseLast: true },
        );
    }

    // ── Net ──────────────────────────────────────────────────────────────────────────────
    c.gap(14);
    rule(c, 1.5, INK.body, 10);
    c.ensure(26);
    const netLabel = 'NET SALARY';
    const netValue = money(data.currency, data.netSalary);
    c.page.drawText(netLabel, { x: c.left, y: c.y, size: 13, font: fonts.bold, color: INK.body });
    c.page.drawText(netValue, {
        x: c.right - fonts.bold.widthOfTextAtSize(netValue, 13),
        y: c.y, size: 13, font: fonts.bold, color: INK.body,
    });
    c.y -= 20;
    rule(c, 1.5, INK.body, 14);

    if (data.remarks?.trim()) {
        centered(c, 'REMARKS', { size: 8.5, bold: true, color: INK.muted, after: 5 });
        // `paragraph`, not a raw drawText. Remarks are free text a payroll clerk types, so a
        // single-line draw runs straight off the right margin - and unlike a truncated name it
        // does not look wrong, it just silently loses the end of a sentence about someone's pay.
        paragraph(c, data.remarks.trim(), { size: 9.5, after: 6 });
    }

    // ── Signature block ──────────────────────────────────────────────────────────────────
    // A ruled line to sign on rather than a printed name: an unsigned payslip that already
    // carries an authorising name reads as approved when it may not be.
    c.gap(28);
    c.ensure(34);
    const half = c.contentWidth / 2 - 20;
    for (const [i, label] of ['Employee signature', 'Authorised signatory'].entries()) {
        const x = i === 0 ? c.left : c.right - half;
        c.page.drawLine({
            start: { x, y: c.y }, end: { x: x + half, y: c.y },
            thickness: 0.5, color: INK.rule,
        });
        c.page.drawText(label, { x, y: c.y - 10, size: 8, font: fonts.regular, color: INK.muted });
    }
    c.y -= 24;

    if (data.processedBy) {
        c.ensure(12);
        c.page.drawText(`Processed by ${data.processedBy}`, {
            x: c.left, y: c.y, size: 8, font: fonts.regular, color: INK.muted,
        });
    }

    stampFooter(doc, fonts, `Computer-generated salary slip - ${data.generatedOn}`);
    return doc.save();
}
