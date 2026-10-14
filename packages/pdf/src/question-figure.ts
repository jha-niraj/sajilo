import type { PDFPage, PDFFont, RGB } from 'pdf-lib';

/**
 * Diagrams for question papers, drawn from a STRUCTURED SPEC rather than generated as an image.
 *
 * ## Why a spec and not an image model
 *
 * A diffusion model cannot reliably render a cone labelled exactly "7 cm" and "24 cm". It produces
 * a plausible cone with plausible-looking WRONG numbers, and a wrong dimension in a maths paper is
 * the worst failure this product can ship: it looks right, it is printed, and a teacher will not
 * catch every one. Thirty children then answer a question whose figure disagrees with its text.
 *
 * So the model emits only the SHAPE AND ITS NUMBERS, and this file draws them. The labels are drawn
 * from the same object the question text was written from, so the picture cannot contradict the
 * words - not because we check, but because there is only one source for both.
 *
 * pdf-lib draws vectors natively (`drawLine`, `drawCircle`, `drawEllipse`, `drawSvgPath`), so this
 * needs no canvas, no rasterisation and no extra dependency. That matters: it is the same
 * constraint that rules out `renderPageAsImage` elsewhere in this repo.
 *
 * ## Scope, deliberately narrow
 *
 * Only the solids an SEE maths paper actually asks about. A shape that is not in `FigureSpec` is
 * not drawn AT ALL, and the question stays prose - which is the current behaviour and is always
 * correct. Widening this list is a deliberate act, never a fallback.
 */

export type FigureShape =
    | { shape: 'cone'; radius: number; height: number; slant?: number }
    | { shape: 'cylinder'; radius: number; height: number }
    | { shape: 'sphere'; radius: number }
    | { shape: 'hemisphere'; radius: number }
    | { shape: 'triangle'; base: number; height: number; rightAngle?: boolean }
    | { shape: 'circle'; radius: number }
    | { shape: 'rectangle'; width: number; height: number }
    | { shape: 'square'; side: number };

export interface FigureSpec {
    /** One shape, or two stacked to make a composite solid (cone on a hemisphere, and so on). */
    parts: FigureShape[];
    /** Unit shown against every measurement. */
    unit?: string;
    /** Optional caption printed under the drawing, e.g. "Fig. 1". */
    caption?: string;
}

/** Drawing area. Kept small: a figure is an aid to a question, never the page. */
export const FIGURE_WIDTH = 150;
export const FIGURE_HEIGHT = 120;

/**
 * Is this object a figure we can actually draw?
 *
 * Written as a guard rather than trusting the model's JSON, because the spec arrives from an LLM.
 * Anything unrecognised, or carrying a dimension that is not a positive finite number, is refused -
 * and the caller then prints the question as prose, which is never wrong.
 */
export function isDrawableFigure(value: unknown): value is FigureSpec {
    if (!value || typeof value !== 'object') return false;
    const spec = value as Partial<FigureSpec>;
    if (!Array.isArray(spec.parts) || spec.parts.length === 0 || spec.parts.length > 2) return false;
    return spec.parts.every((part) => {
        if (!part || typeof part !== 'object') return false;
        const p = part as Record<string, unknown>;
        const dims: Record<string, string[]> = {
            cone: ['radius', 'height'], cylinder: ['radius', 'height'], sphere: ['radius'],
            hemisphere: ['radius'], triangle: ['base', 'height'], circle: ['radius'],
    rectangle: ['width', 'height'], square: ['side'],
        };
        const required = dims[String(p.shape)];
        if (!required) return false;
        return required.every((k) => typeof p[k] === 'number' && Number.isFinite(p[k]) && (p[k] as number) > 0);
    });
}

interface DrawCtx {
    page: PDFPage;
    font: PDFFont;
    ink: RGB;
    /** Bottom-left of the figure box. */
    x: number;
    y: number;
}

const LABEL_SIZE = 7;

