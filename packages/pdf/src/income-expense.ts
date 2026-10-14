import { PDFDocument, rgb } from 'pdf-lib';
import type { SchoolCalendarSystem } from '@repo/calendar';
import {
    A4, Cursor, GOLD, INK, centered, documentHeader, loadFonts, rule, sectionBar, stampFooter, table,
} from './layout';

/**
 * The Income & Expenditure statement, drawn with pdf-lib.
 *
 * Ported from the react-pdf document; see docs/worker-bundle-size.md section 10 for why. The
 * numbers come from the shared builder, so the PDF and the .xlsx form of the same statement (now
 * served by gurukul-services) cannot disagree.
 */

/**
 * One line of the statement. `amount` is always positive; the section it sits in - income or
 * expenditure - gives it its meaning. Labels are pre-built by the data builder.
 */
export interface StatementLine {
    label: string;
    amount: number;
}

export interface IncomeExpenseStatementData {
    school: { name: string; logo: string | null; address: string | null; phone: string | null; email: string | null };
    /** '2081/82' (BS) or '2026' (AD) */
    fyCode: string;
    /** pre-formatted AD/BS date range */
    period: string;
    /** pre-formatted */
    generatedAt: string;
    income: { lines: StatementLine[]; subtotal: number };
    expense: { lines: StatementLine[]; subtotal: number };
    /** income.subtotal - expense.subtotal (>= 0 surplus, < 0 deficit) */
    netSurplus: number;
    calendarSystem?: SchoolCalendarSystem;
}

const PANEL = rgb(0.98, 0.98, 0.984);
const SECTION_FILL = rgb(0.961, 0.949, 0.918);
const EMERALD = rgb(0.016, 0.471, 0.341);
const ROSE = rgb(0.624, 0.071, 0.224);

const npr = (n: number) => `NPR ${Math.round(n).toLocaleString()}`;

export async function renderIncomeExpenseStatement(data: IncomeExpenseStatementData): Promise<Uint8Array> {
    const doc = await PDFDocument.create();
    doc.setTitle(`Income & Expenditure Statement - FY ${data.fyCode}`);
    doc.setAuthor(data.school.name);
    doc.setProducer('Gurukul');
    doc.setCreator('Gurukul');

    const fonts = await loadFonts(doc);
    const margins = { top: 40, right: 44, bottom: 52, left: 44 };
    const c = new Cursor(doc, fonts, margins, A4);

    await documentHeader(c, doc, {
        school: data.school,
        badge: { label: 'Financial Statement', lines: [`Generated ${data.generatedAt}`] },
        goldRule: true,
    });

    // ─── Title ────────────────────────────────────────────────────────────────────────────────────
    centered(c, 'Income & Expenditure Statement', { size: 13, bold: true });
    centered(c, `For the fiscal year ${data.fyCode} (${data.period})`, { size: 9, color: INK.muted, after: 14 });

    const columns = [
        { header: 'Particulars', width: 0.7 as const },
        { header: 'Amount', width: 0.3 as const, align: 'right' as const },
    ];

    // ─── Income ───────────────────────────────────────────────────────────────────────────────────
    // An empty section says so in words. Printing only a zero subtotal would read as "we earned
    // nothing", when the truth is usually "nothing has been recorded for this period yet".
    sectionBar(c, 'Income', SECTION_FILL);
    table(
        c, columns,
        data.income.lines.length > 0
            ? [
                ...data.income.lines.map((l) => [l.label, npr(l.amount)]),
                ['Total income', npr(data.income.subtotal)],
            ]
            : [['No income recorded for this period.', ''], ['Total income', npr(data.income.subtotal)]],
        { size: 9.5, headerFill: PANEL, repeatHeader: true, emphasiseLast: true },
    );

    // ─── Expenditure ──────────────────────────────────────────────────────────────────────────────
    c.gap(14);
    sectionBar(c, 'Expenditure', SECTION_FILL);
    table(
        c, columns,
        data.expense.lines.length > 0
            ? [
                ...data.expense.lines.map((l) => [l.label, npr(l.amount)]),
                ['Total expenditure', npr(data.expense.subtotal)],
            ]
            : [['No expenditure recorded for this period.', ''], ['Total expenditure', npr(data.expense.subtotal)]],
        { size: 9.5, headerFill: PANEL, repeatHeader: true, emphasiseLast: true },
    );

    // ─── Net ──────────────────────────────────────────────────────────────────────────────────────
    // Labelled surplus or deficit and printed as a positive figure. A bare negative number in an
    // amount column is the classic way for a deficit to be read as a credit.
    c.gap(16);
    rule(c, 1.2, GOLD, 8);
    const isDeficit = data.netSurplus < 0;
    const label = isDeficit ? 'Net Deficit' : 'Net Surplus';
    const value = npr(Math.abs(data.netSurplus));
    c.ensure(24);
    const y = c.y - 13;
    c.page.drawText(label, { x: c.left + 4, y, size: 12, font: fonts.bold, color: INK.body });
    const w = fonts.bold.widthOfTextAtSize(value, 13);
    c.page.drawText(value, { x: c.right - 4 - w, y, size: 13, font: fonts.bold, color: isDeficit ? ROSE : EMERALD });
    c.y -= 24;

    stampFooter(
        doc, fonts,
        `Computer-generated statement from ${data.school.name} on Gurukul - valid without signature.`,
        margins,
    );

    return doc.save();
}
