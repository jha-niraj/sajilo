import { PDFDocument, rgb, type PDFPage, type PDFFont } from 'pdf-lib';
import { A4, INK, embedLogo, loadFonts, wrap } from './layout';
import type { AdmitCardBatch, AdmitCardStudent } from './types';

/**
 * Admit cards, drawn with pdf-lib.
 *
 * ## Why this is not browser print
 *
 * The page used to render HTML cards and rely on `@media print`. Three things were wrong with that
 * and none were fixable in CSS: the browser broke pages through the middle of a card, long venue
 * names wrapped a table cell and pushed the card past its own border, and the output depended on
 * which browser and which paper size the school happened to have. A generated PDF is identical on
 * every machine, and - because it is `pdf-lib` and not react-pdf - it also runs on Cloudflare,
 * where runtime WASM compilation is forbidden.
 *
 * ## Two cards per A4, drawn at fixed coordinates
 *
 * A card is a FIXED box, positioned by this file rather than flowed. That is the whole reason the
 * page breaks are correct: nothing can push a card across a boundary because nothing flows. A card
 * whose sitting list is too long for its box truncates with a "+N more" line instead of overrunning
 * into the card below it - a slightly abbreviated card is usable, a corrupted one is not.
 */

const CARD_MARGIN = 28;
const CARD_GAP = 16;
const CARD_H = (A4.height - CARD_MARGIN * 2 - CARD_GAP) / 2;
const CARD_W = A4.width - CARD_MARGIN * 2;
const PAD = 16;

const RULE = rgb(0.85, 0.85, 0.87);
const PANEL = rgb(0.97, 0.97, 0.98);

interface Ctx {
    page: PDFPage;
    regular: PDFFont;
    bold: PDFFont;
}

/** Draw one card with its top-left corner at (x, top). Returns nothing - the box is fixed. */
function drawCard(
    ctx: Ctx,
    batch: AdmitCardBatch,
    student: AdmitCardStudent,
    x: number,
    top: number,
    logo: Awaited<ReturnType<typeof embedLogo>>,
): void {
    const { page, regular, bold } = ctx;
    const right = x + CARD_W;
    let y = top;

    // The card's own boundary. Dashed in the HTML version so it could be cut out; a solid hairline
    // reads better in print and the cut line is the page edge anyway at two-up.
    page.drawRectangle({
        x, y: top - CARD_H, width: CARD_W, height: CARD_H,
        borderColor: RULE, borderWidth: 0.8,
    });

    const cx = x + CARD_W / 2;
    const centre = (text: string, size: number, font: PDFFont, color = INK.body) => {
        const w = font.widthOfTextAtSize(text, size);
        page.drawText(text, { x: cx - w / 2, y, size, font, color });
    };

    y -= PAD + 12;
    if (logo) {
        const h = 26;
        const w = (logo.width / logo.height) * h;
        page.drawImage(logo.image, { x: cx - w / 2, y: y - 6, width: w, height: h });
        y -= h + 4;
    }
    centre(batch.school.name, 12.5, bold);
    y -= 12;
    if (batch.school.address) { centre(batch.school.address, 8, regular, INK.muted); y -= 10; }
    if (batch.school.phone) { centre(batch.school.phone, 8, regular, INK.muted); y -= 10; }

    y -= 4;
    page.drawLine({ start: { x: x + PAD, y }, end: { x: right - PAD, y }, thickness: 0.8, color: RULE });
    y -= 14;

    centre('ADMIT CARD', 10, bold);
    y -= 11;
    centre(`${batch.examName} · ${batch.academicYear}`, 8.5, regular, INK.muted);
    y -= 14;

    // ── Student panel ────────────────────────────────────────────────────────
    const panelH = 44;
    page.drawRectangle({
        x: x + PAD, y: y - panelH, width: CARD_W - PAD * 2, height: panelH,
        color: PANEL, borderColor: RULE, borderWidth: 0.5,
    });
    const colW = (CARD_W - PAD * 2) / 2;
    const field = (label: string, value: string, col: 0 | 1, row: 0 | 1) => {
        const fx = x + PAD + 8 + col * colW;
        const fy = y - 12 - row * 20;
        page.drawText(label, { x: fx, y: fy, size: 6.5, font: regular, color: INK.muted });
        page.drawText(value || '-', { x: fx, y: fy - 10, size: 9, font: bold, color: INK.body });
    };
    field('Name', student.name, 0, 0);
    field('Roll No.', student.rollNumber ?? '-', 1, 0);
    field('Class', student.classLabel, 0, 1);
    if (student.boardRegistrationNumber) field('Board Reg. No.', student.boardRegistrationNumber, 1, 1);
    y -= panelH + 12;

    // ── Sittings ─────────────────────────────────────────────────────────────
    // Fixed columns, and the venue is the one that gets truncated because it is the only field
    // whose length is unbounded. Truncating here is what stops a long hall name pushing the marks
    // column off the card, which is exactly what the HTML table did.
    const cols = [
        { label: 'Subject', w: 118 },
        { label: 'Date', w: 84 },
        { label: 'Time', w: 66 },
        { label: 'Venue', w: CARD_W - PAD * 2 - 118 - 84 - 66 - 36 },
        { label: 'Marks', w: 36 },
    ];
    let hx = x + PAD;
    for (const col of cols) {
        page.drawText(col.label, { x: hx, y, size: 6.5, font: bold, color: INK.muted });
        hx += col.w;
    }
    y -= 5;
    page.drawLine({ start: { x: x + PAD, y }, end: { x: right - PAD, y }, thickness: 0.5, color: RULE });
    y -= 11;

    // How many rows fit before the signature block. Computed rather than assumed, so a card with
    // twelve sittings degrades predictably instead of drawing over the footer.
    const footerTop = top - CARD_H + 46;
    const maxRows = Math.max(0, Math.floor((y - footerTop) / 12));
    const shown = student.sittings.slice(0, maxRows === 0 ? 0 : maxRows - (student.sittings.length > maxRows ? 1 : 0));

    for (const s of shown) {
        let sx = x + PAD;
        const cells = [
            s.subject,
            s.date,
            s.time,
            s.venue ?? '-',
            s.maxMarks != null ? String(s.maxMarks) : '-',
        ];
        cells.forEach((text, i) => {
            const col = cols[i]!;
            // One line per cell, clipped to the column. `wrap` gives the first line that fits.
            const line = wrap(regular, text, 7.5, col.w - 4)[0] ?? '';
            page.drawText(line, { x: sx, y, size: 7.5, font: i === 0 ? bold : regular, color: INK.body });
            sx += col.w;
        });
        y -= 12;
    }
    if (student.sittings.length > shown.length) {
        page.drawText(`+${student.sittings.length - shown.length} more - see the notice board`, {
            x: x + PAD, y, size: 7, font: regular, color: INK.muted,
        });
    }

    // ── Signature + stamp ────────────────────────────────────────────────────
    const sigY = top - CARD_H + PAD + 14;
    page.drawLine({ start: { x: x + PAD, y: sigY }, end: { x: x + PAD + 96, y: sigY }, thickness: 0.6, color: RULE });
    page.drawText("Principal's Signature", { x: x + PAD, y: sigY - 9, size: 6.5, font: regular, color: INK.muted });

    const stampX = right - PAD - 96;
    const embeddedStamp = batch.stamp?.embedded as
        | { width: number; height: number }
        | undefined;
    if (batch.stamp?.mode === 'DIGITAL' && embeddedStamp) {
        // A digital stamp is drawn ON the card. Sized to fit the reserved box rather than its own
        // aspect, because a tall stamp would otherwise climb into the sittings table.
        const boxH = 40;
        const w = Math.min(96, (embeddedStamp.width / embeddedStamp.height) * boxH);
        ctx.page.drawImage(embeddedStamp as Parameters<PDFPage['drawImage']>[0], {
            x: stampX + (96 - w) / 2, y: sigY - 4, width: w, height: boxH,
            opacity: 0.9,
        });
    } else {
        // PHYSICAL (or unset): leave the space EMPTY. The office stamps it by hand, and printing
        // the words "School Stamp" across the spot they need to stamp is worse than nothing.
        page.drawLine({ start: { x: stampX, y: sigY }, end: { x: right - PAD, y: sigY }, thickness: 0.6, color: RULE });
        page.drawText('School Stamp', { x: stampX, y: sigY - 9, size: 6.5, font: regular, color: INK.muted });
    }
}