function label(ctx: DrawCtx, text: string, x: number, y: number) {
    ctx.page.drawText(text, { x, y, size: LABEL_SIZE, font: ctx.font, color: ctx.ink });
}

/** A dashed line, used for the hidden radius/height a textbook draws inside a solid. */
function dashed(ctx: DrawCtx, x1: number, y1: number, x2: number, y2: number) {
    ctx.page.drawLine({
        start: { x: x1, y: y1 }, end: { x: x2, y: y2 },
        thickness: 0.5, color: ctx.ink, dashArray: [2, 2],
    });
}

function solid(ctx: DrawCtx, x1: number, y1: number, x2: number, y2: number) {
    ctx.page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: 0.8, color: ctx.ink });
}

/**
 * Draw the figure into a box of exactly FIGURE_HEIGHT.
 *
 * Returns nothing on purpose. An earlier version returned "the height actually used" while the
 * caller had already RESERVED `FIGURE_HEIGHT` in its measurement, so the cursor advanced by less
 * than the space the drawing occupied and every figure overlapped the question beneath it. One
 * fixed box, reserved and consumed identically, cannot drift.
 */
export function drawFigure(ctx: DrawCtx, spec: FigureSpec): void {
    const unit = spec.unit ?? 'cm';
    const cx = ctx.x + FIGURE_WIDTH / 2;
    // The box is [ctx.y, ctx.y + FIGURE_HEIGHT]. The caption sits at the very bottom of it and the
    // shapes' feet start above the bottom dimension label. An earlier version drew the caption at
    // ctx.y - 4 - BELOW the reserved box - so "Fig. 1" landed on the option row or the next
    // question, and the label under the base ran into it.
    const CAPTION_ROOM = 30;
    const base = ctx.y + CAPTION_ROOM;

    // Two parts stack: the second sits under the first (cone on hemisphere).
    const [top, bottom] = spec.parts;
    if (!top) return;

    const drawOne = (part: FigureShape, footY: number, allowedH: number): number => {
        switch (part.shape) {
            case 'cone': {
                const r = 26, h = Math.min(allowedH, 62);
                // ellipse base, then the two slant edges
                ctx.page.drawEllipse({ x: cx, y: footY, xScale: r, yScale: 7, borderWidth: 0.8, borderColor: ctx.ink });
                solid(ctx, cx - r, footY, cx, footY + h);
                solid(ctx, cx + r, footY, cx, footY + h);
                dashed(ctx, cx, footY, cx, footY + h);            // vertical height
                dashed(ctx, cx, footY, cx + r, footY);            // radius
                // Labels sit CLEAR of the strokes: height to the right of the dashed axis, radius
                // below the base ellipse, slant outside the left edge. Placing them on the line made
                // both unreadable where they crossed.
                label(ctx, `${part.height}${unit}`, cx + 4, footY + h / 2);
                label(ctx, `${part.radius}${unit}`, cx + r / 2 - 5, footY - 12);
                if (part.slant) label(ctx, `${part.slant}${unit}`, cx - r - 18, footY + h / 2);
                return h;
            }
            case 'cylinder': {
                const r = 24, h = Math.min(allowedH, 58);
                ctx.page.drawEllipse({ x: cx, y: footY + h, xScale: r, yScale: 6, borderWidth: 0.8, borderColor: ctx.ink });
                ctx.page.drawEllipse({ x: cx, y: footY, xScale: r, yScale: 6, borderWidth: 0.8, borderColor: ctx.ink });
                solid(ctx, cx - r, footY, cx - r, footY + h);
                solid(ctx, cx + r, footY, cx + r, footY + h);
                dashed(ctx, cx, footY, cx + r, footY);
                label(ctx, `${part.height}${unit}`, cx + r + 4, footY + h / 2);
                label(ctx, `${part.radius}${unit}`, cx + r / 2 - 5, footY - 12);
                return h;
            }
            case 'sphere': {
                const r = Math.min(allowedH / 2, 28);
                ctx.page.drawCircle({ x: cx, y: footY + r, size: r, borderWidth: 0.8, borderColor: ctx.ink });
                dashed(ctx, cx, footY + r, cx + r, footY + r);
                label(ctx, `${part.radius}${unit}`, cx + r / 2 - 6, footY + r + 3);
                return r * 2;
            }
            case 'hemisphere': {
                const r = 26;
                // flat top, curved bottom - the half a cone usually sits on
                ctx.page.drawEllipse({ x: cx, y: footY, xScale: r, yScale: 7, borderWidth: 0.8, borderColor: ctx.ink });
                solid(ctx, cx - r, footY, cx - r, footY);
                ctx.page.drawSvgPath(`M -${r} 0 A ${r} ${r} 0 0 0 ${r} 0`, {
                    x: cx, y: footY, borderWidth: 0.8, borderColor: ctx.ink,
                });
                label(ctx, `${part.radius}${unit}`, cx + r / 2 - 5, footY - 12);
                return r;
            }
            case 'rectangle':
            case 'square': {
                const w = part.shape === 'square' ? 54 : 74;
                const h = Math.min(allowedH, part.shape === 'square' ? 54 : 44);
                const aLabel = part.shape === 'square' ? `${part.side}${unit}` : `${part.width}${unit}`;
                const bLabel = part.shape === 'square' ? `${part.side}${unit}` : `${part.height}${unit}`;
                ctx.page.drawRectangle({
                    x: cx - w / 2, y: footY, width: w, height: h,
                    borderWidth: 0.8, borderColor: ctx.ink,
                });
                label(ctx, aLabel, cx - 6, footY - 12);
                label(ctx, bLabel, cx + w / 2 + 4, footY + h / 2);
                return h;
            }
            case 'triangle': {
                const w = 60, h = Math.min(allowedH, 52);
                solid(ctx, cx - w / 2, footY, cx + w / 2, footY);
                solid(ctx, cx - w / 2, footY, cx - w / 2, footY + h);
                solid(ctx, cx - w / 2, footY + h, cx + w / 2, footY);
                if (part.rightAngle) {
                    solid(ctx, cx - w / 2 + 6, footY, cx - w / 2 + 6, footY + 6);
                    solid(ctx, cx - w / 2, footY + 6, cx - w / 2 + 6, footY + 6);
                }
                label(ctx, `${part.base}${unit}`, cx - 6, footY - 12);
                label(ctx, `${part.height}${unit}`, cx - w / 2 - 22, footY + h / 2);
                return h;
            }
            case 'circle': {
                const r = Math.min(allowedH / 2, 28);
                ctx.page.drawCircle({ x: cx, y: footY + r, size: r, borderWidth: 0.8, borderColor: ctx.ink });
                dashed(ctx, cx, footY + r, cx + r, footY + r);
                label(ctx, `${part.radius}${unit}`, cx + r / 2 - 6, footY + r + 3);
                return r * 2;
            }
        }
    };

    if (bottom) {
        // A hemisphere hangs BELOW its own flat face, so the joint is where that face sits - not
        // above the shape's full depth. Lifting the pair by that depth and drawing BOTH at the same
        // line makes them meet; adding the depth instead left the cone floating over its base.
        const depth = bottom.shape === 'hemisphere' ? 26 : 0;
        drawOne(bottom, base + depth, 30);
        drawOne(top, base + depth, FIGURE_HEIGHT - depth - CAPTION_ROOM - 8);
    } else {
        drawOne(top, base, FIGURE_HEIGHT - CAPTION_ROOM - 8);
    }

    if (spec.caption) {
        const w = ctx.font.widthOfTextAtSize(spec.caption, LABEL_SIZE);
        ctx.page.drawText(spec.caption, {
            x: cx - w / 2, y: ctx.y + 4, size: LABEL_SIZE, font: ctx.font, color: ctx.ink,
        });
    }
}
