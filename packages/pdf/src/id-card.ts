import { PDFDocument, rgb, type PDFFont, type PDFPage, type RGB, type PDFImage } from 'pdf-lib';
import { A4, INK, loadFonts, embedLogo } from './layout';
import type { IdCardBatch, IdCardPerson } from './types';

/**
 * Student and staff ID cards, laid out as fixed boxes.
 *
 * ## Why fixed boxes and not flowed content
 *
 * This is the same decision `admit-card.ts` documents, and for the same reason. A card is a
 * physical object that gets cut out and handed to a child; it cannot be allowed to break across
 * two sheets. Flowed content plus `page-break-inside: avoid` is a REQUEST to the browser, which is
 * exactly what the old `window.print()` path relied on and exactly why cards came out split.
 *
 * Here every card occupies a rectangle whose coordinates are computed up front. Nothing reflows,
 * so nothing can straddle a page boundary. Text that will not fit is truncated with an ellipsis
 * rather than pushing the layout - a card with a clipped address is usable, a card sliced in half
 * is not.
 *
 * ## Card size
 *
 * CR80 (85.6mm x 54mm), the actual ID-card standard, so the output fits commodity card sleeves and
 * lanyards. Eight to an A4 sheet in a 2x4 grid. The browser CSS it replaces used the same 85.6mm
 * width but let the height flow, which is why printed cards did not fit the sleeves.
 *
 * ## Cut guides
 *
 * Thin grey rules at the card boundary, NOT a full border. A printed border becomes a visible
 * black edge if the guillotine is a millimetre off; a light guide is a cut line that disappears
 * into the trim.
 */

const MM = 2.834645669; // points per millimetre

const CARD_W = 85.6 * MM;
const CARD_H = 54 * MM;
const COLS = 2;
const ROWS = 4;
const PER_PAGE = COLS * ROWS;

const GAP_X = 6 * MM;
const GAP_Y = 5 * MM;
const GRID_W = COLS * CARD_W + (COLS - 1) * GAP_X;
const GRID_H = ROWS * CARD_H + (ROWS - 1) * GAP_Y;
const ORIGIN_X = (A4.width - GRID_W) / 2;
const ORIGIN_Y = (A4.height - GRID_H) / 2;

const PAD = 8;
const PHOTO_W = 22 * MM;
const PHOTO_H = 28 * MM;

const GOLD = rgb(0.659, 0.498, 0.122);
const CUT_GUIDE = rgb(0.86, 0.86, 0.88);
const PANEL = rgb(0.97, 0.97, 0.98);

/**
 * Parse `#rrggbb` into pdf-lib's 0..1 RGB.
 *
 * Falls back to the brand gold rather than throwing: a school that has typed something odd into
 * the colour picker should still get printable cards, not a failed batch.
 */
