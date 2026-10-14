import { PDFDocument, rgb } from 'pdf-lib';
import {
    A4, Cursor, INK, centered, embedLogo, fieldTable, loadFonts, paragraph, rule, wrap,
    type FieldRow,
} from './layout';

/**
 * The acknowledgement receipt, drawn with pdf-lib.
 *
 * Ported from the react-pdf document; see docs/worker-bundle-size.md section 10 for why.
 *
 * This document exists to record that a named person was shown a specific artifact, so the SHA-256
 * is the point of the page rather than decoration. It is printed in full and never truncated - a
 * shortened hash cannot be checked against anything, which would leave the receipt asserting
 * something it does not evidence.
 */

export type AcknowledgementReceiptProps = {
    schoolName: string;
    documentTitle: string;
    documentType: string;
    studentName: string;
    studentClass: string;
    signerName: string;
    signerRole: string;
    acknowledgedAt: string;
    ipAddress: string | null;
    userAgent: string | null;
    /** sha256 of the artifact the signer was shown. The whole point of the page. */
    documentHash: string;
    documentRenderedAt: string;
    /** Signed URL or data URI for the drawn signature. Null for a tap acknowledgement. */
    signatureUrl: string | null;
};

const PANEL = rgb(0.976, 0.976, 0.980);

/** Small caps-ish section heading, matching the react-pdf `sectionLabel`. */
function sectionLabel(c: Cursor, text: string): void {
    c.ensure(20);
    c.page.drawText(text, { x: c.left, y: c.y - 8, size: 8, font: c.fonts.bold, color: INK.faint });
    c.y -= 12;
    c.page.drawLine({ start: { x: c.left, y: c.y }, end: { x: c.right, y: c.y }, thickness: 0.5, color: INK.rule });
    c.y -= 8;
}

export async function renderAcknowledgementReceipt(p: AcknowledgementReceiptProps): Promise<Uint8Array> {
    const doc = await PDFDocument.create();
    doc.setTitle(`Acknowledgement Receipt - ${p.documentTitle}`);
    doc.setAuthor(p.schoolName);
    doc.setProducer('Gurukul');
    doc.setCreator('Gurukul');

    const fonts = await loadFonts(doc);
    const c = new Cursor(doc, fonts, { top: 48, right: 52, bottom: 48, left: 52 }, A4);

    // ─── Header ───────────────────────────────────────────────────────────────────────────────────
    centered(c, p.schoolName, { size: 17, bold: true });
    centered(c, 'Acknowledgement Receipt', { size: 11, color: INK.muted, after: 6 });
    rule(c, 1, INK.rule, 18);

    // ─── Statement ────────────────────────────────────────────────────────────────────────────────
    paragraph(
        c,
        `${p.signerName} confirmed on ${p.acknowledgedAt} that they had been shown the document `
        + `identified below, and acknowledged its contents. This receipt records that acknowledgement. `
        + `It is issued alongside the original document and does not replace it.`,
        { size: 10, after: 18 },
    );

    // ─── Document ─────────────────────────────────────────────────────────────────────────────────
    sectionLabel(c, 'DOCUMENT');
    const docRows: FieldRow[] = [
        { label: 'Title', value: p.documentTitle },
        { label: 'Type', value: p.documentType },
        { label: 'Student', value: p.studentName + (p.studentClass ? ` - ${p.studentClass}` : '') },
        { label: 'Issued', value: p.documentRenderedAt },
    ];
    fieldTable(c, docRows, { size: 10, labelWidth: 130 });

    // The hash gets its own block rather than a table row: 64 hex characters do not fit a value
    // column at 10pt, and this is the one value on the page a reader is meant to compare
    // character by character.
    c.gap(8);
    c.ensure(30);
    c.page.drawText('SHA-256', { x: c.left, y: c.y - 8, size: 9, font: fonts.regular, color: INK.muted });
    c.y -= 14;
    for (const line of wrap(fonts.regular, p.documentHash, 8, c.contentWidth)) {
        c.ensure(11);
        c.page.drawText(line, { x: c.left, y: c.y - 8, size: 8, font: fonts.regular, color: INK.body });
        c.y -= 11;
    }
    c.gap(14);

    // ─── Acknowledged by ──────────────────────────────────────────────────────────────────────────
    sectionLabel(c, 'ACKNOWLEDGED BY');
    const byRows: FieldRow[] = [
        { label: 'Name', value: p.signerName },
        { label: 'Relationship', value: p.signerRole },
        { label: 'Date and time', value: p.acknowledgedAt },
        // "Not recorded" rather than blank: an empty cell reads as a rendering fault, and whether
        // the address was captured is itself part of the record.
        { label: 'Address', value: p.ipAddress ?? 'Not recorded' },
    ];
    if (p.userAgent) byRows.push({ label: 'Device', value: p.userAgent });
    fieldTable(c, byRows, { size: 10, labelWidth: 130 });
    c.gap(14);

    // ─── Signature ────────────────────────────────────────────────────────────────────────────────
    sectionLabel(c, 'SIGNATURE');
    const sig = await embedLogo(doc, p.signatureUrl);
    if (sig) {
        const scale = Math.min(220 / sig.width, 76 / sig.height);
        const w = sig.width * scale;
        const h = sig.height * scale;
        c.ensure(h + 6);
        c.page.drawRectangle({ x: c.left, y: c.y - h - 6, width: 240, height: h + 6, color: PANEL });
        c.page.drawImage(sig.image, { x: c.left + 10, y: c.y - h - 3, width: w, height: h });
        c.y -= h + 6;
        c.gap(4);
        c.page.drawText(`Drawn by ${p.signerName} in the Gurukul app.`, {
            x: c.left, y: c.y - 8, size: 8, font: fonts.regular, color: INK.faint,
        });
        c.y -= 12;
    } else {
        // A tap acknowledgement is a real acknowledgement - say which kind it was rather than
        // leaving an empty box that looks like a failed image.
        c.ensure(16);
        c.page.drawText('Acknowledged without a drawn signature', {
            x: c.left, y: c.y - 9, size: 9, font: fonts.regular, color: INK.faint,
        });
        c.y -= 16;
    }

    // ─── Footer ───────────────────────────────────────────────────────────────────────────────────
    c.gap(18);
    rule(c, 0.5, INK.rule, 10);
    paragraph(
        c,
        'To verify: download the original document and compute its SHA-256. It must match the value '
        + 'printed above. Any difference means the document is not the one that was acknowledged.',
        { size: 8.5, color: INK.faint },
    );

    return doc.save();
}
