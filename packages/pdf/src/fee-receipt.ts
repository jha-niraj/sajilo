import { PDFDocument, rgb } from 'pdf-lib';
import { formatSchoolDate, formatAcademicYear, type SchoolCalendarSystem } from '@repo/calendar';
import {
    A4, Cursor, INK, block, calloutBox, embedLogo, loadFonts, paragraph, pill, rule, table,
} from './layout';

/**
 * The fee receipt, drawn with pdf-lib.
 *
 * Ported from the react-pdf document of the same name, which cannot run on Cloudflare Workers -
 * see docs/worker-bundle-size.md section 10. Layout, wording and figures are unchanged: a school
 * hands this to a parent as proof of payment, so it is a port rather than a redesign.
 *
 * Structurally this is the template the other finance documents follow - a two-sided header, a
 * line-item table with a right-aligned money column, a highlighted total, and a balance summary.
 */

export interface FeeReceiptData {
    receiptNumber: string;
    /** ISO. Converted here with the school's calendar, exactly as the react-pdf version did. */
    paidAt: string;
    paymentMethod: string;
    referenceNumber: string | null;
    bankName: string | null;
    transactionId: string | null;
    amountPaid: number;
    description: string;
    school: { name: string; logo: string | null; address: string | null; phone: string | null; email: string | null };
    student: { name: string; className: string; section: string | null; rollNo: string | null };
    bill: { billNumber: string; billingPeriod: string | null; academicYear: string; totalAmount: number; paidAmountAfter: number; remainingAfter: number };
    items: { description: string; amount: number }[];
    issuedByName: string;
    calendarSystem?: SchoolCalendarSystem;
}

const EMERALD = rgb(0.02, 0.588, 0.412);
const EMERALD_TINT = rgb(0.82, 0.98, 0.90);
const AMBER = rgb(0.706, 0.325, 0.035);
const PANEL = rgb(0.957, 0.957, 0.965);