export async function renderAdmitCards(batch: AdmitCardBatch): Promise<Uint8Array> {
    const doc = await PDFDocument.create();
    const fonts = await loadFonts(doc);
    const logo = await embedLogo(doc, batch.school.logo ?? null);

    // A digital stamp is embedded ONCE and reused on every card - embedding per card would put the
    // same image in the file 44 times and balloon a two-page document into megabytes.
    let stamp = batch.stamp;
    if (stamp?.mode === 'DIGITAL' && stamp.image) {
        try {
            const bytes = Uint8Array.from(atob(stamp.image.split(',').pop() ?? ''), (ch) => ch.charCodeAt(0));
            const embedded = stamp.image.includes('image/jpeg')
                ? await doc.embedJpg(bytes)
                : await doc.embedPng(bytes);
            stamp = { ...stamp, embedded };
        } catch {
            // A stamp that will not decode must not take the whole batch down - the card is still
            // valid without it, and the office can stamp by hand.
            stamp = { mode: 'PHYSICAL' };
        }
    }
    const withStamp: AdmitCardBatch = { ...batch, stamp };

    const students = batch.students;
    if (students.length === 0) {
        const page = doc.addPage([A4.width, A4.height]);
        page.drawText('No students to issue admit cards for.', {
            x: CARD_MARGIN, y: A4.height - 80, size: 11, font: fonts.regular, color: INK.muted,
        });
        return doc.save();
    }

    for (let i = 0; i < students.length; i += 2) {
        const page = doc.addPage([A4.width, A4.height]);
        const ctx: Ctx = { page, regular: fonts.regular, bold: fonts.bold };
        drawCard(ctx, withStamp, students[i]!, CARD_MARGIN, A4.height - CARD_MARGIN, logo);
        const second = students[i + 1];
        if (second) {
            drawCard(ctx, withStamp, second, CARD_MARGIN, A4.height - CARD_MARGIN - CARD_H - CARD_GAP, logo);
        }
    }

    return doc.save();
}
