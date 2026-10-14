import { PDFDocument } from 'pdf-lib';
import {
    A4, Cursor, INK, centered, centeredImage, embedLogo, loadFonts, measure, paragraph, rule,
    spread, underlineCentered,
} from './layout';

/**
 * The staff experience / relieving certificate, drawn with pdf-lib.
 *
 * Ported from the react-pdf document; see docs/worker-bundle-size.md section 10 for why. Wording
 * is unchanged - a relieving certificate that says all dues are settled is a statement a former
 * employer is held to, so it is a port rather than a rewrite.
 *
 * The caller passes already-formatted dates so the stored PDF matches the on-screen preview
 * exactly; this file never converts a date.
 */

export interface StaffCertificateData {
    certType: 'EXPERIENCE' | 'RELIEVING';
    certNo: string;
    issueDate: string;
    joinDate: string;
    relieving: string;
    staffName: string;
    designation: string;
    title: string;
    school: {
        name: string;
        logo: string | null;
        address: string | null;
        phone: string | null;
        email: string | null;
        principalName: string | null;
    };
}

export async function renderStaffCertificate(data: StaffCertificateData): Promise<Uint8Array> {
    const { school } = data;
    const doc = await PDFDocument.create();
    doc.setTitle(`${data.title} - ${data.staffName}`);
    doc.setAuthor(school.name);
    doc.setProducer('Gurukul');
    doc.setCreator('Gurukul');

    const fonts = await loadFonts(doc);
    const c = new Cursor(doc, fonts, { top: 56, right: 60, bottom: 56, left: 60 }, A4);

    // ─── Letterhead ───────────────────────────────────────────────────────────────────────────────
    const logo = await embedLogo(doc, school.logo);
    if (logo) centeredImage(c, logo, 52, 8);

    centered(c, school.name.toUpperCase(), { size: 20, bold: true, tracking: 0.5 });
    if (school.address) centered(c, school.address, { size: 9.5, color: INK.muted });
    const contactLine = [school.phone ? `Tel: ${school.phone}` : null, school.email]
        .filter(Boolean).join('  |  ');
    if (contactLine) centered(c, contactLine, { size: 9.5, color: INK.muted });

    c.gap(14);
    rule(c, 2, INK.body, 20);

    spread(c, { label: 'Ref No: ', value: data.certNo }, { label: 'Date: ', value: data.issueDate });
    c.gap(30);

    underlineCentered(c, data.title.toUpperCase(), { size: 15, bold: true, tracking: 2, after: 22 });

    // ─── Body ─────────────────────────────────────────────────────────────────────────────────────
    // The bold runs the react-pdf version used inside each sentence are dropped: pdf-lib draws one
    // string in one font, and faking mixed weight means measuring and positioning every fragment.
    // For a letter that is read as prose rather than scanned, plain body text is the better trade -
    // the names and dates are already the only proper nouns in the sentence.
    paragraph(c, 'To Whom It May Concern,', { size: 11, after: 14 });

    if (data.certType === 'EXPERIENCE') {
        paragraph(
            c,
            `This is to certify that ${data.staffName} has been employed at ${school.name} as `
            + `${data.designation} from ${data.joinDate} to ${data.issueDate}.`,
            { size: 11, after: 14 },
        );
        paragraph(
            c,
            `During their tenure, ${data.staffName} has demonstrated dedication, professionalism, and a `
            + `commitment to the school's mission and values. They have carried out their duties `
            + `diligently and to the satisfaction of the management.`,
            { size: 11, after: 14 },
        );
        paragraph(c, 'We wish them the very best in their future endeavors.', { size: 11, after: 14 });
    } else {
        paragraph(
            c,
            `This is to certify that ${data.staffName}, who was serving as ${data.designation} at `
            + `${school.name} since ${data.joinDate}, has been duly relieved from their duties with `
            + `effect from ${data.relieving}.`,
            { size: 11, after: 14 },
        );
        paragraph(
            c,
            'All dues have been settled and there are no pending liabilities or obligations. '
            + 'We thank them for their contribution to the institution.',
            { size: 11, after: 14 },
        );
    }

    // ─── Signature ────────────────────────────────────────────────────────────────────────────────
    c.gap(64);
    c.ensure(52);
    const signWidth = 220;
    const signX = c.right - signWidth;
    const baseline = c.y;

    c.page.drawLine({
        start: { x: signX, y: baseline + 14 }, end: { x: c.right, y: baseline + 14 },
        thickness: 1, color: INK.body,
    });
    const principal = school.principalName ?? 'Principal';
    const pw = measure(c, principal, { size: 11, bold: true });
    c.page.drawText(principal, { x: signX + (signWidth - pw) / 2, y: baseline, size: 11, font: fonts.bold, color: INK.body });

    const sw = measure(c, school.name, { size: 9.5 });
    c.page.drawText(school.name, { x: signX + (signWidth - sw) / 2, y: baseline - 13, size: 9.5, font: fonts.regular, color: INK.muted });

    const seal = 'With school seal';
    const sealW = measure(c, seal, { size: 9.5 });
    c.page.drawText(seal, { x: signX + (signWidth - sealW) / 2, y: baseline - 26, size: 9.5, font: fonts.regular, color: INK.muted });

    return doc.save();
}
