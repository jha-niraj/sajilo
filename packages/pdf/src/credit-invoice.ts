import { PDFDocument, rgb } from 'pdf-lib';
import { formatSchoolDate, type SchoolCalendarSystem } from '@repo/calendar';
import { BRAND } from './types';
import {
    A4, Cursor, INK, block, calloutBox, documentHeader, loadFonts, rule, table,
} from './layout';

/**
 * The credit top-up payment receipt, drawn with pdf-lib.
 *
 * Ported from the react-pdf document; see docs/worker-bundle-size.md section 10 for why.
 *
 * Unlike the school documents this one is issued by GURUKUL to a school, so the masthead is our
 * brand and the signature block is read from platform settings rather than the school record.
 */

export interface InvoiceData {
    referenceNumber: string;
    credits: number;
    amountNPR: number;
    currency?: string;
    transactionId: string | null;
    schoolName: string | null;
    paidAt: string;
    paymentMethod: string;
    email: string;
    /** Platform signature settings - display name, title, email, logo, address, website. */
    signature: Record<string, string>;
    calendarSystem?: SchoolCalendarSystem;
}

const PANEL = rgb(0.957, 0.957, 0.965);
const EMERALD = rgb(0.02, 0.588, 0.412);
const EMERALD_TINT = rgb(0.82, 0.98, 0.90);

function fmtDate(iso: string, cal: SchoolCalendarSystem): string {
    try { return formatSchoolDate(new Date(iso), cal, { day: '2-digit', month: 'short', year: 'numeric' }); }
    catch { return iso; }
}

function fmtMethod(m: string): string {
    if (m === 'KHALTI') return 'Khalti';
    if (m === 'ESEWA') return 'eSewa';
    if (m === 'STRIPE') return 'Card';
    if (m === 'BANK_TRANSFER') return 'Bank Transfer';
    return m.replace(/_/g, ' ');
}

function fmtAmount(amount: number, currency?: string): string {
    const code = (currency ?? 'NPR').toUpperCase();
    return `${code} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

export async function renderCreditInvoice(data: InvoiceData): Promise<Uint8Array> {
    const cal = data.calendarSystem ?? 'AD';
    const sig = data.signature ?? {};
    const issuerName = sig['signature_display_name'] || 'Gurukul Team';
    const issuerTitle = sig['signature_title'] || 'Platform Operations';
    const issuerEmail = sig['signature_email'] || sig['signature_support_email'] || '';
    const issuerLogo = sig['signature_logo_url'] || null;
    const issuerAddress = sig['signature_address'] || null;
    const issuerWebsite = sig['signature_website'] || 'gurukul.app';

    const doc = await PDFDocument.create();
    doc.setTitle(`Receipt - ${data.referenceNumber}`);
    doc.setAuthor('Gurukul');
    doc.setProducer('Gurukul');
    doc.setCreator('Gurukul Platform');

    const fonts = await loadFonts(doc);
    const c = new Cursor(doc, fonts, { top: 48, right: 52, bottom: 48, left: 52 }, A4);

    await documentHeader(c, doc, {
        school: {
            name: 'Gurukul',
            logo: issuerLogo,
            address: issuerAddress,
            phone: null,
            email: BRAND.category,
        },
        badge: {
            label: 'Payment Receipt',
            ref: data.referenceNumber,
            lines: [fmtDate(data.paidAt, cal)],
        },
        chip: { text: 'PAID', fill: EMERALD_TINT, color: EMERALD },
    });

    // ─── Billed to / method ───────────────────────────────────────────────────────────────────────
    // With no school on the record the email becomes the identity line, so it is promoted to the
    // bold value slot rather than sitting as muted detail under an empty name.
    const billed = data.schoolName
        ? [
            { text: 'BILLED TO', size: 7.5, color: INK.faint },
            { text: data.schoolName, size: 10.5, bold: true },
            { text: data.email, size: 8.5, color: INK.muted },
        ]
        : [
            { text: 'BILLED TO', size: 7.5, color: INK.faint },
            { text: data.email, size: 10, bold: true },
        ];

    const lh = block(c, c.left, billed);
    const rh = block(c, c.right, [
        { text: 'PAYMENT METHOD', size: 7.5, color: INK.faint },
        { text: fmtMethod(data.paymentMethod), size: 10.5, bold: true },
        ...(data.transactionId ? [{ text: `Txn: ${data.transactionId}`, size: 8.5, color: INK.muted }] : []),
    ], 'right');
    c.gap(Math.max(lh, rh) + 14);

    // ─── Line item ────────────────────────────────────────────────────────────────────────────────
    table(
        c,
        [
            { header: 'Description', width: 0.6 },
            { header: 'Credits', width: 0.16, align: 'right' },
            { header: 'Amount', width: 0.24, align: 'right' },
        ],
        [[
            'Credit Top-up\nGurukul platform credits - valid across all AI features',
            String(data.credits),
            fmtAmount(data.amountNPR, data.currency),
        ]],
        { size: 10, headerFill: PANEL },
    );

    c.gap(8);
    calloutBox(c, 'Total Paid', fmtAmount(data.amountNPR, data.currency), { fill: PANEL, size: 12, after: 10 });

    // ─── Meta line ────────────────────────────────────────────────────────────────────────────────
    const meta = ['Status: Completed', `Date: ${fmtDate(data.paidAt, cal)}`]
        .concat(data.transactionId ? [`Ref: ${data.transactionId}`] : [])
        .join('   ·   ');
    c.ensure(14);
    c.page.drawText(meta, { x: c.left + 4, y: c.y - 8.5, size: 8.5, font: fonts.regular, color: INK.faint });
    c.y -= 14;

    // ─── Issuer ───────────────────────────────────────────────────────────────────────────────────
    c.gap(20);
    rule(c, 1, INK.rule, 14);
    block(c, c.left, [
        { text: 'ISSUED BY', size: 7.5, color: INK.faint },
        { text: issuerName, size: 10, bold: true },
        { text: issuerTitle, size: 8.5, color: INK.faint },
        ...(issuerEmail ? [{ text: issuerEmail, size: 8.5, color: INK.faint, gapAfter: 8 }] : [{ text: '', size: 0, gapAfter: 8 }]),
        {
            text: `${issuerWebsite} · This is a computer-generated receipt and requires no signature.`,
            size: 8, color: INK.faint,
        },
    ]);

    return doc.save();
}
