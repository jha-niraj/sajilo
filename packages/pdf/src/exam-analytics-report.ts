import { PDFDocument, rgb, type RGB } from 'pdf-lib';
import { formatSchoolDate, type SchoolCalendarSystem } from '@repo/calendar';
import type { ExamAnalyticsReportData } from './types';
import {
    A4, Cursor, INK, centered, centeredImage, embedLogo, hbar, loadFonts, paragraph, rule,
    stampFooter, table,
} from './layout';

/**
 * The exam analytics report, drawn with pdf-lib.
 *
 * Ported from the react-pdf document; see docs/worker-bundle-size.md section 10 for why. Five
 * sections: school overview, subject performance, term trend, students needing attention, and the
 * written analysis.
 *
 * The two "charts" are drawn rather than rendered by a charting library - a bar is a filled
 * rectangle whose width is a fraction of a track, which is all these ever were.
 */

export interface SchoolInfo {
    name: string;
    logo: string | null;
    /** Optional: not every caller selects it, and the masthead simply omits the line. */
    address?: string | null;
}

const PANEL = rgb(0.976, 0.976, 0.980);
const LINE = rgb(0.820, 0.835, 0.859);
const EMERALD = rgb(0.02, 0.588, 0.412);
const AMBER = rgb(0.706, 0.404, 0.035);
const ROSE = rgb(0.745, 0.071, 0.235);

/** Bar colour by performance band, matching the react-pdf original. */
function barColor(pct: number): RGB {
    if (pct >= 70) return EMERALD;
    if (pct >= 50) return AMBER;
    return ROSE;
}

function difficultyTint(difficulty: string): { bg: RGB; fg: RGB } {
    const d = (difficulty ?? '').toLowerCase();
    if (d.includes('hard')) return { bg: rgb(0.996, 0.886, 0.886), fg: ROSE };
    if (d.includes('easy')) return { bg: rgb(0.82, 0.98, 0.90), fg: EMERALD };
    return { bg: rgb(0.996, 0.953, 0.780), fg: AMBER };
}

function newSection(doc: PDFDocument, fonts: Awaited<ReturnType<typeof loadFonts>>, margins: { top: number; right: number; bottom: number; left: number }): Cursor {
    return new Cursor(doc, fonts, margins, A4);
}

async function sectionHeader(c: Cursor, doc: PDFDocument, school: SchoolInfo, title: string, sub?: string): Promise<void> {
    const logo = await embedLogo(doc, school.logo);
    if (logo) centeredImage(c, logo, 34, 6);
    centered(c, school.name, { size: 17, bold: true });
    if (school.address) centered(c, school.address, { size: 8.5, color: INK.muted });
    c.gap(6);
    rule(c, 1, INK.body, 14);
    c.page.drawText(title, { x: c.left, y: c.y - 12, size: 12, font: c.fonts.bold, color: INK.body });
    c.y -= 20;
    if (sub) {
        c.page.drawText(sub, { x: c.left, y: c.y - 9, size: 9, font: c.fonts.regular, color: INK.muted });
        c.y -= 18;
    }
}

