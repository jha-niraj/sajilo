import { PDFDocument, rgb } from 'pdf-lib';
import { formatAcademicYear } from '@repo/calendar';
import type { ReportCardBundle, ReportCardStudent } from './types';
import {
    A4, Cursor, INK, centered, centeredImage, embedLogo, loadFonts, rule, table, twoColumnFields,
    type FieldRow,
} from './layout';

/**
 * The report-card bundle - one card per student, one page each - drawn with pdf-lib.
 *
 * Ported from the react-pdf document; see docs/worker-bundle-size.md section 10 for why.
 *
 * One student per page, deliberately: these are printed and handed out individually, so a card
 * that flows onto a shared page is a card that cannot be given to a parent.
 */

const PANEL = rgb(0.976, 0.976, 0.980);
const EMERALD = rgb(0.02, 0.588, 0.412);
const EMERALD_TINT = rgb(0.82, 0.98, 0.90);
const ROSE = rgb(0.745, 0.071, 0.235);
const ROSE_TINT = rgb(0.996, 0.886, 0.886);

const pct = (n: number) => `${Math.round(n)}%`;

async function drawCard(c: Cursor, doc: PDFDocument, student: ReportCardStudent, bundle: ReportCardBundle): Promise<void> {
    const passed = student.resultStatus === 'PASS' || student.resultStatus === 'PASSED';

    const logo = await embedLogo(doc, bundle.school?.logo ?? null);
    if (logo) centeredImage(c, logo, 38, 6);
    centered(c, bundle.school?.name ?? 'School', { size: 15, bold: true });
    if (bundle.school?.address) centered(c, bundle.school.address, { size: 8.5, color: INK.muted });
    centered(c, `Report Card · ${bundle.examName}`, { size: 11, bold: true, after: 8 });
    rule(c, 1, INK.body, 14);

    const left: FieldRow[] = [
        { label: 'Name', value: student.name },
        { label: 'Class', value: `${bundle.className ?? ''}${student.section ? `-${student.section}` : ''}` },
    ];
    const right: FieldRow[] = [
        { label: 'Roll', value: student.rollNumber != null ? String(student.rollNumber) : '-' },
        // Converted here rather than by the caller: `academicYear` is the stored AD session label
        // ("2026-27"), and a card printed for a Bikram Sambat school has to say 2083-84 like every
        // other document that school hands out.
        { label: 'Academic Year', value: formatAcademicYear(bundle.academicYear, bundle.calendarSystem ?? 'AD') },
    ];
    twoColumnFields(c, left, right, 9.5);
    c.gap(14);

    // ─── Subjects ─────────────────────────────────────────────────────────────────────────────────
    // An absent student shows "AB" and a dash for the grade rather than a zero. A zero is a mark
    // that was earned; absence is the absence of a mark, and averaging the two is how a missed
    // paper turns into a failed one.
    table(
        c,
        [
            { header: 'Subject', width: 0.46 },
            { header: 'Obtained', width: 0.18, align: 'right' },
            { header: 'Max', width: 0.18, align: 'right' },
            { header: 'Grade', width: 0.18, align: 'right' },
        ],
        student.subjects.map((s) => [
            s.name,
            s.isAbsent ? 'AB' : String(s.obtained),
            String(s.maxMarks),
            s.isAbsent ? '-' : String(s.grade),
        ]),
        { size: 9.5, headerFill: PANEL, repeatHeader: true },
    );

    // ─── Summary boxes ────────────────────────────────────────────────────────────────────────────
    c.gap(14);
    const boxes: [string, string][] = [
        ['Total', `${student.totalObtained}/${student.totalMaxMarks}`],
        ['Percentage', pct(student.percentage)],
        ['Grade', String(student.grade)],
        ['Rank', student.rank != null ? String(student.rank) : '-'],
    ];
    const bw = (c.contentWidth - 3 * 8) / 4;
    const bh = 40;
    c.ensure(bh);
    boxes.forEach(([label, value], i) => {
        const x = c.left + i * (bw + 8);
        c.page.drawRectangle({ x, y: c.y - bh, width: bw, height: bh, color: PANEL });
        const lw = c.fonts.regular.widthOfTextAtSize(label, 8);
        c.page.drawText(label, { x: x + (bw - lw) / 2, y: c.y - 15, size: 8, font: c.fonts.regular, color: INK.faint });
        const vw = c.fonts.bold.widthOfTextAtSize(value, 13);
        c.page.drawText(value, { x: x + (bw - vw) / 2, y: c.y - 32, size: 13, font: c.fonts.bold, color: INK.body });
    });
    c.y -= bh;

    // ─── Result ───────────────────────────────────────────────────────────────────────────────────
    c.gap(12);
    const resultText = `Result: ${passed ? 'PASS' : student.resultStatus || 'PENDING'}`;
    const rh = 24;
    c.ensure(rh);
    c.page.drawRectangle({ x: c.left, y: c.y - rh, width: c.contentWidth, height: rh, color: passed ? EMERALD_TINT : ROSE_TINT });
    const rw = c.fonts.bold.widthOfTextAtSize(resultText, 10.5);
    c.page.drawText(resultText, {
        x: c.left + (c.contentWidth - rw) / 2, y: c.y - 16,
        size: 10.5, font: c.fonts.bold, color: passed ? EMERALD : ROSE,
    });
    c.y -= rh;

    // ─── Signatures ───────────────────────────────────────────────────────────────────────────────
    c.gap(46);
    c.ensure(30);
    const cellW = 150;
    const lineW = 130;
    const baseline = c.y;
    (['Class Teacher', 'Principal'] as const).forEach((label, i) => {
        const x = i === 0 ? c.left : c.right - cellW;
        const lineX = x + (cellW - lineW) / 2;
        c.page.drawLine({
            start: { x: lineX, y: baseline }, end: { x: lineX + lineW, y: baseline },
            thickness: 0.8, color: rgb(0.612, 0.639, 0.686),
        });
        const lw = c.fonts.regular.widthOfTextAtSize(label, 8.5);
        c.page.drawText(label, { x: x + (cellW - lw) / 2, y: baseline - 12, size: 8.5, font: c.fonts.regular, color: INK.faint });
    });
    c.y -= 30;
}

export async function renderReportCardBundle(bundle: ReportCardBundle): Promise<Uint8Array> {
    const doc = await PDFDocument.create();
    doc.setTitle(`Report Cards - ${bundle.examName}`);
    doc.setAuthor(bundle.school?.name ?? 'Gurukul');
    doc.setProducer('Gurukul');
    doc.setCreator('Gurukul');

    const fonts = await loadFonts(doc);
    const margins = { top: 40, right: 44, bottom: 40, left: 44 };

    // An empty bundle still produces a valid one-page PDF saying so. Returning a zero-page document
    // gives the browser a file it refuses to open, which reads as a crash rather than "no results".
    if (bundle.students.length === 0) {
        const c = new Cursor(doc, fonts, margins, A4);
        centered(c, bundle.school?.name ?? 'School', { size: 15, bold: true });
        centered(c, `Report Card · ${bundle.examName}`, { size: 11, bold: true, after: 12 });
        centered(c, 'No students in this bundle.', { size: 10, color: INK.muted });
        return doc.save();
    }

    for (let i = 0; i < bundle.students.length; i++) {
        const c = new Cursor(doc, fonts, margins, A4);
        // `new Cursor` adds a page, so the first student uses the page it just made and each
        // subsequent student starts a fresh one - which is the one-card-per-page rule.
        await drawCard(c, doc, bundle.students[i]!, bundle);
    }

    return doc.save();
}
