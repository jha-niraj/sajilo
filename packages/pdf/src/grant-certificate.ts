import { PDFDocument, rgb } from 'pdf-lib';
import { formatSchoolDate, type SchoolCalendarSystem } from '@repo/calendar';
import { BRAND } from './types';
import {
    A4, Cursor, INK, block, calloutBox, documentHeader, loadFonts, paragraph, rule, table,
} from './layout';

/**
 * The complimentary credit grant certificate, drawn with pdf-lib.
 *
 * Ported from the react-pdf document; see docs/worker-bundle-size.md section 10 for why. Issued by
 * Gurukul to a school, so the masthead is our brand and the signer comes from platform settings.
 *
 * Deliberately NOT a payment receipt: no money changed hands, and the document says so ("No charge
 * applied") rather than showing a zero amount, which reads as a failed payment.
 */

export interface GrantCertificateData {
    ledgerId: string;
    schoolName: string;
    credits: number;
    description: string;
    /** ISO */
    grantedAt: string;
    /** Platform signature settings. */
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

export async function renderGrantCertificate(data: GrantCertificateData): Promise<Uint8Array> {
    const cal = data.calendarSystem ?? 'AD';
    const sig = data.signature ?? {};
    const issuerName = sig['signature_display_name'] || 'Gurukul Team';
    const issuerTitle = sig['signature_title'] || 'Platform Operations';
    const issuerEmail = sig['signature_email'] || sig['signature_support_email'] || '';
    const issuerLogo = sig['signature_logo_url'] || null;
    const issuerAddress = sig['signature_address'] || null;
    const issuerWebsite = sig['signature_website'] || 'gurukul.app';

    const doc = await PDFDocument.create();
    doc.setTitle(`Credit Grant - ${data.ledgerId}`);
    doc.setAuthor('Gurukul');
    doc.setProducer('Gurukul');
    doc.setCreator('Gurukul Platform');

    const fonts = await loadFonts(doc);
    const c = new Cursor(doc, fonts, { top: 48, right: 52, bottom: 48, left: 52 }, A4);

    await documentHeader(c, doc, {
        school: { name: 'Gurukul', logo: issuerLogo, address: issuerAddress, phone: null, email: BRAND.category },
        badge: {
            label: 'Credit Grant',
            ref: data.ledgerId,
            lines: [fmtDate(data.grantedAt, cal)],
        },
        chip: { text: 'GRANTED', fill: EMERALD_TINT, color: EMERALD },
    });

    // ─── Granted to / grant type ──────────────────────────────────────────────────────────────────
    const lh = block(c, c.left, [
        { text: 'GRANTED TO', size: 7.5, color: INK.faint },
        { text: data.schoolName, size: 10.5, bold: true },
    ]);
    const rh = block(c, c.right, [
        { text: 'GRANT TYPE', size: 7.5, color: INK.faint },
        { text: 'Admin Grant', size: 10.5, bold: true },
        { text: 'Complimentary Credits', size: 8.5, color: INK.muted },
    ], 'right');
    c.gap(Math.max(lh, rh) + 14);

    // ─── Line item ────────────────────────────────────────────────────────────────────────────────
    table(
        c,
        [
            { header: 'Description', width: 0.7 },
            { header: 'Credits Granted', width: 0.3, align: 'right' },
        ],
        [[
            'Complimentary Credit Grant\nGurukul platform credits - valid across all AI features',
            data.credits.toLocaleString(),
        ]],
        { size: 10, headerFill: PANEL },
    );

    c.gap(8);
    calloutBox(c, 'Total Credits Granted', `${data.credits.toLocaleString()} credits`, { fill: PANEL, size: 12, after: 10 });

    const meta = [`Status: Granted`, `Date: ${fmtDate(data.grantedAt, cal)}`, 'No charge applied'].join('   ·   ');
    c.ensure(14);
    c.page.drawText(meta, { x: c.left + 4, y: c.y - 8.5, size: 8.5, font: fonts.regular, color: INK.faint });
    c.y -= 14;

    if (data.description) {
        c.gap(8);
        paragraph(c, `Note: ${data.description}`, { size: 9, color: INK.muted });
    }

    // ─── Issuer ───────────────────────────────────────────────────────────────────────────────────
    c.gap(20);
    rule(c, 1, INK.rule, 14);
    block(c, c.left, [
        { text: 'ISSUED BY', size: 7.5, color: INK.faint },
        { text: issuerName, size: 10, bold: true },
        { text: issuerTitle, size: 8.5, color: INK.faint },
        ...(issuerEmail ? [{ text: issuerEmail, size: 8.5, color: INK.faint }] : []),
        { text: '', size: 0, gapAfter: 8 },
        {
            text: `${issuerWebsite} · This is a computer-generated certificate and requires no signature.`,
            size: 8, color: INK.faint,
        },
    ]);

    return doc.save();
}
