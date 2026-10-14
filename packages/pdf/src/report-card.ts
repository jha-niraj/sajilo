import { PDFDocument, rgb, type RGB } from 'pdf-lib';
import { formatAcademicYear, type SchoolCalendarSystem } from '@repo/calendar';
import {
    A4, Cursor, INK, centered, centeredImage, embedLogo, loadFonts, paragraph, rule, stampFooter,
    table, twoColumnFields, type FieldRow,
} from './layout';

/**
 * The narrative student report card, drawn with pdf-lib.
 *
 * Ported from the react-pdf document; see docs/worker-bundle-size.md section 10 for why. Distinct
 * from the exam report-card BUNDLE (lib/pdf/report-card-bundle.ts): that one is a marks summary
 * printed per student for an exam, this one is the longer termly report with written sections.
 */

export type ReportCardPDFProps = {
    schoolName: string;
    /**
     * The school's address, printed under its name.
     *
     * Optional because this document predates it and a caller that does not pass one still
     * renders - it simply has no address line, exactly as before.
     */
    schoolAddress?: string | null;
    /**
     * A FETCHABLE url for the crest, never the stored R2 key.
     *
     * `embedLogo` does `fetch(url)`. The bucket is private, so the key on `schools.logo` is not a
     * url and fetching it throws - which `embedLogo` swallows, printing a card with no crest and
     * no error. The caller signs it (`signedStorageUrl`) and passes the result.
     */
    schoolLogoUrl?: string | null;
    reportNumber: string;
    reportTitle: string;
    reportType: string;
    /**
     * The AD session label as stored ("2026-27"). Converted at RENDER time via
     * `formatAcademicYear`, the same way `bill-invoice` does it - never pre-converted by the
     * caller, or a BS string would go through the converter twice.
     */
    academicYear: string;
    term: string | null;
    generatedDate: string;
    student: {
        firstName: string;
        lastName: string;
        currentClass: string;
        section: string;
        studentId: string;
    };
    overallGrade: string | null;
    overallPercentage: number | null;
    attendancePresent: number | null;
    attendanceTotal: number | null;
    subjectMarks: { subject: string; marksObtained: number; maxMarks: number; grade: string }[];
    academicPerformance: string | null;
    behavioralNotes: string | null;
    attendanceData: string | null;
    achievements: string | null;
    areasOfImprovement: string | null;
    teacherComments: string | null;
    principalRemarks: string | null;
    recommendations: string | null;
    /** Which calendar the card is printed in. Defaults to 'AD' when the caller omits it. */
    calendarSystem?: SchoolCalendarSystem;
};

const PANEL = rgb(0.976, 0.976, 0.980);
const PASS = rgb(0.086, 0.392, 0.204);
const FAIL = rgb(0.600, 0.106, 0.106);
const MID = rgb(0.573, 0.251, 0.055);

/**
 * The DB grade enum shown the way a parent reads it: "B_PLUS" -> "B+".
 *
 * Duplicated here rather than imported from `apps/main/lib/exam-constants` because this package is
 * rendered inside `gurukul-services` and cannot reach into an app. It is four lines and the enum
 * shape is fixed by the database, so the cost of the copy is lower than the cost of a shared
 * module pulled across a deployment boundary for it. A card printed "B_PLUS" beside a child's
 * name, which is what this fixes, is not a bug worth being subtle about.
 */
function readableGrade(grade: string | null | undefined): string {
    if (!grade) return '-';
    return grade.endsWith('_PLUS') ? `${grade.slice(0, -'_PLUS'.length)}+` : grade;
}

/**
 * Grade banding, carried over verbatim from the react-pdf version including its reasoning:
 * failing bands (E/F and "no grade") render red; A/B are clear passes; C/D stay amber as
 * borderline. An earlier version made only A+/A green and only F red, so a failing 'E' looked
 * like a warning and a passing B/C looked borderline.
 */
function gradeColor(grade: string): RGB {
    const g = (grade ?? '').toUpperCase().trim();
    if (g === 'F' || g === 'E' || g === 'NG') return FAIL;
    if (g.startsWith('A') || g.startsWith('B')) return PASS;
    return MID;
}

