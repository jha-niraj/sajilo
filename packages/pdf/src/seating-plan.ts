import { PDFDocument, rgb } from 'pdf-lib';
import { A4, INK, loadFonts, wrap } from './layout';
import type { SeatingPlanDocument, SeatingPlanRoom } from './types';

/**
 * The exam seating plan, drawn with pdf-lib.
 *
 * ## One room per page, landscape
 *
 * A seating plan is pinned to a door and read from a metre away, so it is drawn LANDSCAPE with one
 * room per page. Portrait forced narrow benches and a plan that needed two hands to follow across
 * a fold; landscape lets a row of benches sit side by side the way the room actually is.
 *
 * ## It renders the STORED plan, never a fresh deal
 *
 * The arrangement arrives finished. That is the point: re-dealing at print time would produce a
 * different plan from the one already on the door, because the deal depends on who is enrolled at
 * that moment.
 */

const PAGE = { width: A4.height, height: A4.width } as const; // landscape
const MARGIN = 32;
const RULE = rgb(0.85, 0.85, 0.87);

/** Bench tints, matched to the screen legend by class ORDER, not by name. */
const TINTS = [
    rgb(0.93, 0.99, 0.96), rgb(1.00, 0.97, 0.90), rgb(0.92, 0.98, 0.98),
    rgb(1.00, 0.94, 0.95), rgb(0.97, 0.99, 0.90), rgb(1.00, 0.96, 0.92),
];

function drawRoom(
    doc: PDFDocument,
    fonts: Awaited<ReturnType<typeof loadFonts>>,
    plan: SeatingPlanDocument,
    room: SeatingPlanRoom,
): void {
    const page = doc.addPage([PAGE.width, PAGE.height]);
    let y = PAGE.height - MARGIN;

    page.drawText(plan.schoolName, { x: MARGIN, y, size: 13, font: fonts.bold, color: INK.body });
    y -= 15;
    page.drawText(`${plan.examName} · ${plan.academicYear}`, {
        x: MARGIN, y, size: 9, font: fonts.regular, color: INK.muted,
    });

    const title = room.roomName;
    const tw = fonts.bold.widthOfTextAtSize(title, 14);
    page.drawText(title, { x: PAGE.width - MARGIN - tw, y: y + 15, size: 14, font: fonts.bold, color: INK.body });
    const sub = `${room.benches.length} benches · ${room.seated} seated${plan.examMode ? ' · exam spacing' : ''}`;
    const sw = fonts.regular.widthOfTextAtSize(sub, 8.5);
    page.drawText(sub, { x: PAGE.width - MARGIN - sw, y, size: 8.5, font: fonts.regular, color: INK.muted });

    y -= 14;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE.width - MARGIN, y }, thickness: 0.8, color: RULE });
    y -= 18;

    // The board, so the plan has an orientation. "Bench 1" means nothing without knowing which end
    // of the room it is.
    const boardW = 200;
    page.drawRectangle({
        x: (PAGE.width - boardW) / 2, y: y - 14, width: boardW, height: 16,
        color: rgb(0.93, 0.93, 0.94), borderColor: RULE, borderWidth: 0.5,
    });
    const bt = 'FRONT / BOARD';
    page.drawText(bt, {
        x: (PAGE.width - fonts.bold.widthOfTextAtSize(bt, 8)) / 2, y: y - 10,
        size: 8, font: fonts.bold, color: INK.muted,
    });
    y -= 30;

    // ── Bench grid ───────────────────────────────────────────────────────────
    // Columns are computed from the seats per bench so a 2-seat room fits more benches across than
    // a 4-seat one, rather than every room being forced into the same grid.
    const perBench = Math.max(1, room.seatsPerBench);
    const seatW = 52;
    const benchW = perBench * seatW + 8;
    const cols = Math.max(1, Math.floor((PAGE.width - MARGIN * 2 + 10) / (benchW + 10)));
    const benchH = 40;

    room.benches.forEach((bench, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const bx = MARGIN + col * (benchW + 10);
        const by = y - row * (benchH + 12);

        // Runs off the page rather than silently dropping benches - a truncated seating plan would
        // send students to chairs that are not on it.
        if (by - benchH < MARGIN) return;

        page.drawRectangle({
            x: bx, y: by - benchH, width: benchW, height: benchH,
            borderColor: RULE, borderWidth: 0.6,
        });
        page.drawText(`Bench ${bench.index}`, {
            x: bx + 4, y: by - 9, size: 6, font: fonts.regular, color: INK.muted,
        });

        bench.seats.forEach((seat, s) => {
            const sx = bx + 4 + s * seatW;
            const sy = by - benchH + 4;
            const tint = seat.classLabel
                ? TINTS[Math.max(0, plan.classes.indexOf(seat.classLabel)) % TINTS.length]!
                : rgb(0.98, 0.98, 0.98);
            page.drawRectangle({ x: sx, y: sy, width: seatW - 4, height: benchH - 16, color: tint });
            if (!seat.studentId) return;

            page.drawText(String(seat.rollNumber ?? '-'), {
                x: sx + 3, y: sy + benchH - 28, size: 8.5, font: fonts.bold, color: INK.body,
            });
            page.drawText(seat.classLabel ?? '', {
                x: sx + 3, y: sy + benchH - 37, size: 6, font: fonts.regular, color: INK.muted,
            });
            const name = wrap(fonts.regular, seat.name ?? '', 5.5, seatW - 8)[0] ?? '';
            page.drawText(name, { x: sx + 3, y: sy + 2, size: 5.5, font: fonts.regular, color: INK.muted });
        });
    });
}

export async function renderSeatingPlan(plan: SeatingPlanDocument): Promise<Uint8Array> {
    const doc = await PDFDocument.create();
    const fonts = await loadFonts(doc);

    if (plan.rooms.length === 0) {
        const page = doc.addPage([PAGE.width, PAGE.height]);
        page.drawText('No rooms in this seating plan.', {
            x: MARGIN, y: PAGE.height - 80, size: 11, font: fonts.regular, color: INK.muted,
        });
        return doc.save();
    }

    for (const room of plan.rooms) drawRoom(doc, fonts, plan, room);

    // A short plan is stated on its own page rather than left for someone to notice from a count.
    if (plan.unplacedCount > 0) {
        const page = doc.addPage([PAGE.width, PAGE.height]);
        page.drawText('Unseated students', {
            x: MARGIN, y: PAGE.height - MARGIN, size: 13, font: fonts.bold, color: INK.body,
        });
        page.drawText(
            `${plan.unplacedCount} student${plan.unplacedCount === 1 ? '' : 's'} could not be seated in the selected rooms.`,
            { x: MARGIN, y: PAGE.height - MARGIN - 20, size: 9.5, font: fonts.regular, color: INK.muted },
        );
    }

    return doc.save();
}