export async function renderExamAnalyticsReport(
    data: ExamAnalyticsReportData,
    school: SchoolInfo,
    calendarSystem: SchoolCalendarSystem = 'AD',
): Promise<Uint8Array> {
    const doc = await PDFDocument.create();
    doc.setTitle(`Exam Analytics - ${data.academicYear ?? ''}`.trim());
    doc.setAuthor(school.name);
    doc.setProducer('Gurukul');
    doc.setCreator('Gurukul');

    const fonts = await loadFonts(doc);
    const margins = { top: 40, right: 40, bottom: 48, left: 40 };

    const generated = (() => {
        try { return formatSchoolDate(new Date(data.generatedAt), calendarSystem, { day: '2-digit', month: 'short', year: 'numeric' }); }
        catch { return data.generatedAt; }
    })();

    // ─── 1. Overview ──────────────────────────────────────────────────────────────────────────────
    {
        const c = newSection(doc, fonts, margins);
        await sectionHeader(c, doc, school, 'School overview',
            [data.academicYear, data.termLabel].filter(Boolean).join('  ·  ') || undefined);

        const stats: [string, string, RGB][] = [
            ['Students', String(data.overall.totalStudents), INK.body],
            ['Average', `${Math.round(data.overall.avgPercentage)}%`, barColor(data.overall.avgPercentage)],
            ['Pass rate', `${Math.round(data.overall.passRate)}%`, barColor(data.overall.passRate)],
            ['At risk', String(data.overall.atRiskCount), data.overall.atRiskCount > 0 ? ROSE : INK.body],
        ];
        const bw = (c.contentWidth - 3 * 10) / 4;
        const bh = 60;
        c.ensure(bh);
        stats.forEach(([label, value, color], i) => {
            const x = c.left + i * (bw + 10);
            c.page.drawRectangle({ x, y: c.y - bh, width: bw, height: bh, color: PANEL, borderColor: LINE, borderWidth: 1 });
            const vw = fonts.bold.widthOfTextAtSize(value, 20);
            c.page.drawText(value, { x: x + (bw - vw) / 2, y: c.y - 34, size: 20, font: fonts.bold, color });
            const lw = fonts.regular.widthOfTextAtSize(label.toUpperCase(), 7.5);
            c.page.drawText(label.toUpperCase(), { x: x + (bw - lw) / 2, y: c.y - 50, size: 7.5, font: fonts.regular, color: INK.faint });
        });
        c.y -= bh;
        c.gap(20);

        if (data.narrative.summary) {
            c.page.drawText('Summary', { x: c.left, y: c.y - 10, size: 10, font: fonts.bold, color: INK.body });
            c.y -= 16;
            paragraph(c, data.narrative.summary, { size: 9.5, color: INK.muted });
        }
        c.gap(10);
        c.page.drawText(`Generated ${generated}`, { x: c.left, y: c.y - 8, size: 8, font: fonts.regular, color: INK.faint });
    }

    // ─── 2. Subjects ──────────────────────────────────────────────────────────────────────────────
    {
        const c = newSection(doc, fonts, margins);
        await sectionHeader(c, doc, school, 'Subject performance',
            'Average marks and relative difficulty across published results.');

        if (data.subjects.length === 0) {
            paragraph(c, 'No published subject results for this period.', { size: 9.5, color: INK.muted });
        } else {
            for (const s of data.subjects) {
                const tint = difficultyTint(s.difficulty);
                // The vs-school-average figure is signed on purpose - it is a comparison, and the
                // sign is the whole content of it.
                const vs = s.vsSchoolAvg >= 0 ? `+${Math.round(s.vsSchoolAvg)}` : String(Math.round(s.vsSchoolAvg));
                hbar(c, {
                    label: s.name,
                    sub: s.code,
                    percent: s.avgPercentage,
                    value: `${Math.round(s.avgPercentage)}%`,
                    note: `${s.difficulty} · pass ${Math.round(s.passRate)}% · vs avg ${vs}`,
                    fill: barColor(s.avgPercentage),
                    track: tint.bg,
                });
            }
        }
    }

    // ─── 3. Trend ─────────────────────────────────────────────────────────────────────────────────
    {
        const c = newSection(doc, fonts, margins);
        await sectionHeader(c, doc, school, 'Performance trend',
            'Overall average (%) across recent exam terms.');

        if (data.termSeries.length === 0) {
            paragraph(c, 'Not enough published terms to show a trend.', { size: 9.5, color: INK.muted });
        } else {
            // A column chart: one bar per term, heights on a fixed 0-100 scale so two reports of
            // the same school are comparable. Auto-scaling to the max would make a bad term look
            // like a good one.
            const chartH = 180;
            const n = data.termSeries.length;
            const gap = 14;
            const colW = Math.min(56, (c.contentWidth - gap * (n - 1)) / n);
            const baseY = c.y - chartH;
            c.ensure(chartH + 30);

            // Gridlines at 0/25/50/75/100.
            for (const g of [0, 25, 50, 75, 100]) {
                const gy = baseY + (g / 100) * chartH;
                c.page.drawLine({ start: { x: c.left + 24, y: gy }, end: { x: c.right, y: gy }, thickness: 0.4, color: INK.rule });
                c.page.drawText(`${g}`, { x: c.left, y: gy - 3, size: 7, font: fonts.regular, color: INK.faint });
            }

            data.termSeries.forEach((p, i) => {
                const x = c.left + 30 + i * (colW + gap);
                const h = Math.max(0, Math.min(100, p.avg)) / 100 * chartH;
                c.page.drawRectangle({ x, y: baseY, width: colW, height: h, color: barColor(p.avg) });
                const v = `${Math.round(p.avg)}%`;
                const vw = fonts.bold.widthOfTextAtSize(v, 8);
                c.page.drawText(v, { x: x + (colW - vw) / 2, y: baseY + h + 4, size: 8, font: fonts.bold, color: INK.body });
                const lw = fonts.regular.widthOfTextAtSize(p.term, 7);
                c.page.drawText(p.term, { x: x + (colW - lw) / 2, y: baseY - 11, size: 7, font: fonts.regular, color: INK.muted });
            });
            c.y = baseY - 24;
        }
    }

    // ─── 4. At risk ───────────────────────────────────────────────────────────────────────────────
    {
        const c = newSection(doc, fonts, margins);
        await sectionHeader(c, doc, school, 'Students needing attention',
            'Flagged on attendance, last-term results, and performance trend.');

        if (data.atRisk.length === 0) {
            // Said in words. An empty table reads as a broken query, not as good news.
            paragraph(c, 'No students are currently flagged.', { size: 9.5, color: INK.muted });
        } else {
            table(
                c,
                [
                    { header: 'Student', width: 0.30 },
                    { header: 'Class', width: 0.14 },
                    { header: 'Roll', width: 0.10, align: 'right' },
                    { header: 'Risk', width: 0.10, align: 'right' },
                    { header: 'Reasons', width: 0.36 },
                ],
                data.atRisk.map((s) => [
                    s.name,
                    `${s.class}${s.section ? `-${s.section}` : ''}`,
                    s.rollNumber != null ? String(s.rollNumber) : '-',
                    String(Math.round(s.riskScore)),
                    s.reasons.join('; '),
                ]),
                { size: 8.5, headerFill: PANEL, repeatHeader: true },
            );
        }
    }

    // ─── 5. Narrative ─────────────────────────────────────────────────────────────────────────────
    {
        const c = newSection(doc, fonts, margins);
        await sectionHeader(c, doc, school, 'Analysis and recommendations');

        const parts: [string, string][] = [
            ['Strengths', data.narrative.strengths],
            ['Concerns', data.narrative.concerns],
            ['Recommendations', data.narrative.recommendations],
        ];
        for (const [heading, body] of parts) {
            if (!body || !body.trim()) continue;
            c.ensure(30);
            c.page.drawText(heading, { x: c.left, y: c.y - 10, size: 10, font: fonts.bold, color: INK.body });
            c.y -= 16;
            paragraph(c, body.trim(), { size: 9.5, color: INK.muted, after: 14 });
        }
    }

    stampFooter(doc, fonts, `${school.name} · Exam analytics · Generated with Gurukul`, margins);

    return doc.save();
}