function fmtDate(iso: string, cal: SchoolCalendarSystem): string {
    try { return formatSchoolDate(iso, cal, { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return iso; }
}

function npr(amount: number): string {
    return `NPR ${amount.toLocaleString('en-NP', { minimumFractionDigits: 2 })}`;
}

function fmtMethod(m: string): string {
    if (m === 'KHALTI') return 'Khalti';
    if (m === 'ESEWA') return 'eSewa';
    if (m === 'BANK_TRANSFER') return 'Bank Transfer';
    if (m === 'CHECK') return 'Cheque';
    if (m === 'CASH') return 'Cash';
    return m.replace(/_/g, ' ');
}

export async function renderFeeReceipt(data: FeeReceiptData): Promise<Uint8Array> {
    const cal = data.calendarSystem ?? 'AD';
    const doc = await PDFDocument.create();
    doc.setTitle(`Fee Receipt - ${data.receiptNumber}`);
    doc.setAuthor(data.school.name);
    doc.setProducer('Gurukul');
    doc.setCreator('Gurukul');

    const fonts = await loadFonts(doc);
    const c = new Cursor(doc, fonts, { top: 44, right: 50, bottom: 44, left: 50 }, A4);

    // ─── Header: school on the left, receipt reference on the right ───────────────────────────────
    const logo = await embedLogo(doc, data.school.logo);
    if (logo) {
        const scale = Math.min(38 / logo.width, 38 / logo.height);
        c.page.drawImage(logo.image, {
            x: c.left, y: c.y - logo.height * scale,
            width: logo.width * scale, height: logo.height * scale,
        });
        c.gap(logo.height * scale + 5);
    }

    const contact = [data.school.phone, data.school.email].filter(Boolean).join('  ·  ');
    const leftHeight = block(c, c.left, [
        { text: data.school.name, size: 16, bold: true },
        ...(data.school.address ? [{ text: data.school.address, size: 8.5, color: INK.faint }] : []),
        ...(contact ? [{ text: contact, size: 8.5, color: INK.faint }] : []),
    ]);

    const rightHeight = block(c, c.right, [
        { text: 'FEE RECEIPT', size: 9, color: INK.faint },
        { text: data.receiptNumber, size: 12, bold: true },
        { text: fmtDate(data.paidAt, cal), size: 8.5, color: INK.faint },
    ], 'right');

    // The PAID pill hangs under the right block, so it is positioned from that block's own height
    // rather than the shared cursor - the two sides are different heights by design.
    pill(c, 'PAID', c.right, c.y - rightHeight - 2, EMERALD_TINT, EMERALD);

    c.gap(Math.max(leftHeight, rightHeight + 20) + 16);
    rule(c, 1, INK.rule, 16);

    // ─── Who paid, and how ────────────────────────────────────────────────────────────────────────
    const studentLine = `Class ${data.student.className}`
        + (data.student.section ? `-${data.student.section}` : '')
        + (data.student.rollNo ? ` · Roll ${data.student.rollNo}` : '');
    const billLine = `Bill #${data.bill.billNumber}`
        + (data.bill.billingPeriod ? ` · ${data.bill.billingPeriod}` : '')
        + ` · AY ${formatAcademicYear(data.bill.academicYear, cal)}`;

    const fromH = block(c, c.left, [
        { text: 'RECEIVED FROM', size: 7.5, color: INK.faint },
        { text: data.student.name, size: 10.5, bold: true },
        { text: studentLine, size: 8.5, color: INK.muted },
        { text: billLine, size: 8.5, color: INK.muted },
    ]);
    const methodH = block(c, c.right, [
        { text: 'PAYMENT METHOD', size: 7.5, color: INK.faint },
        { text: fmtMethod(data.paymentMethod), size: 10.5, bold: true },
        ...(data.bankName ? [{ text: data.bankName, size: 8.5, color: INK.muted }] : []),
        ...(data.referenceNumber ? [{ text: `Ref: ${data.referenceNumber}`, size: 8.5, color: INK.muted }] : []),
        ...(data.transactionId ? [{ text: `Txn: ${data.transactionId}`, size: 8.5, color: INK.muted }] : []),
    ], 'right');
    c.gap(Math.max(fromH, methodH) + 14);

    // ─── Description ──────────────────────────────────────────────────────────────────────────────
    if (data.description) {
        paragraph(c, data.description, { size: 9.5, color: INK.muted, after: 14 });
    }

    // ─── Line items ───────────────────────────────────────────────────────────────────────────────
    // An empty item list still shows a row, matching the react-pdf fallback - a receipt with no
    // lines at all reads as a broken document rather than a single undifferentiated payment.
    const items = data.items.length > 0
        ? data.items.map((it) => [it.description, npr(it.amount)])
        : [['Fee payment', npr(data.amountPaid)]];

    table(
        c,
        [
            { header: 'Fee Particulars', width: 0.68 },
            { header: 'Amount', width: 0.32, align: 'right' },
        ],
        items,
        { size: 10, headerFill: PANEL, repeatHeader: true },
    );

    c.gap(8);
    calloutBox(c, 'Amount Paid', npr(data.amountPaid), { fill: PANEL, size: 12, after: 6 });

    // ─── Balance summary ──────────────────────────────────────────────────────────────────────────
    const summary: [string, string, typeof INK.muted][] = [
        ['Bill total', npr(data.bill.totalAmount), INK.muted],
        ['Total paid to date', npr(data.bill.paidAmountAfter), INK.muted],
        ['Outstanding balance', npr(data.bill.remainingAfter), data.bill.remainingAfter <= 0 ? EMERALD : AMBER],
    ];
    for (const [label, value, color] of summary) {
        c.ensure(15);
        const y = c.y - 9.5;
        c.page.drawText(label, { x: c.left + 4, y, size: 9.5, font: fonts.regular, color: INK.faint });
        const w = fonts.bold.widthOfTextAtSize(value, 9.5);
        c.page.drawText(value, { x: c.right - 4 - w, y, size: 9.5, font: fonts.bold, color });
        c.y -= 15;
    }

    c.gap(10);
    rule(c, 1, INK.rule, 16);

    // ─── Footer ───────────────────────────────────────────────────────────────────────────────────
    block(c, c.left, [
        { text: 'ISSUED BY', size: 7.5, color: INK.faint },
        { text: data.issuedByName, size: 10, bold: true, gapAfter: 8 },
        {
            text: `This is a computer-generated receipt from ${data.school.name} on Gurukul and is valid without a signature.`,
            size: 8, color: INK.faint,
        },
    ]);

    return doc.save();
}
