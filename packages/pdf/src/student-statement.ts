import { PDFDocument, rgb } from 'pdf-lib';
import type { SchoolCalendarSystem } from '@repo/calendar';
import {
    A4, Cursor, GOLD, INK, documentHeader, loadFonts, stampFooter, table, twoColumnFields,
    type FieldRow,
} from './layout';

/**
 * The student statement of account, drawn with pdf-lib.
 *
 * Ported from the react-pdf document; see docs/worker-bundle-size.md section 10 for why.
 *
 * This is the first document here that genuinely runs to several pages, and the two things
 * react-pdf gave for free had to be rebuilt: the ledger header repeats on each page (`repeatHeader`
 * in `table()`), and the footer with "Page X of Y" is stamped in a pass after rendering, because
 * pdf-lib draws a page once and never revisits it - the page count does not exist until the end.
 */

/**
 * One rendered line of the ledger. Dates are pre-formatted (BS/AD) by the data builder so this
 * file stays display-only. `debit`/`credit` are null when the row does not move that column;
 * `balance` is the running net-owed after the row.
 */
export interface StatementRow {
    date: string;
    particulars: string;
    sub: string | null;
    debit: number | null;
    credit: number | null;
    balance: number;
    reversed: boolean;
}

export interface StudentStatementData {
    school: { name: string; logo: string | null; address: string | null; phone: string | null; email: string | null };
    student: { name: string; admissionNo: string; classSection: string; rollNo: string | null; guardian: string };
    /** pre-formatted (BS/AD) */
    academicYear: string;
    /** pre-formatted range or "All time" */
    period: string;
    /** pre-formatted */
    generatedAt: string;
    rows: StatementRow[];
    summary: {
        totalCharged: number;
        totalPaid: number;
        totalDiscounts: number;
        totalLateFees: number;
        advanceHeld: number;
        depositHeld: number;
        /** net due (>0) or credit held (<0) */
        closing: number;
    };
    calendarSystem?: SchoolCalendarSystem;
}

const PANEL = rgb(0.98, 0.98, 0.984);
const EMERALD = rgb(0.016, 0.471, 0.341);
const ROSE = rgb(0.624, 0.071, 0.224);

const npr = (n: number) => `NPR ${Math.round(n).toLocaleString()}`;

export async function renderStudentStatement(data: StudentStatementData): Promise<Uint8Array> {
    const doc = await PDFDocument.create();
    doc.setTitle(`Statement of Account - ${data.student.name}`);
    doc.setAuthor(data.school.name);
    doc.setProducer('Gurukul');
    doc.setCreator('Gurukul');

    const fonts = await loadFonts(doc);
    const margins = { top: 44, right: 44, bottom: 52, left: 44 };
    const c = new Cursor(doc, fonts, margins, A4);

    await documentHeader(c, doc, {
        school: data.school,
        badge: {
            label: 'Statement of Account',
            lines: [`Generated ${data.generatedAt}`, `Period: ${data.period}`],
        },
        goldRule: true,
    });

    // ─── Student block ────────────────────────────────────────────────────────────────────────────
    const left: FieldRow[] = [
        { label: 'Student', value: data.student.name },
        { label: 'Admission #', value: data.student.admissionNo },
        { label: 'Class', value: data.student.classSection + (data.student.rollNo ? ` · Roll ${data.student.rollNo}` : '') },
    ];
    const right: FieldRow[] = [
        { label: 'Guardian', value: data.student.guardian },
        { label: 'Academic year', value: data.academicYear },
    ];
    twoColumnFields(c, left, right);
    c.gap(16);

    // ─── Ledger ───────────────────────────────────────────────────────────────────────────────────
    // A reversed row is marked in the particulars rather than struck through: pdf-lib has no
    // text-decoration, and silently dropping the distinction on a financial ledger is not an
    // option - a reversed payment that reads as a live one is a dispute waiting to happen.
    const rows = data.rows.length === 0
        ? [['', 'No transactions for this period.', '', '', '']]
        : data.rows.map((r) => [
            r.date,
            r.particulars + (r.reversed ? '  (reversed)' : '') + (r.sub ? `\n${r.sub}` : ''),
            r.debit != null ? npr(r.debit) : '',
            r.credit != null ? npr(r.credit) : '',
            npr(Math.abs(r.balance)) + (r.balance < 0 ? ' Cr' : ''),
        ]);

    table(
        c,
        [
            { header: 'Date', width: 0.14 },
            { header: 'Particulars', width: 0.38 },
            { header: 'Debit', width: 0.16, align: 'right' },
            { header: 'Credit', width: 0.16, align: 'right' },
            { header: 'Balance', width: 0.16, align: 'right' },
        ],
        rows,
        { size: 8.5, headerFill: PANEL, repeatHeader: true },
    );

    // ─── Summary ──────────────────────────────────────────────────────────────────────────────────
    c.gap(18);
    const s = data.summary;
    const summaryRows: [string, string, ReturnType<typeof rgb>][] = [
        ['Total charged', npr(s.totalCharged), INK.body],
        ['Total paid', npr(s.totalPaid), INK.body],
    ];
    if (s.totalDiscounts > 0) summaryRows.push(['Discounts', npr(s.totalDiscounts), INK.body]);
    if (s.totalLateFees > 0) summaryRows.push(['Late fees', npr(s.totalLateFees), INK.body]);
    if (s.advanceHeld > 0) summaryRows.push(['Advance held', npr(s.advanceHeld), EMERALD]);
    if (s.depositHeld > 0) summaryRows.push(['Deposit held', npr(s.depositHeld), EMERALD]);

    // Right-hand summary panel, half width, like the react-pdf original.
    const panelW = c.contentWidth * 0.5;
    const panelX = c.right - panelW;
    const rowH = 15;
    const panelH = summaryRows.length * rowH + 34;
    c.ensure(panelH);
    c.page.drawRectangle({ x: panelX, y: c.y - panelH, width: panelW, height: panelH, color: PANEL });

    let y = c.y - 14;
    for (const [label, value, color] of summaryRows) {
        c.page.drawText(label, { x: panelX + 10, y: y - 9, size: 9, font: fonts.regular, color: INK.muted });
        const w = fonts.regular.widthOfTextAtSize(value, 9);
        c.page.drawText(value, { x: c.right - 10 - w, y: y - 9, size: 9, font: fonts.regular, color });
        y -= rowH;
    }

    // Closing line: "Amount due" or "Credit held", never a signed number - a negative on a bill is
    // read as a discount as often as it is read as a credit.
    const closingLabel = s.closing < 0 ? 'Credit held' : 'Amount due';
    const closingColor = s.closing < 0 ? EMERALD : ROSE;
    c.page.drawLine({
        start: { x: panelX + 10, y: y - 2 }, end: { x: c.right - 10, y: y - 2 },
        thickness: 0.8, color: GOLD,
    });
    c.page.drawText(closingLabel, { x: panelX + 10, y: y - 18, size: 10.5, font: fonts.bold, color: INK.body });
    const cv = npr(Math.abs(s.closing));
    const cw = fonts.bold.widthOfTextAtSize(cv, 11.5);
    c.page.drawText(cv, { x: c.right - 10 - cw, y: y - 18, size: 11.5, font: fonts.bold, color: closingColor });
    c.y -= panelH;

    stampFooter(
        doc, fonts,
        `Computer-generated statement from ${data.school.name} on Gurukul - valid without signature.`,
        margins,
    );

    return doc.save();
}