function parseHex(hex: string | null): RGB {
    const m = /^#?([0-9a-f]{6})$/i.exec((hex ?? '').trim());
    if (!m) return GOLD;
    const n = parseInt(m[1]!, 16);
    return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

/** Truncate to fit `maxWidth`, with an ellipsis. Layout never grows to accommodate text. */
function fit(font: PDFFont, text: string, size: number, maxWidth: number): string {
    if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
    let out = text;
    while (out.length > 1 && font.widthOfTextAtSize(`${out}…`, size) > maxWidth) {
        out = out.slice(0, -1);
    }
    return `${out}…`;
}

interface Ctx {
    page: PDFPage;
    regular: PDFFont;
    bold: PDFFont;
    accent: RGB;
    logo: PDFImage | null;
    signature: PDFImage | null;
}

/** Draw one card with its BOTTOM-LEFT corner at (x, y). The box is fixed; nothing reflows. */
function drawCard(ctx: Ctx, batch: IdCardBatch, person: IdCardPerson, photo: PDFImage | null, x: number, y: number): void {
    const { page, regular, bold, accent } = ctx;
    const top = y + CARD_H;

    // Cut guide, not a border - see the note at the top of this file.
    page.drawRectangle({
        x, y, width: CARD_W, height: CARD_H,
        borderColor: CUT_GUIDE, borderWidth: 0.5,
    });

    // ── Header band ──────────────────────────────────────────────────────────────────────
    const BAND_H = 16 * MM;
    page.drawRectangle({ x, y: top - BAND_H, width: CARD_W, height: BAND_H, color: accent });

    let textX = x + PAD;
    if (ctx.logo) {
        const lh = 10 * MM;
        const lw = (ctx.logo.width / ctx.logo.height) * lh;
        page.drawImage(ctx.logo, { x: x + PAD, y: top - BAND_H + (BAND_H - lh) / 2, width: lw, height: lh });
        textX = x + PAD + lw + 6;
    }

    const headerW = CARD_W - (textX - x) - PAD;
    page.drawText(fit(bold, batch.school.name.toUpperCase(), 8.5, headerW), {
        x: textX, y: top - BAND_H + BAND_H / 2 + 1, size: 8.5, font: bold, color: rgb(1, 1, 1),
    });
    const sub = batch.school.address ?? batch.school.phone ?? '';
    if (sub) {
        page.drawText(fit(regular, sub, 6, headerW), {
            x: textX, y: top - BAND_H + BAND_H / 2 - 7, size: 6, font: regular, color: rgb(1, 1, 1),
        });
    }

    // ── Photo ────────────────────────────────────────────────────────────────────────────
    const photoX = x + PAD;
    const photoY = top - BAND_H - 6 - PHOTO_H;
    page.drawRectangle({
        x: photoX, y: photoY, width: PHOTO_W, height: PHOTO_H,
        color: PANEL, borderColor: CUT_GUIDE, borderWidth: 0.5,
    });
    if (photo) {
        // Cover-fit inside the frame: scale to the larger ratio and centre, so a portrait or a
        // landscape snapshot both fill the box without distortion.
        const scale = Math.max(PHOTO_W / photo.width, PHOTO_H / photo.height);
        const w = photo.width * scale;
        const h = photo.height * scale;
        page.drawImage(photo, {
            x: photoX + (PHOTO_W - w) / 2,
            y: photoY + (PHOTO_H - h) / 2,
            width: w, height: h,
        });
        // Redraw the frame so the cover-fit overflow reads as cropped rather than bleeding.
        page.drawRectangle({
            x: photoX, y: photoY, width: PHOTO_W, height: PHOTO_H,
            borderColor: CUT_GUIDE, borderWidth: 0.5,
        });
    } else {
        page.drawText('PHOTO', {
            x: photoX + PHOTO_W / 2 - regular.widthOfTextAtSize('PHOTO', 6) / 2,
            y: photoY + PHOTO_H / 2 - 3, size: 6, font: regular, color: INK.muted,
        });
    }

    // ── Name and fields ──────────────────────────────────────────────────────────────────
    const fieldX = photoX + PHOTO_W + 8;
    const fieldW = CARD_W - (fieldX - x) - PAD;
    let cy = top - BAND_H - 6 - 10;

    page.drawText(fit(bold, person.name, 10, fieldW), {
        x: fieldX, y: cy, size: 10, font: bold, color: INK.body,
    });
    cy -= 12;

    // Only as many rows as fit above the footer. The school chooses which fields to print, and a
    // generous config must not push content off the card - it is silently trimmed instead.
    const FOOTER_Y = y + 12;
    for (const row of person.rows) {
        if (cy - 8 < FOOTER_Y) break;
        const label = `${row.label}: `;
        page.drawText(label, { x: fieldX, y: cy, size: 6.5, font: bold, color: INK.muted });
        const lw = bold.widthOfTextAtSize(label, 6.5);
        page.drawText(fit(regular, row.value, 7, fieldW - lw), {
            x: fieldX + lw, y: cy, size: 7, font: regular, color: INK.body,
        });
        cy -= 9;
    }

    // ── Footer: signature and validity ───────────────────────────────────────────────────
    if (ctx.signature) {
        const sh = 7 * MM;
        const sw = (ctx.signature.width / ctx.signature.height) * sh;
        page.drawImage(ctx.signature, { x: x + CARD_W - PAD - sw, y: y + 15, width: sw, height: sh });
    }
    if (batch.signatureLabel) {
        const t = fit(regular, batch.signatureLabel, 5.5, CARD_W / 2);
        page.drawText(t, {
            x: x + CARD_W - PAD - regular.widthOfTextAtSize(t, 5.5),
            y: y + 8, size: 5.5, font: regular, color: INK.muted,
        });
    }

    const validity = batch.validityLabel ?? batch.customTagline;
    if (validity) {
        page.drawText(fit(regular, validity, 5.5, CARD_W / 2 - PAD), {
            x: x + PAD, y: y + 8, size: 5.5, font: regular, color: INK.muted,
        });
    }
}

/**
 * Embed every distinct photo ONCE.
 *
 * A batch is often a whole class, and a staff batch reuses the same placeholder repeatedly. Naive
 * per-card embedding puts the same bytes in the file once per card - `admit-card.ts` documents the
 * same trap for its stamp. Keyed by URL so two people sharing a photo share the embed too.
 *
 * A photo that will not decode is skipped, not fatal: a card with a PHOTO placeholder still
 * identifies the holder by name and id, and one bad image must not fail a class of forty.
 */
async function embedPhotos(doc: PDFDocument, people: IdCardPerson[]): Promise<Map<string, PDFImage>> {
    const byUrl = new Map<string, PDFImage>();
    const urls = [...new Set(people.map((p) => p.photo).filter((u): u is string => !!u))];

    await Promise.all(urls.map(async (url) => {
        try {
            let bytes: Uint8Array;
            let isJpg: boolean;
            if (url.startsWith('data:')) {
                bytes = Uint8Array.from(atob(url.split(',').pop() ?? ''), (ch) => ch.charCodeAt(0));
                isJpg = url.includes('image/jpeg') || url.includes('image/jpg');
            } else {
                const res = await fetch(url);
                if (!res.ok) return;
                bytes = new Uint8Array(await res.arrayBuffer());
                const ct = res.headers.get('content-type') ?? '';
                isJpg = ct.includes('jpeg') || ct.includes('jpg') || /\.jpe?g($|\?)/i.test(url);
            }
            byUrl.set(url, isJpg ? await doc.embedJpg(bytes) : await doc.embedPng(bytes));
        } catch {
            // Skipped - the card falls back to the PHOTO placeholder.
        }
    }));

    return byUrl;
}


/**
 * The BACK of a card, at the same fixed box.
 *
 * A real second face, not a duplicate of the front - it carries guardian contact, blood group and
 * address, the school block, and the "if found" line, matching what the web templates render for
 * `side === 'back'`. Schools turn this on with `showBackSide`, so omitting it would have been a
 * silent regression rather than a simplification.
 *
 * Backs are printed on their OWN sheet immediately after the fronts, with the COLUMNS MIRRORED -
 * see the note on `slotXY` for why. Drawing them in the same slot order puts every back behind its
 * row neighbour's front.
 */
function drawCardBack(ctx: Ctx, batch: IdCardBatch, person: IdCardPerson, x: number, y: number): void {
    const { page, regular, bold, accent } = ctx;
    const top = y + CARD_H;

    page.drawRectangle({ x, y, width: CARD_W, height: CARD_H, borderColor: CUT_GUIDE, borderWidth: 0.5 });
    // The accent strip the web template puts down the left edge.
    page.drawRectangle({ x, y, width: 2 * MM, height: CARD_H, color: accent });

    const cx = x + 2 * MM + PAD;
    const cw = CARD_W - (cx - x) - PAD;
    let cy = top - PAD - 6;

    page.drawText('CONTACT & DETAILS', { x: cx, y: cy, size: 7, font: bold, color: accent });
    cy -= 11;

    const FLOOR = y + 26;
    for (const row of person.backRows) {
        if (cy - 8 < FLOOR) break;
        const label = `${row.label}: `;
        page.drawText(label, { x: cx, y: cy, size: 6.5, font: bold, color: INK.muted });
        const lw = bold.widthOfTextAtSize(label, 6.5);
        page.drawText(fit(regular, row.value, 7, cw - lw), { x: cx + lw, y: cy, size: 7, font: regular, color: INK.body });
        cy -= 9;
    }

    // School block and the return line, pinned to the bottom so they sit consistently whatever
    // number of rows the school configured above.
    page.drawLine({
        start: { x: cx, y: y + 22 }, end: { x: cx + cw, y: y + 22 },
        thickness: 0.5, color: CUT_GUIDE,
    });
    page.drawText(fit(bold, batch.school.name, 6.5, cw), { x: cx, y: y + 15, size: 6.5, font: bold, color: accent });
    if (batch.school.address) {
        page.drawText(fit(regular, batch.school.address, 5.5, cw), { x: cx, y: y + 9, size: 5.5, font: regular, color: INK.muted });
    }
    page.drawText('If found, please return to the school.', { x: cx, y: y + 3, size: 5, font: regular, color: INK.muted });
}

export async function renderIdCards(batch: IdCardBatch): Promise<Uint8Array> {
    const doc = await PDFDocument.create();
    const fonts = await loadFonts(doc);

    const [logo, signature, photos] = await Promise.all([
        embedLogo(doc, batch.school.logo ?? null),
        embedLogo(doc, batch.signatureUrl ?? null),
        embedPhotos(doc, batch.people),
    ]);

    const ctx: Omit<Ctx, 'page'> = {
        regular: fonts.regular,
        bold: fonts.bold,
        accent: parseHex(batch.primaryColor),
        logo: logo?.image ?? null,
        signature: signature?.image ?? null,
    };

    if (batch.people.length === 0) {
        const page = doc.addPage([A4.width, A4.height]);
        page.drawText('No cards selected.', {
            x: 56, y: A4.height - 80, size: 11, font: fonts.regular, color: INK.muted,
        });
        return doc.save();
    }

    /** Slot geometry. Rows fill top-down, so row 0 is the TOP of the grid, not the bottom. */
    const slotXY = (slot: number, mirrored = false): { x: number; y: number } => {
        const rawCol = slot % COLS;
        // A long-edge duplex printer flips the sheet about its vertical axis, so x maps to
        // (W - x - CARD_W). With two columns and a centred grid that lands EXACTLY on the other
        // column - front col0 (46.49) mirrors to 306.14, which IS col1. Swapping the column on
        // back pages cancels the flip; without it every card gets its row neighbour's back.
        const col = mirrored ? COLS - 1 - rawCol : rawCol;
        const row = Math.floor(slot / COLS);
        return {
            x: ORIGIN_X + col * (CARD_W + GAP_X),
            y: ORIGIN_Y + GRID_H - (row + 1) * CARD_H - row * GAP_Y,
        };
    };

    for (let i = 0; i < batch.people.length; i += PER_PAGE) {
        const sheet = batch.people.slice(i, i + PER_PAGE);

        const frontCtx: Ctx = { ...ctx, page: doc.addPage([A4.width, A4.height]) };
        sheet.forEach((person, slot) => {
            const { x, y } = slotXY(slot);
            drawCard(frontCtx, batch, person, person.photo ? (photos.get(person.photo) ?? null) : null, x, y);
        });

        // The backs for THIS sheet immediately after it, COLUMN-MIRRORED so a long-edge duplex
        // printer pairs each back with its own front. See the note on `slotXY`.
        if (batch.showBackSide) {
            const backCtx: Ctx = { ...ctx, page: doc.addPage([A4.width, A4.height]) };
            sheet.forEach((person, slot) => {
                const { x, y } = slotXY(slot, true);
                drawCardBack(backCtx, batch, person, x, y);
            });
        }
    }

    return doc.save();
}

/** Exposed so a caller can size a batch without importing the geometry constants. */
export const ID_CARDS_PER_PAGE = PER_PAGE;
