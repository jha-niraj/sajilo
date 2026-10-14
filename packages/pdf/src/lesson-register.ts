import { PDFDocument } from 'pdf-lib';
import {
    INK, Cursor, loadFonts, centered, rule, spread, table, documentHeader, stampFooter,
    A4_LANDSCAPE,
} from './layout';
import type { LessonRegisterData } from './types';

/**
 * The lesson-plan delivery register for one teacher over a date range.
 *
 * ## Why this is a document
 *
 * The page it comes from says so in its own subtitle: "print it for inspection". It carries the
 * teacher's and the supervisor's signature, and it is the evidence a school produces when asked
 * whether the syllabus was actually taught. That is not a working view.
 *
 * ## The bug in the version this replaces
 *
 * The register table sat inside a horizontal `ScrollArea`. `window.print()` prints the visible box,
 * so on a narrow window the Status column - the entire point of the register - printed clipped or
 * not at all, with no indication anything was cut. A fixed A4 layout cannot clip: the columns are
 * fractions of the page, so every one of them is on the paper.
 *
 * ## Landscape
 *
 * Six columns, two of which hold free text (lesson title, reason). Portrait squeezes the lesson
 * column to about 90pt, which wraps almost every row onto three lines and doubles the page count.
 */

const COLUMNS = [
    { header: 'Date', width: 0.13 },
    { header: 'Period', width: 0.07, align: 'right' as const },
    { header: 'Class', width: 0.10 },
    { header: 'Subject', width: 0.17 },
    { header: 'Lesson', width: 0.33 },
    { header: 'Status', width: 0.20 },
];

export async function renderLessonRegister(data: LessonRegisterData): Promise<Uint8Array> {
    const doc = await PDFDocument.create();
    const fonts = await loadFonts(doc);
    const c = new Cursor(doc, fonts, { top: 46, right: 44, bottom: 52, left: 44 }, A4_LANDSCAPE);

    await documentHeader(c, doc, {
        school: { ...data.school, email: null },
        badge: {
            label: 'LESSON-PLAN REGISTER',
            ref: `${data.fromLabel} - ${data.toLabel}`,
            lines: [data.teacherName || 'Teacher'],
        },
    });

    c.gap(4);
    spread(c,
        { label: 'Teacher', value: data.teacherName || '-' },
        { label: 'Period covered', value: `${data.fromLabel} to ${data.toLabel}` });
    spread(c,
        { label: 'Entries', value: String(data.entries.length) },
        { label: 'Generated', value: data.generatedOn });
    c.gap(8);
    rule(c, 0.75, INK.rule, 10);

    if (data.entries.length === 0) {
        // Stated, not implied. A blank register and a register that failed to load look the same.
        centered(c, 'No delivery was logged in this period.', { size: 11, color: INK.muted, after: 6 });
        centered(c, 'Entries appear here as lessons are marked Taught / Partly / Not taught on Today.', {
            size: 9, color: INK.muted, after: 8,
        });
    } else {
        table(c, COLUMNS,
            data.entries.map((e) => [
                e.date,
                String(e.periodNumber),
                e.classLabel,
                e.subject,
                e.lesson || '-',
                e.reason ? `${e.status} (${e.reason})` : e.status,
            ]),
            { repeatHeader: true, size: 9 },
        );

        // ── Tally ────────────────────────────────────────────────────────────────────────
        // An inspector reads the totals first. Counting 60 rows by eye to answer "how many were
        // not taught" is exactly the question the register exists to answer.
        c.gap(12);
        rule(c, 0.75, INK.rule, 8);
        centered(c, 'TALLY', { size: 8.5, bold: true, color: INK.muted, after: 6 });

        const tally = new Map<string, number>();
        for (const e of data.entries) tally.set(e.status, (tally.get(e.status) ?? 0) + 1);
        const pairs = [...tally.entries()].sort((a, b) => b[1] - a[1]);
        for (let i = 0; i < pairs.length; i += 2) {
            const [l, r] = [pairs[i], pairs[i + 1]];
            spread(c,
                { label: l![0], value: String(l![1]) },
                r ? { label: r[0], value: String(r[1]) } : { label: '', value: '' });
        }
    }

    // ── Signatures ───────────────────────────────────────────────────────────────────────
    c.gap(24);
    c.ensure(40);
    const half = c.contentWidth / 2 - 40;
    for (const [i, label] of ["Teacher's signature", "Supervisor's signature"].entries()) {
        const x = i === 0 ? c.left : c.right - half;
        c.page.drawLine({
            start: { x, y: c.y }, end: { x: x + half, y: c.y },
            thickness: 0.5, color: INK.rule,
        });
        c.page.drawText(label, { x, y: c.y - 10, size: 8, font: fonts.regular, color: INK.muted });
    }
    c.y -= 24;

    stampFooter(doc, fonts, `Lesson-plan register - ${data.generatedOn}`, {
        top: 46, right: 44, bottom: 40, left: 44,
    });
    return doc.save();
}
