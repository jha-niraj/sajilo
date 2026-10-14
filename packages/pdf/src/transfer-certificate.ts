import { PDFDocument } from 'pdf-lib';
import {
    A4, Cursor, INK, centered, centeredImage, embedLogo, fieldTable,
    loadFonts, measure, paragraph, rule, spread, underlineCentered, type FieldRow,
} from './layout';

/**
 * The Transfer Certificate, drawn with pdf-lib.
 *
 * This replaces the react-pdf document of the same name, which could not run on Cloudflare Workers
 * (see lib/pdf/layout.ts and docs/worker-bundle-size.md section 10). The visual result is
 * intentionally the same document: same header, same field order, same declaration wording, same
 * signature block. A transfer certificate is a legal record a school hands to a parent, so this is
 * a port, not a redesign - if it should look different, that is a separate decision.
 *
 */
export interface TransferCertificateData {
    tcNumber: string;
    /** Already formatted in the school's calendar - this file never converts a date. */
    issueDate: string;
    academicYear: string;
    studentName: string;
    /** students.studentId */
    admissionId: string;
    fatherName: string | null;
    motherName: string | null;
    dateOfBirth: string | null;
    lastClass: string;
    lastSection: string | null;
    totalYearsAttended: number | null;
    reasonForLeaving: string | null;
    conduct: string;
    feeDues: string;
    boardExamRollNumber: string | null;
    finalGrade: string | null;
    remarks: string | null;
    school: {
        name: string;
        address: string | null;
        phone: string | null;
        email: string | null;
        logo: string | null;
        principalName: string | null;
    };
}

export async function renderTransferCertificate(data: TransferCertificateData): Promise<Uint8Array> {
    const { school } = data;
    const doc = await PDFDocument.create();

    doc.setTitle(`Transfer Certificate - ${data.studentName}`);
    doc.setProducer('Gurukul');
    doc.setCreator('Gurukul');

    const fonts = await loadFonts(doc);
    const c = new Cursor(doc, fonts, { top: 56, right: 60, bottom: 56, left: 60 }, A4);

    // ─── Header ──────────────────────────────────────────────────────────────────────────────────
    const logo = await embedLogo(doc, school.logo);
    if (logo) centeredImage(c, logo, 52, 8);

    centered(c, school.name.toUpperCase(), { size: 19, bold: true, tracking: 0.5 });
    if (school.address) centered(c, school.address, { size: 9.5, color: INK.muted });

    const contactLine = [school.phone ? `Tel: ${school.phone}` : null, school.email]
        .filter(Boolean).join('  |  ');
    if (contactLine) centered(c, contactLine, { size: 9.5, color: INK.muted });

    c.gap(14);
    rule(c, 2, INK.body, 20);

    // ─── Reference row ───────────────────────────────────────────────────────────────────────────
    spread(c, { label: 'TC No: ', value: data.tcNumber }, { label: 'Date: ', value: data.issueDate });
    c.gap(20);

    // ─── Title ───────────────────────────────────────────────────────────────────────────────────
    underlineCentered(c, 'TRANSFER CERTIFICATE', { size: 15, bold: true, tracking: 2, after: 18 });

    // ─── Particulars ─────────────────────────────────────────────────────────────────────────────
    const classLabel = `${data.lastClass}${data.lastSection ? `-${data.lastSection}` : ''}`;

    // Built by pushing so the optional fields drop out entirely rather than printing an empty row,
    // matching the `{x ? <Row/> : null}` conditionals in the react-pdf version.
    const rows: FieldRow[] = [
        { label: 'Name of Student', value: data.studentName },
        { label: 'Admission / Student ID', value: data.admissionId },
    ];
    if (data.fatherName) rows.push({ label: "Father's Name", value: data.fatherName });
    if (data.motherName) rows.push({ label: "Mother's Name", value: data.motherName });
    if (data.dateOfBirth) rows.push({ label: 'Date of Birth', value: data.dateOfBirth });
    rows.push({ label: 'Class Last Attended', value: `Class ${classLabel}` });
    rows.push({ label: 'Academic Year', value: data.academicYear });
    if (data.totalYearsAttended != null) rows.push({ label: 'Total Years Attended', value: String(data.totalYearsAttended) });
    rows.push({ label: 'Conduct', value: data.conduct });
    rows.push({ label: 'Fee Dues', value: data.feeDues });
    if (data.boardExamRollNumber) rows.push({ label: 'Board Exam Roll No.', value: data.boardExamRollNumber });
    if (data.finalGrade) rows.push({ label: 'Final Grade / Result', value: data.finalGrade });
    if (data.reasonForLeaving) rows.push({ label: 'Reason for Leaving', value: data.reasonForLeaving });

    fieldTable(c, rows);

    // ─── Declaration ─────────────────────────────────────────────────────────────────────────────
    c.gap(20);
    paragraph(
        c,
        `This is to certify that ${data.studentName} was a bona fide student of ${school.name}, `
        + `studying in Class ${classLabel} during the academic year ${data.academicYear}. `
        + `The particulars above are true to the best of the school's records. `
        + `We wish the student success in their future studies.`,
        { size: 11, after: 8 },
    );
    if (data.remarks) paragraph(c, `Remarks: ${data.remarks}`, { size: 11, after: 8 });

    // ─── Signature block ─────────────────────────────────────────────────────────────────────────
    // Seal on the left, principal's rule on the right, both sitting on the same baseline.
    c.gap(60);
    c.ensure(46);
    const signWidth = 200;
    const signX = c.right - signWidth;
    const baseline = c.y;

    c.page.drawText('School Seal', {
        x: c.left, y: baseline, size: 9.5, font: fonts.regular, color: INK.faint,
    });
    c.page.drawLine({
        start: { x: signX, y: baseline + 14 },
        end: { x: c.right, y: baseline + 14 },
        thickness: 1,
        color: INK.body,
    });

    const principal = school.principalName ?? 'Principal';
    const pw = measure(c, principal, { size: 11, bold: true });
    c.page.drawText(principal, {
        x: signX + (signWidth - pw) / 2, y: baseline, size: 11, font: fonts.bold, color: INK.body,
    });
    const sw = measure(c, school.name, { size: 9.5 });
    c.page.drawText(school.name, {
        x: signX + (signWidth - sw) / 2, y: baseline - 13, size: 9.5, font: fonts.regular, color: INK.muted,
    });

    return doc.save();
}