export async function renderReportCard(p: ReportCardPDFProps): Promise<Uint8Array> {
    const doc = await PDFDocument.create();
    doc.setTitle(`${p.reportTitle} - ${p.student.firstName} ${p.student.lastName}`);
    doc.setAuthor(p.schoolName);
    doc.setProducer('Gurukul');
    doc.setCreator('Gurukul');

    const fonts = await loadFonts(doc);
    const margins = { top: 40, right: 44, bottom: 48, left: 44 };
    const c = new Cursor(doc, fonts, margins, A4);

    // ─── Header ───────────────────────────────────────────────────────────────────────────────────
    // The crest first. `embedLogo` returns null for a missing, unreachable or non-image url, and
    // the header simply starts at the name - a card without a crest is still a card, a card that
    // failed to render is not.
    const logo = await embedLogo(doc, p.schoolLogoUrl ?? null);
    if (logo) centeredImage(c, logo, 40, 6);
    centered(c, p.schoolName, { size: 16, bold: true });
    if (p.schoolAddress) centered(c, p.schoolAddress, { size: 8.5, color: INK.muted });
    centered(c, p.reportTitle, { size: 10.5, color: INK.muted });
    centered(c, `Report No. ${p.reportNumber}`, { size: 8.5, color: INK.faint, after: 8 });
    rule(c, 1, INK.body, 14);

    // ─── Student ──────────────────────────────────────────────────────────────────────────────────
    const left: FieldRow[] = [
        { label: 'Student', value: `${p.student.firstName} ${p.student.lastName}` },
        { label: 'Class', value: `${p.student.currentClass}${p.student.section ? `-${p.student.section}` : ''}` },
        { label: 'Student ID', value: p.student.studentId },
    ];
    const right: FieldRow[] = [
        { label: 'Academic Year', value: formatAcademicYear(p.academicYear, p.calendarSystem ?? 'AD') },
        ...(p.term ? [{ label: 'Term', value: p.term }] : []),
        { label: 'Generated', value: p.generatedDate },
    ];
    twoColumnFields(c, left, right, 9.5);
    c.gap(14);

    // ─── Headline stats ───────────────────────────────────────────────────────────────────────────
    // Attendance shows "Not recorded" rather than 0% when nothing was marked. An unmarked register
    // is not a day the student missed, and a 0% on a report card sent home says it was.
    const attendance = p.attendanceTotal != null && p.attendanceTotal > 0 && p.attendancePresent != null
        ? `${Math.round((p.attendancePresent / p.attendanceTotal) * 100)}%`
        : 'Not recorded';

    const stats: [string, string, RGB][] = [
        ['Overall Grade', readableGrade(p.overallGrade), p.overallGrade ? gradeColor(p.overallGrade) : INK.body],
        ['Percentage', p.overallPercentage != null ? `${Math.round(p.overallPercentage)}%` : '-', INK.body],
        ['Attendance', attendance, INK.body],
    ];
    const bw = (c.contentWidth - 2 * 8) / 3;
    const bh = 46;
    c.ensure(bh);
    stats.forEach(([label, value, color], i) => {
        const x = c.left + i * (bw + 8);
        c.page.drawRectangle({ x, y: c.y - bh, width: bw, height: bh, color: PANEL });
        const vw = fonts.bold.widthOfTextAtSize(value, 15);
        c.page.drawText(value, { x: x + (bw - vw) / 2, y: c.y - 26, size: 15, font: fonts.bold, color });
        const lw = fonts.regular.widthOfTextAtSize(label, 8);
        c.page.drawText(label, { x: x + (bw - lw) / 2, y: c.y - 39, size: 8, font: fonts.regular, color: INK.faint });
    });
    c.y -= bh;
    c.gap(16);

    // ─── Subject marks ────────────────────────────────────────────────────────────────────────────
    if (p.subjectMarks.length > 0) {
        c.page.drawText('Subject Performance', { x: c.left, y: c.y - 10, size: 10, font: fonts.bold, color: INK.body });
        c.y -= 16;
        table(
            c,
            [
                { header: 'Subject', width: 0.46 },
                { header: 'Obtained', width: 0.18, align: 'right' },
                { header: 'Max', width: 0.18, align: 'right' },
                { header: 'Grade', width: 0.18, align: 'right' },
            ],
            p.subjectMarks.map((s) => [s.subject, String(s.marksObtained), String(s.maxMarks), readableGrade(s.grade)]),
            { size: 9.5, headerFill: PANEL, repeatHeader: true },
        );
        c.gap(14);
    }

    // ─── Written sections ─────────────────────────────────────────────────────────────────────────
    // Only sections with something in them are printed. An empty "Achievements" heading on a
    // report card reads as a judgement rather than a blank field.
    const sections: [string, string | null][] = [
        ['Academic Performance', p.academicPerformance],
        ['Attendance', p.attendanceData],
        ['Behaviour', p.behavioralNotes],
        ['Achievements', p.achievements],
        ['Areas for Improvement', p.areasOfImprovement],
        ['Teacher Comments', p.teacherComments],
        ['Principal Remarks', p.principalRemarks],
        ['Recommendations', p.recommendations],
    ];
    for (const [heading, body] of sections) {
        if (!body || !body.trim()) continue;
        c.ensure(34);
        c.page.drawText(heading, { x: c.left, y: c.y - 10, size: 9.5, font: fonts.bold, color: INK.body });
        c.y -= 15;
        paragraph(c, body.trim(), { size: 9.5, color: INK.muted, after: 12 });
    }

    // ─── Signatures ───────────────────────────────────────────────────────────────────────────────
    c.gap(30);
    c.ensure(30);
    const cellW = 160;
    const baseline = c.y;
    (['Class Teacher', 'Principal'] as const).forEach((label, i) => {
        const x = i === 0 ? c.left : c.right - cellW;
        c.page.drawLine({
            start: { x, y: baseline }, end: { x: x + cellW, y: baseline },
            thickness: 0.8, color: rgb(0.612, 0.639, 0.686),
        });
        const lw = fonts.regular.widthOfTextAtSize(label, 8.5);
        c.page.drawText(label, { x: x + (cellW - lw) / 2, y: baseline - 12, size: 8.5, font: fonts.regular, color: INK.faint });
    });
    c.y -= 30;

    stampFooter(doc, fonts, `${p.schoolName} · ${p.reportType} · Generated with Gurukul`, margins);

    return doc.save();
}
