import { PDFDocument, rgb } from 'pdf-lib';
import { formatSchoolDate, formatAcademicYear, type SchoolCalendarSystem } from '@repo/calendar';
import {
    A4, Cursor, INK, block, calloutBox, documentHeader, loadFonts, paragraph, rule, table,
} from './layout';

/**
 * The fee invoice - a demand for what is owed, distinct from the receipt issued after payment.
 *
 * Ported from the react-pdf document; see docs/worker-bundle-size.md section 10 for why. Same
 * layout, same wording, same figures.
 */

export interface BillInvoiceData {
    billNumber: string;
    /** ISO */
    issuedAt: string;
    /** ISO */
    dueDate: string;
    academicYear: string;
    billingPeriod: string | null;
    school: { name: string; logo: string | null; address: string | null; phone: string | null; email: string | null };
    student: { name: string; className: string; section: string | null; rollNo: string | null };
    items: { description: string; amount: number }[];
    subtotal: number;
    discountAmount: number;
    lateFee: number;
    totalAmount: number;
    paidAmount: number;
    remainingAmount: number;
    /** PENDING | PARTIAL | OVERDUE | COMPLETED */
    status: string;
    calendarSystem?: SchoolCalendarSystem;
}

const PANEL = rgb(0.957, 0.957, 0.965);
const ROSE = rgb(0.745, 0.071, 0.235);
const ROSE_TINT = rgb(0.996, 0.949, 0.949);
const EMERALD = rgb(0.02, 0.588, 0.412);
const EMERALD_TINT = rgb(0.82, 0.98, 0.90);
const AMBER = rgb(0.631, 0.384, 0.027);
const AMBER_TINT = rgb(0.996, 0.976, 0.765);

function fmtDate(iso: string, cal: SchoolCalendarSystem): string {
    try { return formatSchoolDate(new Date(iso), cal, { day: 'numeric', month: 'short', year: 'numeric' }); }
    catch { return iso; }
}

export async function renderBillInvoice(data: BillInvoiceData): Promise<Uint8Array> {
    const cal: SchoolCalendarSystem = data.calendarSystem ?? 'AD';
    const npr = (n: number) => `NPR ${Math.round(n).toLocaleString()}`;
    const isPaid = data.remainingAmount <= 0;

    const chip = isPaid
        ? { text: 'PAID', fill: EMERALD_TINT, color: EMERALD }
        : data.paidAmount > 0
            ? { text: 'PARTIALLY PAID', fill: AMBER_TINT, color: AMBER }
            : { text: 'UNPAID', fill: ROSE_TINT, color: ROSE };

    const doc = await PDFDocument.create();
    doc.setTitle(`Fee Invoice - ${data.billNumber}`);
    doc.setAuthor(data.school.name);
    doc.setProducer('Gurukul');
    doc.setCreator('Gurukul');

    const fonts = await loadFonts(doc);
    const c = new Cursor(doc, fonts, { top: 44, right: 50, bottom: 44, left: 50 }, A4);

    await documentHeader(c, doc, {
        school: data.school,
        badge: {
            label: 'Fee Invoice',
            ref: data.billNumber,
            lines: [`Issued ${fmtDate(data.issuedAt, cal)}`, `Due ${fmtDate(data.dueDate, cal)}`],
        },
        chip,
    });

    // ─── Billed to / academic year ────────────────────────────────────────────────────────────────
    const studentLine = `Class ${data.student.className}`
        + (data.student.section ? `-${data.student.section}` : '')
        + (data.student.rollNo ? ` · Roll ${data.student.rollNo}` : '');

    const lh = block(c, c.left, [
        { text: 'BILLED TO', size: 7.5, color: INK.faint },
        { text: data.student.name, size: 10.5, bold: true },
        { text: studentLine, size: 8.5, color: INK.muted },
    ]);
    const rh = block(c, c.left + c.contentWidth * 0.55, [
        { text: 'ACADEMIC YEAR', size: 7.5, color: INK.faint },
        { text: formatAcademicYear(data.academicYear, cal), size: 10.5, bold: true },
        ...(data.billingPeriod ? [{ text: data.billingPeriod, size: 8.5, color: INK.muted }] : []),
    ]);
    c.gap(Math.max(lh, rh) + 14);

    // ─── Line items ───────────────────────────────────────────────────────────────────────────────
    table(
        c,
        [
            { header: 'Fee item', width: 0.68 },
            { header: 'Amount', width: 0.32, align: 'right' },
        ],
        data.items.map((it) => [it.description, npr(it.amount)]),
        { size: 10, headerFill: PANEL, repeatHeader: true },
    );

    // ─── Adjustments ──────────────────────────────────────────────────────────────────────────────
    // Discount and late fee only appear when they are non-zero, matching the react-pdf conditionals:
    // a "Discount: NPR 0" line on an invoice invites a question that has no answer.
    c.gap(8);
    const adjustments: [string, string][] = [['Subtotal', npr(data.subtotal)]];
    if (data.discountAmount > 0) adjustments.push(['Discount', `- ${npr(data.discountAmount)}`]);
    if (data.lateFee > 0) adjustments.push(['Late fee', npr(data.lateFee)]);
    for (const [label, value] of adjustments) {
        c.ensure(14);
        const y = c.y - 9.5;
        c.page.drawText(label, { x: c.left + 8, y, size: 9.5, font: fonts.regular, color: INK.faint });
        const w = fonts.regular.widthOfTextAtSize(value, 9.5);
        c.page.drawText(value, { x: c.right - 8 - w, y, size: 9.5, font: fonts.regular, color: INK.body });
        c.y -= 14;
    }

    c.gap(8);
    calloutBox(c, 'Total', npr(data.totalAmount), { fill: PANEL, size: 12, after: 4 });

    if (data.paidAmount > 0) {
        c.ensure(14);
        const y = c.y - 9.5;
        c.page.drawText('Paid', { x: c.left + 8, y, size: 9.5, font: fonts.regular, color: INK.faint });
        const v = `- ${npr(data.paidAmount)}`;
        const w = fonts.regular.widthOfTextAtSize(v, 9.5);
        c.page.drawText(v, { x: c.right - 8 - w, y, size: 9.5, font: fonts.regular, color: INK.body });
        c.y -= 14;
    }

    if (!isPaid) {
        c.gap(6);
        // Drawn by hand rather than through calloutBox so the label and figure can both be rose -
        // this is the number the parent is being asked to act on.
        const h = 34;
        c.ensure(h);
        c.page.drawRectangle({ x: c.left, y: c.y - h, width: c.contentWidth, height: h, color: ROSE_TINT });
        const y = c.y - h / 2 - 4;
        c.page.drawText('Balance due', { x: c.left + 12, y, size: 11, font: fonts.bold, color: ROSE });
        const value = npr(data.remainingAmount);
        const w = fonts.bold.widthOfTextAtSize(value, 13);
        c.page.drawText(value, { x: c.right - 12 - w, y, size: 13, font: fonts.bold, color: ROSE });
        c.y -= h;
    }

    // ─── Footer ───────────────────────────────────────────────────────────────────────────────────
    c.gap(24);
    rule(c, 0.5, INK.rule, 10);
    paragraph(
        c,
        'This is a fee invoice for the amount due. Please pay by the due date. '
        + 'For payment options, contact the school office or use the parent app.',
        { size: 8, color: INK.faint },
    );

    return doc.save();
}
