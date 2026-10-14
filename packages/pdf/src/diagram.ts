import { degrees, LineCapStyle, type PDFFont, type PDFPage, type RGB } from 'pdf-lib';
import {
    CANVAS, autoYRange, isDrawableDiagram, polar, ringAngles, round, samplePlot, scale, ticks,
    toPath, trajectory,
    type AngleSpec, type ArraySpec, type BarModelSpec, type CircuitSpec, type CycleSpec,
    type DiagramSpec, type FlowchartSpec, type ForcesSpec, type FractionBarSpec,
    type NumberLineSpec, type PlotSpec, type PolygonSpec, type ProjectileSpec,
    type RayDiagramSpec, type TimelineSpec, type VennSpec,
    type LabelledPartsSpec, type BarChartSpec, type PieChartSpec, type CoordinateGridSpec, type ClockFaceSpec, type PlaceValueSpec, type TableSpec, type DivisionLadderSpec, type NestedSetsSpec,
    pieAngles, placeValueColumns, placeValueBase, divisionLadderRows, baseDigit,
} from '@repo/core/diagram';

/**
 * Teaching diagrams, drawn onto a PDF page.
 *
 * ## The point of this file
 *
 * A lesson plan is printed. `packages/ui/src/diagrams/*` draws these fifteen figures on screen, and
 * without a print renderer a plan that contains one prints as a gap - the diagram is simply not
 * there on the sheet the teacher hands in. This is the other renderer, and it reads the SAME spec
 * out of `@repo/core/diagram`, validated by the SAME `isDrawableDiagram`. A figure the screen
 * refuses is refused here; a figure the screen draws is drawn here.
 *
 * ## Why there is almost no coordinate maths below
 *
 * `pdf-lib`'s `drawSvgPath` translates to `(x, y)` and then applies `scale(1, -1)`, so a path
 * string written in the SCREEN's coordinate space - y down from the top-left of the figure -
 * renders identically on the page when the origin given is the box's TOP-left corner. So this file
 * builds the same `d` strings, from the same `scale` / `ticks` / `samplePlot` / `trajectory` /
 * `ringAngles` / `polar` helpers the components use, and hands them to pdf-lib. Screen and print
 * cannot disagree about WHERE something goes, because there is only one calculation of it.
 *
 * Only text has to be converted, because glyphs cannot be drawn upside down: `Pen.py()` is the one
 * flip in the file.
 *
 * ## One colour, on white
 *
 * The screen carries emphasis with opacity and a soft fill. Paper gets none of that, so:
 *
 * - a construction line is thinner AND dashed, never merely paler;
 * - something being pointed at is HEAVIER, never a different hue;
 * - a fill that is the datum - the shaded part of a fraction - is HATCHED, because 14% grey is the
 *   first thing a school photocopier throws away and the shaded half of a fraction bar is the
 *   entire content of the picture;
 * - a fill that is decoration or an overlap - a bar model's body, a Venn circle - is a WASH of the
 *   same ink at a real alpha, so where two circles overlap the density doubles and where three
 *   overlap it trebles, which is the entire mechanism of a Venn diagram.
 *
 * ## There is no animation, so every figure is the final frame
 *
 * Which is exactly what the components render with `animate={false}` - the same still a reader with
 * `prefers-reduced-motion` gets. Nothing here is a second design.
 *
 * ## Text is measured, never assumed
 *
 * The components estimate label widths from character counts; pdf-lib can measure exactly, so
 * labels that must not collide (a tick row, a node's caption, a Venn item) are measured against the
 * real font and shortened or thinned out. `diagramHeightFor` cannot measure - it has no font, by
 * design, so a caller can lay out a page before it has a document - so anything the HEIGHT depends
 * on is wrapped by the same character-count estimate the components use. That is the safe way
 * round: the estimate is generous, so the measured text is never taller than the box reserved.
 */

// ─── The box ────────────────────────────────────────────────────────────────────

/** The figure width. The same 320 the components draw into - see `CANVAS`. */
export const DIAGRAM_WIDTH = CANVAS.width;

/**
 * A nominal height, for a caller that wants one number.
 *
 * **Prefer `diagramHeightFor(spec)`.** Almost every diagram here sizes itself: a fourteen-node
 * flowchart is six times a number line, and a timeline grows with its longest label. This constant
 * is only the default canvas, kept so a caller with no spec in hand can still reserve something.
 */
export const DIAGRAM_HEIGHT = CANVAS.height;

/**
 * Where the drawing goes, and what it draws with.
 *
 * Deliberately the same shape `question-figure.ts` uses: the page, one font, one ink, and the
 * BOTTOM-LEFT corner of the box. Two figure renderers in one package that take different contexts
 * would be two conventions for one job.
 */
export interface DrawCtx {
    page: PDFPage;
    font: PDFFont;
    ink: RGB;
    /** Bottom-left of the figure box. */
    x: number;
    y: number;
}

// ─── The print translation of the screen's tokens ───────────────────────────────

/** `STROKE` - structure. One weight, everywhere. */
const STROKE_W = 0.9;
/** `EMPHASIS` - something being pointed at rather than merely drawn. */
const EMPHASIS_W = 1.7;
/** `DASH` - a construction line. Thinner and dashed, because paler is not available. */
const HAIR_W = 0.55;
const DASH: number[] = [2.4, 2.4];

const LABEL = 8.5;
const LABEL_SM = 7.5;
/** Line heights for wrapped labels at the two sizes. */
const LINE = 11;
const LINE_SM = 9.5;

/**
 * Estimated advance width, as a fraction of the font size.
 *
 * Used ONLY where a height depends on how many lines a label wraps to, because `diagramHeightFor`
 * has no font to measure with. Helvetica's mixed-case average is nearer 0.50; 0.52 is deliberately
 * generous, so the estimate wraps to at least as many lines as the measured text will need.
 */
const EM = 0.52;

/** Room under the drawing for the caption, when there is one. */
const CAPTION_ROOM = 14;

const r2 = (v: number): number => round(v, 2);

interface Stroke {
    weight?: number;
    dash?: number[];
    fill?: RGB;
    /**
     * Fill alpha, 0..1. The stroke stays fully opaque.
     *
     * A pre-blended grey would have been simpler and is WRONG for the Venn: two opaque tints do not
     * add, so the overlap came out exactly the same shade as the two lobes and the diagram said
     * nothing. A real alpha composites, so the overlap doubles and the three-set centre trebles -
     * which is what the screen's `SOFT_FILL` does and is the whole mechanism of that figure.
     */
    opacity?: number;
}

/** The density every soft fill uses. Low enough that text over it stays black-on-near-white. */
const WASH = 0.1;

type Anchor = 'start' | 'middle' | 'end';

interface Pt { x: number; y: number }

// ─── The pen ────────────────────────────────────────────────────────────────────

/**
 * Everything that touches the page.
 *
 * Coordinates in are SVG coordinates - x right, y DOWN from the top-left of the figure box - which
 * is what every component computes and what every shared geometry helper returns.
 */
class Pen {
    constructor(private readonly ctx: DrawCtx, readonly height: number) { }

    get font(): PDFFont { return this.ctx.font }
    get ink(): RGB { return this.ctx.ink }

    /** SVG y (down from the top of the box) to page y (up from the bottom of the page). */
    py(y: number): number { return this.ctx.y + this.height - y }
    px(x: number): number { return this.ctx.x + x }

    /** An SVG path, in the component's own coordinates. */
    path(d: string, s: Stroke = {}): void {
        if (d.trim().length === 0) return;
        const weight = s.weight ?? (s.fill ? 0 : STROKE_W);
        this.ctx.page.drawSvgPath(d, {
            x: this.ctx.x,
            y: this.ctx.y + this.height,
            color: s.fill,
            opacity: s.opacity,
            borderColor: weight > 0 ? this.ctx.ink : undefined,
            borderWidth: weight,
            borderDashArray: s.dash,
            borderLineCap: LineCapStyle.Round,
        });
    }

    line(x1: number, y1: number, x2: number, y2: number, s: Stroke = {}): void {
        this.path(`M ${r2(x1)} ${r2(y1)} L ${r2(x2)} ${r2(y2)}`, s);
    }

    rect(x: number, y: number, w: number, h: number, s: Stroke = {}): void {
        this.path(
            `M ${r2(x)} ${r2(y)} L ${r2(x + w)} ${r2(y)} L ${r2(x + w)} ${r2(y + h)}`
            + ` L ${r2(x)} ${r2(y + h)} Z`,
            s,
        );
    }

    circle(cx: number, cy: number, r: number, s: Stroke = {}): void {
        const weight = s.weight ?? (s.fill ? 0 : STROKE_W);
        this.ctx.page.drawCircle({
            x: this.px(cx),
            y: this.py(cy),
            size: r,
            color: s.fill,
            opacity: s.opacity,
            borderColor: weight > 0 ? this.ctx.ink : undefined,
            borderWidth: weight,
            borderDashArray: s.dash,
        });
    }

    /**
     * A filled arrowhead with its tip at `(x, y)`, pointing along `(dx, dy)`.
     *
     * Print has no `<marker>`, so every arrow the components get for free is drawn here. Filled
     * rather than two strokes, because a stroked head at 0.9pt closes up at print size.
     */
    head(x: number, y: number, dx: number, dy: number, size = 5): void {
        const len = Math.hypot(dx, dy) || 1;
        const ux = dx / len, uy = dy / len;
        const bx = x - ux * size, by = y - uy * size;
        const hw = size * 0.42;
        this.path(
            `M ${r2(x)} ${r2(y)} L ${r2(bx - uy * hw)} ${r2(by + ux * hw)}`
            + ` L ${r2(bx + uy * hw)} ${r2(by - ux * hw)} Z`,
            { fill: this.ctx.ink },
        );
    }

    /** A line with a head on the end, and optionally on the start too. */
    arrow(x1: number, y1: number, x2: number, y2: number, o: { both?: boolean } & Stroke = {}): void {
        this.line(x1, y1, x2, y2, o);
        this.head(x2, y2, x2 - x1, y2 - y1);
        if (o.both) this.head(x1, y1, x1 - x2, y1 - y2);
    }

    width(text: string, size: number): number {
        return this.ctx.font.widthOfTextAtSize(text, size);
    }

    /** Cut `text` to `max` points, measured. Returns the text when it already fits. */
    fit(text: string, size: number, max: number): string {
        if (max <= 0) return '';
        if (this.width(text, size) <= max) return text;
        let out = text;
        while (out.length > 1 && this.width(`${out}…`, size) > max) out = out.slice(0, -1);
        return `${out.trimEnd()}…`;
    }

    text(
        text: string,
        x: number,
        y: number,
        o: { size?: number; anchor?: Anchor; max?: number } = {},
    ): void {
        const size = o.size ?? LABEL;
        const shown = o.max !== undefined ? this.fit(text, size, o.max) : text;
        if (shown.length === 0) return;
        const w = this.width(shown, size);
        const anchor = o.anchor ?? 'start';
        const dx = anchor === 'middle' ? -w / 2 : anchor === 'end' ? -w : 0;
        this.ctx.page.drawText(shown, {
            x: this.px(x + dx),
            y: this.py(y),
            size,
            font: this.ctx.font,
            color: this.ctx.ink,
        });
    }

    /** Text running bottom-to-top, centred on `(x, y)`. */
    vtext(text: string, x: number, y: number, o: { size?: number; max?: number } = {}): void {
        const size = o.size ?? LABEL_SM;
        const shown = o.max !== undefined ? this.fit(text, size, o.max) : text;
        if (shown.length === 0) return;
        const w = this.width(shown, size);
        this.ctx.page.drawText(shown, {
            x: this.px(x) + size * 0.35,
            y: this.py(y) - w / 2,
            size,
            font: this.ctx.font,
            color: this.ctx.ink,
            rotate: degrees(90),
        });
    }

    /**
     * Diagonal hatching inside a rectangle - a fill that survives a photocopier.
     *
     * Clipped arithmetically rather than with a PDF clipping path: a 45 degree line through an
     * axis-aligned box has a closed-form entry and exit, so there is nothing to clip against.
     */
    hatch(x: number, y: number, w: number, h: number, spacing = 3.6): void {
        let d = '';
        for (let c = spacing; c < w + h; c += spacing) {
            const t0 = Math.max(0, c - w);
            const t1 = Math.min(h, c);
            if (t1 - t0 < 0.4) continue;
            d += `M ${r2(x + c - t0)} ${r2(y + t0)} L ${r2(x + c - t1)} ${r2(y + t1)} `;
        }
        this.path(d, { weight: 0.4 });
    }
}

// ─── Text helpers ───────────────────────────────────────────────────────────────

/** How many characters of `size` fit in `px` points, by estimate. See `EM`. */
const capacity = (px: number, size: number): number => px / (size * EM);

/**
 * Wrap to at most two lines, hard-breaking a run longer than the column.
 *
 * The components' `wrap`. The validator allows an eighty-character label and says nothing about
 * spaces, so an unbroken run has to be cut or it walks off the canvas.
 */
function wrapTwo(text: string, per: number): string[] {
    const cap = Math.max(4, Math.floor(per));
    if (text.length <= cap) return [text];
    const words = text.split(' ').flatMap((w) => {
        if (w.length <= cap) return [w];
        const chunks: string[] = [];
        for (let i = 0; i < w.length; i += cap) chunks.push(w.slice(i, i + cap));
        return chunks;
    });
    const lines: string[] = [];
    let cur = '';
    for (const w of words) {
        if (`${cur} ${w}`.trim().length > cap && cur) { lines.push(cur); cur = w; }
        else cur = `${cur} ${w}`.trim();
    }
    if (cur) lines.push(cur);
    if (lines.length <= 2) return lines;
    // Two lines is the cap, and the reader is TOLD when the third was cut. The components slice
    // silently, which prints a sentence that simply stops - indistinguishable from a label the
    // author wrote that way, and therefore unfixable by the teacher holding the sheet.
    const second = lines[1] ?? '';
    return [lines[0] ?? '', `${second.slice(0, Math.max(1, cap - 1)).trimEnd()}…`];
}

/** Wrap to as many lines as it takes, hyphenating a word longer than the column. */
function wrapAll(text: string, per: number): string[] {
    const cap = Math.max(5, Math.floor(per));
    const lines: string[] = [];
    let cur = '';
    for (const word of text.split(/\s+/).filter(Boolean)) {
        let w = word;
        while (w.length > cap) {
            if (cur) { lines.push(cur); cur = ''; }
            lines.push(`${w.slice(0, cap - 1)}-`);
            w = w.slice(cap - 1);
        }
        if (!cur) cur = w;
        else if (cur.length + 1 + w.length <= cap) cur = `${cur} ${w}`;
        else { lines.push(cur); cur = w; }
    }
    if (cur) lines.push(cur);
    return lines.length ? lines : [text];
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

const W = DIAGRAM_WIDTH;

// ─── Layouts that a height depends on ───────────────────────────────────────────
//
// Each of these is called TWICE - once by `diagramHeightFor` and once by the renderer - so the box
// that was reserved and the box that is drawn into are the same box by construction, rather than by
// two pieces of arithmetic agreeing. `question-figure.ts` learned this the hard way: it once
// returned "the height actually used" while the caller had reserved a constant, and every figure
// overlapped the question under it.

interface FractionRow { bar: FractionBarSpec['bars'][number]; lines: string[]; top: number }

const FRACTION = { GUTTER_CX: 22, BAR_X: 44, BAR_H: 30, GAP: 14, PAD: 12 } as const;
const FRACTION_BAR_W = W - FRACTION.BAR_X - 12;

function fractionLayout(spec: FractionBarSpec): { rows: FractionRow[]; height: number } {
    let cursor = FRACTION.PAD;
    const rows = spec.bars.map((bar) => {
        const lines = bar.label ? wrapTwo(bar.label, capacity(FRACTION_BAR_W, LABEL_SM)) : [];
        const top = cursor + lines.length * LINE_SM;
        cursor = top + FRACTION.BAR_H + FRACTION.GAP;
        return { bar, lines, top };
    });
    return { rows, height: cursor - FRACTION.GAP + FRACTION.PAD };
}

const ARRAY = { LEFT: 44, RIGHT: 16, TOP: 34, BOTTOM: 32 } as const;

function arrayLayout(spec: ArraySpec): {
    cell: number; gridW: number; gridH: number; left: number; top: number; height: number;
} {
    const availW = W - ARRAY.LEFT - ARRAY.RIGHT;
    // Square cells, bounded by the width, by a height that still fits on a page, and by a cap so a
    // one-by-two array is a diagram rather than a poster. The components' arithmetic exactly.
    const cell = Math.min(30, availW / spec.cols, 300 / spec.rows);
    const gridW = cell * spec.cols;
    const gridH = cell * spec.rows;
    return {
        cell, gridW, gridH,
        left: ARRAY.LEFT + (availW - gridW) / 2,
        top: ARRAY.TOP,
        height: ARRAY.TOP + gridH + ARRAY.BOTTOM,
    };
}

const BARM = { X: 14, H: 28, GAP: 13, PAD: 13 } as const;
const BARM_FULL_W = W - 2 * BARM.X;

interface BarRow {
    bar: BarModelSpec['bars'][number];
    barW: number;
    valueTxt: string;
    valueW: number;
    valueInside: boolean;
    place: 'inside' | 'beside' | 'above';
    aboveLines: string[];
    braceLines: string[];
    top: number;
    innerCx: number;
    besideX: number;
    braceWide: boolean;
}

/** Estimated advance, for the placement decisions a height depends on. */
const estW = (s: string, size: number): number => s.length * size * EM;

function barLayout(spec: BarModelSpec): {
    rows: BarRow[]; stackBottom: number; totalLines: string[]; height: number;
} {
    const maxValue = spec.bars.reduce((m, b) => Math.max(m, b.value), 0) || 1;
    const len = scale([0, maxValue], [0, BARM_FULL_W]);
    const rightEdge = BARM.X + BARM_FULL_W;

    let cursor = BARM.PAD;
    const rows = spec.bars.map((bar) => {
        const barW = r2(len(bar.value));
        const valueTxt = String(round(bar.value, 2));
        const valueW = estW(valueTxt, LABEL_SM);
        const valueInside = barW >= valueW + 14;
        const labelW = estW(bar.label, LABEL);

        const innerRoom = barW - 10 - (valueInside ? valueW + 7 : 0);
        const besideX = BARM.X + barW + 7 + (valueInside ? 0 : valueW + 7);
        const besideRoom = rightEdge - besideX;
        const place = labelW <= innerRoom ? 'inside' : labelW <= besideRoom ? 'beside' : 'above';

        const aboveLines = place === 'above' ? wrapTwo(bar.label, capacity(BARM_FULL_W, LABEL)) : [];
        const braceLines = bar.brace ? wrapTwo(bar.brace, capacity(BARM_FULL_W, LABEL_SM)) : [];
        const top = cursor + aboveLines.length * LINE;
        const braceH = braceLines.length > 0 ? 18 + braceLines.length * LINE_SM : 0;
        cursor = top + BARM.H + braceH + BARM.GAP;

        return {
            bar, barW, valueTxt, valueW, valueInside, place, aboveLines, braceLines, top,
            innerCx: BARM.X + (barW - (valueInside ? valueW + 7 : 0)) / 2,
            besideX,
            braceWide: braceLines.reduce((m, l) => Math.max(m, estW(l, LABEL_SM)), 0) > barW,
        } as BarRow;
    });

    const stackBottom = cursor - BARM.GAP;
    const totalLines = spec.total ? wrapTwo(spec.total, capacity(BARM_FULL_W, LABEL)) : [];
    const totalH = totalLines.length > 0 ? 21 + totalLines.length * LINE_SM : 0;
    return { rows, stackBottom, totalLines, height: stackBottom + totalH + BARM.PAD };
}

const FLOW_BOX_W = 150;

/**
 * A flowchart's box and gap.
 *
 * Fourteen nodes at the components' 42 + 30 is 1038 points, and an A4 content column is about 690.
 * A figure that cannot fit on any page is not a figure, so past eight nodes the column compresses
 * to fit one. Up to eight - which is nearly every flowchart a lesson plan actually carries - the
 * numbers are the components' own, so screen and print are the same picture.
 */
function flowLayout(spec: FlowchartSpec): { boxH: number; gap: number; height: number } {
    const n = spec.nodes.length;
    const natural = n * (42 + 30) + 30;
    const s = natural <= 620 ? 1 : 620 / natural;
    const boxH = r2(42 * s), gap = r2(30 * s);
    return { boxH, gap, height: n * (boxH + gap) + gap };
}

const CYCLE_NODE_R = 12;

interface CycleStage { a: number; qx: number; anchor: Anchor; lines: string[]; first: number }

function cycleLayout(spec: CycleSpec): {
    stages: CycleStage[]; R: number; cy: number; height: number;
} {
    const n = spec.stages.length;
    const R = 40 + n * 3;
    const labelR = R + CYCLE_NODE_R + 9;
    const angles = ringAngles(n);
    const CX = W / 2;

    const stages: CycleStage[] = spec.stages.map((text, i) => {
        const a = angles[i] ?? 0;
        const cos = Math.cos(a), sin = Math.sin(a);
        const qx = r2(CX + labelR * cos), qy = r2(labelR * sin);
        const anchor: Anchor = cos > 0.34 ? 'start' : cos < -0.34 ? 'end' : 'middle';
        const room = anchor === 'start' ? W - 8 - qx
            : anchor === 'end' ? qx - 8
                : 2 * Math.min(qx - 8, W - 8 - qx);
        const lines = wrapAll(text, capacity(room, LABEL));
        const first = sin < -0.5 ? qy - 2 - (lines.length - 1) * LINE
            : sin > 0.5 ? qy + 11
                : r2(qy + 3.5 - ((lines.length - 1) * LINE) / 2);
        return { a, qx, anchor, lines, first };
    });

    const minY = stages.reduce((m, s) => Math.min(m, s.first - 8), -(R + CYCLE_NODE_R));
    const maxY = stages.reduce(
        (m, s) => Math.max(m, s.first + (s.lines.length - 1) * LINE + 3),
        R + CYCLE_NODE_R,
    );
    return { stages, R, cy: r2(12 - minY), height: r2(maxY - minY + 24) };
}

interface VLayout { kind: 'two' | 'three'; labels: string[][]; cy: number; height: number }

function vennLayout(spec: VennSpec): VLayout {
    if (spec.sets.length >= 3) {
        const labels = spec.sets.slice(0, 3).map((s) => wrapAll(s.label, capacity(110, LABEL)));
        const topLines = labels[0]?.length ?? 1;
        const sideLines = Math.max(labels[1]?.length ?? 1, labels[2]?.length ?? 1);
        const cy = r2(133 + (topLines - 1) * LINE);
        return { kind: 'three', labels, cy, height: r2(cy + 100 + (sideLines - 1) * LINE + 15) };
    }
    const labels = spec.sets.map((s) => wrapAll(s.label, capacity(90, LABEL)));
    const titleLines = labels.reduce((m, l) => Math.max(m, l.length), 1);
    const cy = r2(29 + 82 + (titleLines - 1) * LINE);
    return { kind: 'two', labels, cy, height: r2(cy + 82 + 20) };
}

interface VRow { at: string[]; label: string[]; mid: number }

const TL_AXIS_X = 86;

function timelineVertical(spec: TimelineSpec): { rows: VRow[]; height: number } {
    let y = 16;
    const rows = spec.events.map((e) => {
        const at = wrapAll(e.at, capacity(TL_AXIS_X - 16, LABEL_SM));
        const label = wrapAll(e.label, capacity(W - TL_AXIS_X - 20, LABEL));
        const h = 14 + Math.max(at.length, label.length) * LINE;
        const mid = r2(y + h / 2);
        y += h;
        return { at, label, mid };
    });
    return { rows, height: y + 16 };
}

interface HRow { at: string[]; label: string[]; above: boolean; x: number; reach: number }

function timelineHorizontal(spec: TimelineSpec): {
    rows: HRow[]; axisY: number; half: number; height: number;
} {
    const n = spec.events.length;
    const padX = 26;
    const slot = n > 1 ? (W - 2 * padX) / (n - 1) : 0;
    // A label's nearest same-side neighbour is two slots away, so a column a little under two slots
    // wide cannot collide with one.
    const col = n > 1 ? clamp(slot * 1.85, 40, 170) : 200;
    const half = Math.min(col / 2, W / 2 - 8);

    const rows: HRow[] = spec.events.map((e, i) => {
        const at = wrapAll(e.at, capacity(col, LABEL_SM));
        const label = wrapAll(e.label, capacity(col, LABEL));
        return {
            at, label,
            above: i % 2 === 0,
            x: r2(n > 1 ? padX + i * slot : W / 2),
            reach: 18 + at.length * LINE_SM + 4 + (label.length - 1) * LINE + 8,
        };
    });

    const side = (above: boolean): number =>
        rows.filter((e) => e.above === above).reduce((mx, e) => Math.max(mx, e.reach), 0);
    const axisY = 10 + Math.max(side(true), 22);
    return { rows, axisY, half, height: axisY + Math.max(side(false), 22) + 10 };
}

// ─── Height ─────────────────────────────────────────────────────────────────────

/** The drawing itself, without the caption line. */
function bodyHeight(spec: DiagramSpec): number {
    switch (spec.kind) {
        case 'numberLine': return 140;
        case 'fractionBar': return fractionLayout(spec).height;
        case 'array': return arrayLayout(spec).height;
        case 'barModel': return barLayout(spec).height;
        case 'plot': return 230;
        case 'angle': return 210;
        case 'polygon': return 230;
        case 'forces': return 220;
        case 'projectile': return 230;
        case 'rayDiagram': return 200;
        case 'circuit': return 185;
        case 'timeline':
            return (spec.orientation ?? 'vertical') === 'horizontal'
                ? timelineHorizontal(spec).height
                : timelineVertical(spec).height;
        case 'flowchart': return flowLayout(spec).height;
        case 'cycle': return cycleLayout(spec).height;
        case 'venn': return vennLayout(spec).height;
        case 'labelledParts': return Math.max(188, 30 + spec.parts.length * 16 + 12) + (spec.title ? 4 : 0);
        case 'barChart': return 190;
        case 'pieChart': return 190;
        case 'coordinateGrid': {
            const span = Math.max(spec.xRange[1] - spec.xRange[0], spec.yRange[1] - spec.yRange[0]);
            const unit = Math.min(W - 44, 220 - 44) / span;
            return 44 + (spec.yRange[1] - spec.yRange[0]) * unit + 8;
        }
        case 'clockFace': return spec.showDigital ? 200 : 182;
        case 'placeValue': return 126;
        case 'divisionLadder': return 18 + (divisionLadderRows(spec.number, spec.base).length + 1) * 22 + 44;
        case 'nestedSets': return 230;
        case 'table': return 20 + 22 + spec.rows.length * 20;
    }
}

/**
 * How much vertical room this diagram needs, in points, at `DIAGRAM_WIDTH` wide.
 *
 * A pure function of the spec - no font, no page, no document - so a caller can measure a whole
 * lesson plan before it creates one. A fourteen-node flowchart is six times a number line, and a
 * document that reserved one constant for both would either waste half a page or draw a flowchart
 * through the paragraph beneath it.
 *
 * Returns 0 for anything `isDrawableDiagram` refuses, which is the same answer as "reserve nothing,
 * this will not be drawn".
 */
export function diagramHeightFor(spec: DiagramSpec): number {
    if (!isDrawableDiagram(spec)) return 0;
    return bodyHeight(spec) + (spec.caption ? CAPTION_ROOM : 0);
}

// ─── Maths ──────────────────────────────────────────────────────────────────────

function numberLine(pen: Pen, spec: NumberLineSpec): void {
    const left = 26, right = W - 26, y = 92;
    const x = scale([spec.from, spec.to], [left, right]);
    const tickValues = ticks(spec.from, spec.to, spec.step);
    const marks = spec.marks ?? [];

    pen.arrow(left - 8, y, right + 8, y, { both: true });

    // Forty ticks across 268 points is one every 6.7, and "36" is 8 points wide. On screen the
    // labels merely crowd; on paper they overprint into a smear. So the ticks are all drawn - they
    // are the scale - and the NUMBERS are thinned to whatever actually fits, measured.
    const spacing = tickValues.length > 1
        ? Math.abs(x(tickValues[1] ?? 0) - x(tickValues[0] ?? 0))
        : Number.POSITIVE_INFINITY;
    const widest = tickValues.reduce((m, t) => Math.max(m, pen.width(String(round(t, 2)), LABEL_SM)), 0);
    const stride = Math.max(1, Math.ceil((widest + 3) / Math.max(spacing, 0.01)));

    tickValues.forEach((t, i) => {
        pen.line(x(t), y - 5, x(t), y + 5);
        if (i % stride === 0) {
            pen.text(String(round(t, 2)), x(t), y + 17, { size: LABEL_SM, anchor: 'middle' });
        }
    });

    // Every label that goes ABOVE the line, collected before any of it is drawn.
    //
    // The validator allows twelve marks on one line, and at twelve the jump captions and the point
    // captions land at the same height a few points apart: "add six" printed through "two" is not a
    // crowded diagram, it is an unreadable one. Nothing is dropped - a mark the caller asked for is
    // data - so a label that would collide steps UP a row instead, measured against what is already
    // placed. This is the one place print does more than the screen, and it is why: a screen can be
    // zoomed, and paper cannot.
    const above: Array<{ text: string; cx: number; baseY: number }> = [];

    // Jumps, as an arc, so two consecutive hops stay readable.
    marks.forEach((m) => {
        if (m.jumpTo === undefined) return;
        const x0 = x(m.at), x1 = x(m.jumpTo);
        const lift = Math.min(38, Math.max(16, Math.abs(x1 - x0) * 0.45));
        const mid = (x0 + x1) / 2;
        pen.path(
            `M ${r2(x0)} ${r2(y - 7)} Q ${r2(mid)} ${r2(y - 7 - lift)} ${r2(x1)} ${r2(y - 7)}`,
            { weight: EMPHASIS_W },
        );
        // The tangent at the end of a quadratic runs from the control point to the end point.
        pen.head(x1, y - 7, x1 - mid, lift);
        above.push({ text: m.label ?? `+${round(m.jumpTo - m.at, 2)}`, cx: mid, baseY: y - 12 - lift });
    });

    // Plain marks sit ON the line, so they read as positions rather than as jumps.
    marks.forEach((m) => {
        if (m.jumpTo !== undefined) return;
        pen.circle(x(m.at), y, 3, { fill: pen.ink });
        pen.line(x(m.at), y, x(m.at), y - 26, { weight: HAIR_W, dash: DASH });
        above.push({ text: m.label ?? String(round(m.at, 2)), cx: x(m.at), baseY: y - 30 });
    });

    // Placed boxes, tested in BOTH axes. A row index alone is not enough: a jump caption sits on
    // its own arc and a point caption on its stalk, so two labels "on row 0" can already be twenty
    // points apart vertically, and treating them as one row moves captions that never collided
    // while leaving two that did.
    const placed: Array<{ a: number; b: number; y: number }> = [];
    for (const item of above) {
        const w = pen.width(item.text, LABEL);
        const a = item.cx - w / 2 - 2, b = item.cx + w / 2 + 2;
        let y = item.baseY;
        for (let row = 0; row < 5; row++) {
            y = Math.max(10, item.baseY - row * LINE);
            if (!placed.some((p) => a < p.b && b > p.a && Math.abs(p.y - y) < LINE - 1)) break;
        }
        placed.push({ a, b, y });
        pen.text(item.text, item.cx, y, { anchor: 'middle' });
    }
}

function fractionBar(pen: Pen, spec: FractionBarSpec): void {
    const { rows } = fractionLayout(spec);
    const { BAR_X, BAR_H, GUTTER_CX } = FRACTION;

    for (const { bar, lines, top } of rows) {
        const cellW = FRACTION_BAR_W / bar.parts;

        // The shading is the datum, and a 14% grey is what a photocopier drops first, so it is
        // hatched. Cell by cell rather than as one block: the divisions must stay visible through
        // the shading, which is what makes the fraction countable.
        for (let c = 0; c < bar.shaded; c++) {
            pen.hatch(BAR_X + c * cellW, top, cellW, BAR_H);
        }

        pen.rect(BAR_X, top, FRACTION_BAR_W, BAR_H);
        for (let c = 1; c < bar.parts; c++) {
            pen.line(BAR_X + c * cellW, top, BAR_X + c * cellW, top + BAR_H);
        }

        // The fraction, written as it is written on a board.
        pen.text(String(bar.shaded), GUTTER_CX, top + 12, { anchor: 'middle' });
        pen.line(GUTTER_CX - 9, top + 15, GUTTER_CX + 9, top + 15);
        pen.text(String(bar.parts), GUTTER_CX, top + 26, { anchor: 'middle' });

        lines.forEach((line, li) => {
            pen.text(line, BAR_X, top - (lines.length - li) * LINE_SM + 6, {
                size: LABEL_SM, max: FRACTION_BAR_W,
            });
        });
    }
}

/**
 * The outline of the first `count` cells, in reading order.
 *
 * Whole rows give a rectangle; a part row on the end turns it into an L. Copied from the component
 * rather than shared, because it is this figure's own layout and not geometry any other renderer
 * needs - `@repo/core/diagram` deliberately holds only what more than one diagram uses.
 */
function groupOutline(
    count: number, rows: number, cols: number,
    left: number, top: number, cell: number, pad: number,
): string | null {
    const n = Math.min(Math.floor(count), rows * cols);
    if (n <= 0) return null;

    const full = Math.floor(n / cols);
    const rem = n % cols;
    const x0 = r2(left - pad);
    const x1 = r2(left + cols * cell + pad);
    const yTop = r2(top - pad);

    if (rem === 0) {
        const yBot = r2(top + full * cell + pad);
        return `M ${x0} ${yTop} L ${x1} ${yTop} L ${x1} ${yBot} L ${x0} ${yBot} Z`;
    }

    const xRem = r2(left + rem * cell + pad);
    const yBot = r2(top + (full + 1) * cell + pad);
    if (full === 0) {
        return `M ${x0} ${yTop} L ${xRem} ${yTop} L ${xRem} ${yBot} L ${x0} ${yBot} Z`;
    }

    const yStep = r2(top + full * cell + pad);
    return `M ${x0} ${yTop} L ${x1} ${yTop} L ${x1} ${yStep}`
        + ` L ${xRem} ${yStep} L ${xRem} ${yBot} L ${x0} ${yBot} Z`;
}

function arrayDiagram(pen: Pen, spec: ArraySpec): void {
    const { rows, cols } = spec;
    const style = spec.style ?? 'dots';
    const { cell, gridW, gridH, left, top } = arrayLayout(spec);
    const dotR = Math.min(cell * 0.26, 5);

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (style === 'squares') {
                pen.rect(left + c * cell, top + r * cell, cell, cell);
            } else {
                pen.circle(left + c * cell + cell / 2, top + r * cell + cell / 2, dotR, { fill: pen.ink });
            }
        }
    }

    // Counts on the outside, MEASURED rather than merely written, so it is clear which number
    // belongs to which direction.
    pen.line(left, top - 10, left + gridW, top - 10, { weight: HAIR_W, dash: DASH });
    pen.head(left + gridW, top - 10, 1, 0, 4);
    pen.head(left, top - 10, -1, 0, 4);
    pen.text(`${cols} ${cols === 1 ? 'column' : 'columns'}`, left + gridW / 2, top - 16, {
        size: LABEL_SM, anchor: 'middle',
    });

    pen.line(left - 14, top, left - 14, top + gridH, { weight: HAIR_W, dash: DASH });
    pen.head(left - 14, top + gridH, 0, 1, 4);
    pen.head(left - 14, top, 0, -1, 4);
    pen.vtext(`${rows} ${rows === 1 ? 'row' : 'rows'}`, left - 24, top + gridH / 2);

    // The ring goes on last: it is a reading of the array, so it has to arrive after it.
    const ring = groupOutline(spec.highlight ?? 0, rows, cols, left, top, cell, 2);
    if (ring) pen.path(ring, { weight: EMPHASIS_W });

    pen.text(`${rows} × ${cols} = ${rows * cols}`, left + gridW / 2, top + gridH + 20, {
        anchor: 'middle',
    });
}

/** An underbrace from `x0` to `x1`, tips up, point down. */
function underBrace(x0: number, x1: number, y: number): string {
    const d = Math.min(5, Math.max(1, (x1 - x0) / 4));
    const mid = (x0 + x1) / 2;
    return `M ${r2(x0)} ${r2(y)} Q ${r2(x0)} ${r2(y + d)} ${r2(x0 + d)} ${r2(y + d)}`
        + ` L ${r2(mid - d)} ${r2(y + d)}`
        + ` Q ${r2(mid)} ${r2(y + d)} ${r2(mid)} ${r2(y + 2 * d)}`
        + ` Q ${r2(mid)} ${r2(y + d)} ${r2(mid + d)} ${r2(y + d)}`
        + ` L ${r2(x1 - d)} ${r2(y + d)}`
        + ` Q ${r2(x1)} ${r2(y + d)} ${r2(x1)} ${r2(y)}`;
}

function barModel(pen: Pen, spec: BarModelSpec): void {
    const { rows, stackBottom, totalLines } = barLayout(spec);

    for (const row of rows) {
        const { bar, barW, top } = row;
        // A wash under the outline, not instead of it: the LENGTH is the datum, and the fill only
        // makes the bar read as one quantity rather than as an empty frame.
        //
        // Drawn at whatever width the value gives it, with NO minimum. A bar worth 1 against a bar
        // worth 1000 is a third of a point wide, and that sliver is the truth the picture exists to
        // tell; rounding it up to something comfortable would make the diagram lie about the very
        // relation it is drawn to show. An earlier version skipped bars under 0.6pt as degenerate
        // and printed nothing at all for Sita's one rupee, which is worse than a sliver.
        pen.rect(BARM.X, top, barW, BARM.H, { fill: pen.ink, opacity: WASH, weight: STROKE_W });

        pen.text(
            row.valueTxt,
            row.valueInside ? BARM.X + barW - 5 : BARM.X + barW + 5,
            top + BARM.H / 2 + 3,
            { size: LABEL_SM, anchor: row.valueInside ? 'end' : 'start' },
        );

        if (row.place === 'inside') {
            pen.text(bar.label, row.innerCx, top + BARM.H / 2 + 3, {
                anchor: 'middle', max: barW - 8 - (row.valueInside ? row.valueW + 7 : 0),
            });
        } else if (row.place === 'beside') {
            pen.text(bar.label, row.besideX, top + BARM.H / 2 + 3, {
                max: BARM.X + BARM_FULL_W - row.besideX,
            });
        } else {
            row.aboveLines.forEach((line, li) => {
                pen.text(line, BARM.X, top - (row.aboveLines.length - li) * LINE + 6, {
                    max: BARM_FULL_W,
                });
            });
        }

        if (row.braceLines.length > 0) {
            // A brace needs a span to be a brace. Under a sliver it collapses into a knot of curves
            // that prints as a smudge, so a very short bar gets a plain leader instead.
            if (barW >= 12) pen.path(underBrace(BARM.X, BARM.X + barW, top + BARM.H + 4));
            else pen.line(BARM.X + barW / 2, top + BARM.H + 4, BARM.X + barW / 2, top + BARM.H + 14);
            row.braceLines.forEach((line, li) => {
                pen.text(
                    line,
                    row.braceWide ? BARM.X : r2(BARM.X + barW / 2),
                    top + BARM.H + 24 + li * LINE_SM,
                    { size: LABEL_SM, anchor: row.braceWide ? 'start' : 'middle', max: BARM_FULL_W },
                );
            });
        }
    }

    // The total spans the longest bar, which by construction is the full width - that is what makes
    // it read as the whole the other bars are parts of.
    if (totalLines.length > 0) {
        pen.path(underBrace(BARM.X, BARM.X + BARM_FULL_W, stackBottom + 6));
        totalLines.forEach((line, li) => {
            pen.text(line, BARM.X + BARM_FULL_W / 2, stackBottom + 26 + li * LINE_SM, {
                anchor: 'middle', max: BARM_FULL_W,
            });
        });
    }
}

/**
 * Ticks anchored on a multiple of the step rather than on `from`.
 *
 * `ticks` starts counting at `from`, which is right for a number line taught in twos and wrong on a
 * graph: x ticks reading -5, -3, -1, 1 have no tick at zero, and zero is the one value a reader
 * looks for.
 */
function alignedTicks(from: number, to: number, maxTicks: number): number[] {
    const base = ticks(from, to, undefined, maxTicks);
    const first = base[0], second = base[1];
    const step = first !== undefined && second !== undefined ? round(second - first) : 1;
    const start = round(Math.ceil(from / step - 1e-9) * step);
    return ticks(start, to, step, maxTicks);
}

/** The equation, written the way it is written on a board. */
function equation(fn: PlotSpec['fn']): string {
    let out = '';
    const push = (coef: number, tail: string): void => {
        if (coef === 0) return;
        const sign = out === '' ? (coef < 0 ? '-' : '') : coef < 0 ? ' - ' : ' + ';
        const mag = Math.abs(round(coef, 2));
        out += `${sign}${mag === 1 && tail !== '' ? '' : mag}${tail}`;
    };
    // The superscript two is WinAnsi 0xB2, so the standard face draws it and `safeText` never
    // reaches it. See `layout.ts`.
    push(fn.a ?? 0, 'x²');
    push(fn.m ?? 0, 'x');
    push(fn.c ?? 0, '');
    return `y = ${out === '' ? '0' : out}`;
}

/**
 * Clip a polyline to a rectangle, as one path string.
 *
 * The component wraps its curve in an SVG `clipPath` so a steep quadratic cannot escape past the
 * axes and draw over the labels. A PDF clipping path would work, but it is a graphics-state
 * operator that has to be pushed and popped around the drawing, and getting that wrong leaves the
 * REST of the page clipped. Liang-Barsky on each segment is local, and the curve is already
 * sampled, so the result is the same line.
 */
function clipToBox(points: Pt[], x0: number, y0: number, x1: number, y1: number): string {
    let d = '';
    let last: Pt | null = null;

    for (let i = 0; i + 1 < points.length; i++) {
        const p = points[i], q = points[i + 1];
        if (!p || !q) continue;
        let t0 = 0, t1 = 1;
        const dx = q.x - p.x, dy = q.y - p.y;
        const tests: Array<[number, number]> = [
            [-dx, p.x - x0], [dx, x1 - p.x], [-dy, p.y - y0], [dy, y1 - p.y],
        ];
        let visible = true;
        for (const [num, den] of tests) {
            if (num === 0) { if (den < 0) { visible = false; break } continue }
            const t = den / num;
            if (num < 0) { if (t > t1) { visible = false; break } if (t > t0) t0 = t }
            else { if (t < t0) { visible = false; break } if (t < t1) t1 = t }
        }
        if (!visible) { last = null; continue }

        const a = { x: r2(p.x + dx * t0), y: r2(p.y + dy * t0) };
        const b = { x: r2(p.x + dx * t1), y: r2(p.y + dy * t1) };
        if (!last || Math.abs(last.x - a.x) > 0.05 || Math.abs(last.y - a.y) > 0.05) {
            d += `M ${a.x} ${a.y} `;
        }
        d += `L ${b.x} ${b.y} `;
        last = b;
    }
    return d;
}

function plot(pen: Pen, spec: PlotSpec): void {
    const L = 34, R = 14, T = 24, B = 28;
    const H = 230;
    const PX0 = L, PX1 = W - R, PY0 = T, PY1 = H - B;

    const pts = spec.points ?? [];

    // A point the caller asked for but cannot see is worse than a slightly wider graph, so an
    // automatic range grows to hold every plotted point. A range the caller PINNED is obeyed.
    let xr: [number, number] = spec.xRange ?? [-5, 5];
    if (!spec.xRange) {
        for (const p of pts) xr = [Math.min(xr[0], Math.floor(p.x - 1)), Math.max(xr[1], Math.ceil(p.x + 1))];
    }
    let yr: [number, number] = spec.yRange ?? autoYRange(spec.fn, xr);
    if (!spec.yRange) {
        for (const p of pts) yr = [Math.min(yr[0], Math.floor(p.y - 1)), Math.max(yr[1], Math.ceil(p.y + 1))];
    }

    const x = scale(xr, [PX0, PX1]);
    const y = scale(yr, [PY1, PY0]);
    const axisY = y(clamp(0, yr[0], yr[1]));
    const axisX = x(clamp(0, xr[0], xr[1]));
    const originVisible = xr[0] <= 0 && xr[1] >= 0 && yr[0] <= 0 && yr[1] >= 0;

    const xTicks = alignedTicks(xr[0], xr[1], 9);
    const yTicks = alignedTicks(yr[0], yr[1], 8);

    pen.text(equation(spec.fn), 8, 12, { max: W - 16 });

    // The grid: the screen's 22% dashes. On paper that is the thinnest line that still prints.
    for (const t of xTicks) pen.line(x(t), PY0, x(t), PY1, { weight: 0.3, dash: [1.6, 2.6] });
    for (const t of yTicks) pen.line(PX0, y(t), PX1, y(t), { weight: 0.3, dash: [1.6, 2.6] });

    pen.arrow(PX0, axisY, PX1, axisY);
    pen.arrow(axisX, PY1, axisX, PY0);

    // Above the axis, not below it: the x tick labels run along underneath.
    pen.text('x', PX1 + 3, axisY - 6);
    pen.text('y', axisX + 6, PY0 + 3);
    if (originVisible) pen.text('O', axisX - 5, axisY + 12, { size: LABEL_SM, anchor: 'end' });

    for (const t of xTicks) {
        if (originVisible && t === 0) continue;
        pen.line(x(t), axisY - 3.5, x(t), axisY + 3.5);
        pen.text(String(round(t, 2)), x(t), axisY + 14, { size: LABEL_SM, anchor: 'middle' });
    }
    for (const t of yTicks) {
        if (originVisible && t === 0) continue;
        pen.line(axisX - 3.5, y(t), axisX + 3.5, y(t));
        pen.text(String(round(t, 2)), axisX - 6, y(t) + 3, { size: LABEL_SM, anchor: 'end' });
    }

    const curve = samplePlot(spec.fn, xr, 96).map((p) => ({ x: x(p.x), y: y(p.y) }));
    pen.path(clipToBox(curve, PX0, PY0, PX1, PY1), { weight: EMPHASIS_W });

    // Eight labelled points on one graph is what the validator allows, and on screen the captions
    // of two points a unit apart simply print over each other. Here each caption is nudged clear of
    // the ones already placed - never off its own point, which stays where the maths put it.
    const placed: Array<{ a: number; b: number; top: number; bottom: number }> = [];
    pts.forEach((p) => {
        if (p.x < xr[0] || p.x > xr[1] || p.y < yr[0] || p.y > yr[1]) return;
        const px = r2(x(p.x)), py = r2(y(p.y));
        pen.circle(px, py, 2.6, { fill: pen.ink });
        if (!p.label) return;
        // A label leans inwards rather than being sliced by the plot edge.
        const lines = wrapTwo(p.label, capacity(80, LABEL_SM));
        const wide = lines.reduce((m, l) => Math.max(m, pen.width(l, LABEL_SM)), 0);
        const toLeft = px + 5 + wide > PX1;
        const below = py - 6 - (lines.length - 1) * LINE_SM < PY0 + 6;
        const lx = Math.min(
            W - 4 - (toLeft ? 0 : wide),
            Math.max(4 + (toLeft ? wide : 0), toLeft ? px - 5 : px + 5),
        );
        const a = toLeft ? lx - wide : lx;
        const first = below ? py + 13 : py - 6 - (lines.length - 1) * LINE_SM;

        let shift = 0;
        for (const candidate of [0, -1, 1, -2, 2, -3, 3]) {
            shift = candidate * LINE_SM;
            const top = first + shift - LINE_SM;
            const bottom = first + shift + (lines.length - 1) * LINE_SM;
            if (!placed.some((q) => a < q.b && a + wide > q.a && top < q.bottom && bottom > q.top)) break;
        }
        placed.push({
            a, b: a + wide,
            top: first + shift - LINE_SM,
            bottom: first + shift + (lines.length - 1) * LINE_SM,
        });

        lines.forEach((line, li) => {
            pen.text(line, lx, clamp(first + shift + li * LINE_SM, 10, bodyHeight(spec) - 4), {
                size: LABEL_SM, anchor: toLeft ? 'end' : 'start',
            });
        });
    });
}

// ─── Geometry ───────────────────────────────────────────────────────────────────

const rad = (deg: number): number => (deg * Math.PI) / 180;

/** Unit vector at `deg`, anticlockwise from east. SVG y grows downwards, hence the -sin. */
function dir(deg: number): Pt {
    return { x: Math.cos(rad(deg)), y: -Math.sin(rad(deg)) };
}

function angle(pen: Pen, spec: AngleSpec): void {
    const H = 210;
    const deg = spec.degrees;
    // A hair of tolerance: an angle arriving as 89.999 from a calculation is still the square.
    const isRight = Math.abs(deg - 90) < 0.5;

    const clipName = (t: string, max: number): string =>
        t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
    const rayNames: [string, string] | null = spec.rays
        ? [clipName(spec.rays[0], 10), clipName(spec.rays[1], 10)]
        : null;

    // The sector spans from the ray at 0 to the ray at `deg`, so its extremes are the two ray tips
    // plus any compass direction the sweep crosses on the way.
    const corners: Pt[] = [{ x: 0, y: 0 }, dir(0), dir(deg)];
    for (const a of [90, 180, 270]) if (a < deg) corners.push(dir(a));
    const minX = Math.min(...corners.map((p) => p.x));
    const maxX = Math.max(...corners.map((p) => p.x));
    const minY = Math.min(...corners.map((p) => p.y));
    const maxY = Math.max(...corners.map((p) => p.y));

    // Room kept beyond the tips for the ray names, so fitting the sector can never push one of them
    // off the canvas - the shape shrinks instead of the label being clipped.
    const namePad = rayNames
        ? Math.max(pen.width(rayNames[0], LABEL), pen.width(rayNames[1], LABEL)) + 12
        : 0;
    const padX = 16 + namePad, padY = 24;
    const boxW = W - 2 * padX, boxH = H - 2 * padY;
    const r = Math.min(96, boxW / (maxX - minX), boxH / (maxY - minY));

    const vx = padX + (boxW - (maxX - minX) * r) / 2 - minX * r;
    const vy = padY + (boxH - (maxY - minY) * r) / 2 - minY * r;
    const at = (a: number, radius: number): Pt => {
        const d = dir(a);
        return { x: r2(vx + d.x * radius), y: r2(vy + d.y * radius) };
    };

    const tipA = at(0, r), tipB = at(deg, r);
    const arcR = Math.max(20, Math.min(42, r * 0.36));
    const arcStart = at(0, arcR), arcEnd = at(deg, arcR);
    // Sweep 0 is anticlockwise on screen, which is the direction the angle is measured in.
    const arcD = `M ${arcStart.x} ${arcStart.y} A ${arcR} ${arcR} 0 ${deg > 180 ? 1 : 0} 0 ${arcEnd.x} ${arcEnd.y}`;

    const sq = Math.min(arcR * 0.62, 22);
    const c1 = at(0, sq), c2 = at(90, sq);
    const squareD = `M ${c1.x} ${c1.y} L ${r2(c1.x + c2.x - vx)} ${r2(c1.y + c2.y - vy)} L ${c2.x} ${c2.y}`;

    const measure = spec.label ?? `${round(deg, 1)}°`;

    // The measurement sits on the bisector, and the only question is at what radius: it must be
    // wholly INSIDE the arc or wholly outside it, never straddling the line, and it must clear both
    // rays. The wedge widens as `R tan(deg/2)`, so both tests are one formula.
    const halfW = pen.width(measure, LABEL) / 2;
    const tanHalf = deg >= 180 ? Number.POSITIVE_INFINITY : Math.tan(rad(deg / 2));
    const barrier = isRight ? sq * Math.SQRT2 : arcR;
    const insideR = barrier - 3 - halfW;
    const outsideR = Math.max(barrier + 3 + halfW, halfW + 6 / tanHalf);
    const fitsInside = !isRight && insideR > 8 && insideR >= halfW - 2
        && (insideR - halfW) * tanHalf >= 6;
    // A very narrow angle has no room for the text between its rays at any radius, so the label
    // steps sideways out of the wedge rather than being printed across a ray.
    const asideOf = !fitsInside && outsideR > r - 8;
    const labelR = fitsInside ? insideR : asideOf ? arcR + 13 : outsideR;
    const aside = asideOf ? dir(deg / 2 - 90) : { x: 0, y: 0 };
    const spot = at(deg / 2, labelR);

    pen.arrow(vx, vy, tipA.x, tipA.y);
    pen.arrow(vx, vy, tipB.x, tipB.y);
    pen.path(isRight ? squareD : arcD, { weight: EMPHASIS_W });
    pen.circle(vx, vy, 2.2, { fill: pen.ink });

    // A near-full sweep has no outside left anywhere on the ring, so a wide measurement printed
    // "beside" the wedge lies across the arc instead. There it goes ABOVE the whole figure, which
    // is the one piece of clear paper a 359 degree angle still has.
    const overTheTop = asideOf && halfW > arcR;
    pen.text(
        measure,
        clamp(overTheTop ? vx : spot.x + aside.x * 12, halfW + 5, W - halfW - 5),
        overTheTop ? Math.max(12, vy - r - 6) : clamp(spot.y + aside.y * 12, 14, H - 4) + 3,
        { anchor: 'middle', max: W - 10 },
    );

    if (rayNames) {
        const nameAt = (a: number): { x: number; y: number; anchor: Anchor } => {
            const d = dir(a);
            const p = at(a, r + 10);
            return {
                x: p.x,
                y: r2(p.y + (d.y < -0.35 ? -3 : d.y > 0.35 ? 10 : 3.5)),
                anchor: d.x > 0.35 ? 'start' : d.x < -0.35 ? 'end' : 'middle',
            };
        };
        const a0 = nameAt(0), a1 = nameAt(deg);
        // At 359 degrees the two rays very nearly coincide, so the two names land on the same spot
        // and print through each other. The second one drops a line: two names one above the other
        // still say which ray is which, because each still leaves from its own tip.
        const near = Math.abs(a0.x - a1.x) < Math.max(pen.width(rayNames[0], LABEL), pen.width(rayNames[1], LABEL))
            && Math.abs(a0.y - a1.y) < LINE;
        pen.text(rayNames[0], a0.x, a0.y, { anchor: a0.anchor });
        pen.text(rayNames[1], a1.x, near ? a1.y + LINE : a1.y, { anchor: a1.anchor });
    }
}

function unit(from: Pt, to: Pt): Pt {
    const dx = to.x - from.x, dy = to.y - from.y;
    const len = Math.hypot(dx, dy);
    // Two identical points would divide by zero; east is arbitrary but finite, and the validator
    // lets a caller repeat a point.
    return len === 0 ? { x: 1, y: 0 } : { x: dx / len, y: dy / len };
}

function polygon(pen: Pen, spec: PolygonSpec): void {
    const H = 230;
    const padX = 40, padY = 32;
    const innerW = W - 2 * padX, innerH = H - 2 * padY;

    const n = spec.points.length;
    const pts: Pt[] = spec.points.map((p) => ({
        x: r2(padX + p.x * innerW),
        y: r2(padY + p.y * innerH),
    }));
    const nth = (i: number): Pt => pts[((i % n) + n) % n] ?? { x: W / 2, y: H / 2 };

    const centroid: Pt = {
        x: pts.reduce((s, p) => s + p.x, 0) / n,
        y: pts.reduce((s, p) => s + p.y, 0) / n,
    };

    /**
     * Put a label `dist` away from `base`, on the OUTSIDE of the shape.
     *
     * A shape drawn hard against the edge of the canvas has no outside left on that side, so the
     * label flips to the inside rather than being clamped on top of the line it belongs to.
     */
    const put = (base: Pt, out: Pt, text: string, size: number, dist: number) => {
        const w = pen.width(text, size);
        const spots = [out, { x: -out.x, y: -out.y }].map((way) => {
            const anchor: Anchor = way.x > 0.3 ? 'start' : way.x < -0.3 ? 'end' : 'middle';
            const x = base.x + way.x * dist;
            const y = base.y + way.y * dist + (way.y > 0.3 ? size * 0.85 : way.y < -0.3 ? -2 : size * 0.37);
            const left = anchor === 'start' ? x : anchor === 'end' ? x - w : x - w / 2;
            return { x, y, anchor, left };
        });
        const chosen = spots.find((s) => s.left >= 4 && s.left + w <= W - 4 && s.y >= 10 && s.y <= H - 4)
            ?? spots[0] ?? { x: base.x, y: base.y, anchor: 'middle' as Anchor, left: base.x };
        const shift = Math.max(0, 4 - chosen.left) - Math.max(0, chosen.left + w - (W - 4));
        return {
            x: r2(chosen.x + shift),
            y: r2(clamp(chosen.y, 10, H - 4)),
            anchor: chosen.anchor,
        };
    };

    pen.path(`${toPath(pts)} Z`);

    // The right-angle square is built from the two edges meeting at the vertex, so it leans with
    // the shape. Drawn as a parallelogram when the vertex is not actually square, which is honest:
    // the mark says what the caller claimed, and a wrong claim is then visible.
    if (spec.rightAngleAt !== undefined) {
        const k = spec.rightAngleAt;
        const p = nth(k), prev = nth(k - 1), next = nth(k + 1);
        const u = unit(p, prev), v = unit(p, next);
        const s = Math.min(
            13,
            Math.hypot(prev.x - p.x, prev.y - p.y) * 0.3,
            Math.hypot(next.x - p.x, next.y - p.y) * 0.3,
        );
        pen.path(
            `M ${r2(p.x + u.x * s)} ${r2(p.y + u.y * s)}`
            + ` L ${r2(p.x + (u.x + v.x) * s)} ${r2(p.y + (u.y + v.y) * s)}`
            + ` L ${r2(p.x + v.x * s)} ${r2(p.y + v.y * s)}`,
            { weight: EMPHASIS_W },
        );
    }

    spec.points.forEach((p, i) => {
        if (!p.label) return;
        const text = pen.fit(p.label, LABEL, 46);
        const spot = put(nth(i), unit(centroid, nth(i)), text, LABEL, 13);
        pen.text(text, spot.x, spot.y, { anchor: spot.anchor });
    });

    (spec.sides ?? []).forEach((side, i) => {
        if (i >= n) return;
        const a = nth(i), b = nth(i + 1);
        const mid: Pt = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const e = unit(a, b);
        // Both normals of an edge; the outward one points away from the centroid.
        const cand: Pt = { x: e.y, y: -e.x };
        const away = (mid.x - centroid.x) * cand.x + (mid.y - centroid.y) * cand.y >= 0;
        const nrm: Pt = away ? cand : { x: -cand.x, y: -cand.y };
        const text = pen.fit(side, LABEL_SM, 62);
        const spot = put(mid, nrm, text, LABEL_SM, 14);
        pen.text(text, spot.x, spot.y, { size: LABEL_SM, anchor: spot.anchor });
    });
}

// ─── Science ────────────────────────────────────────────────────────────────────

type Direction = ForcesSpec['arrows'][number]['direction'];

const DIRS: Record<Direction, Pt> = {
    up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 },
};

/** Arrow lengths. `MIN` keeps a very small force visible as an arrow rather than a nub. */
const MAX_LEN = 62, MIN_LEN = 18, DEFAULT_LEN = 48;

/** The one place a magnitude becomes a length. Same input, same output, in every direction. */
function lengthOf(magnitude: number | undefined): number {
    return magnitude === undefined ? DEFAULT_LEN : Math.max(MIN_LEN, round(magnitude * MAX_LEN, 2));
}

function forces(pen: Pen, spec: ForcesSpec): void {
    const H = 220;
    const cx = W / 2, cy = H / 2;

    const bodyLines = spec.body ? wrapTwo(spec.body, capacity(104, LABEL)) : [];
    const widest = bodyLines.reduce((m, l) => Math.max(m, pen.width(l, LABEL)), 0);
    const bw = Math.min(116, Math.max(76, widest + 20));
    const bh = 44;

    pen.path(
        `M ${r2(cx - bw / 2 + 5)} ${r2(cy - bh / 2)} L ${r2(cx + bw / 2 - 5)} ${r2(cy - bh / 2)}`
        + ` Q ${r2(cx + bw / 2)} ${r2(cy - bh / 2)} ${r2(cx + bw / 2)} ${r2(cy - bh / 2 + 5)}`
        + ` L ${r2(cx + bw / 2)} ${r2(cy + bh / 2 - 5)}`
        + ` Q ${r2(cx + bw / 2)} ${r2(cy + bh / 2)} ${r2(cx + bw / 2 - 5)} ${r2(cy + bh / 2)}`
        + ` L ${r2(cx - bw / 2 + 5)} ${r2(cy + bh / 2)}`
        + ` Q ${r2(cx - bw / 2)} ${r2(cy + bh / 2)} ${r2(cx - bw / 2)} ${r2(cy + bh / 2 - 5)}`
        + ` L ${r2(cx - bw / 2)} ${r2(cy - bh / 2 + 5)}`
        + ` Q ${r2(cx - bw / 2)} ${r2(cy - bh / 2)} ${r2(cx - bw / 2 + 5)} ${r2(cy - bh / 2)} Z`,
    );
    bodyLines.forEach((line, li) => {
        pen.text(line, cx, cy + (bodyLines.length === 1 ? 3 : li === 0 ? -2 : 10), {
            anchor: 'middle', max: bw - 6,
        });
    });

    // Group by direction first: an arrow needs to know how many others share its side before it
    // knows where to sit.
    const order: Direction[] = ['up', 'down', 'left', 'right'];
    for (const d of order) {
        const items = spec.arrows.map((a, i) => ({ a, i })).filter(({ a }) => a.direction === d);
        if (items.length === 0) continue;

        const vertical = d === 'up' || d === 'down';
        const alongHalf = vertical ? bh / 2 : bw / 2;
        const spreadHalf = vertical ? bw / 2 : bh / 2;
        const spread = items.length > 1 ? ((spreadHalf - 9) * 2) / (items.length - 1) : 0;
        // Side-by-side arrows put their labels side by side too, so the name has to fit in the gap.
        const budget = vertical && items.length > 1 ? Math.max(12, spread - 3) : 90;

        items.forEach(({ a }, j) => {
            const v = DIRS[d];
            const off = (j - (items.length - 1) / 2) * spread;
            // Length is a pure function of magnitude - not of the largest force present, not of the
            // direction, not of how much room is left on that side. Two arrows of equal magnitude
            // MUST draw equal, because "balanced" is read straight off the picture.
            const len = lengthOf(a.magnitude);
            const sx = r2(cx + (vertical ? off : v.x * alongHalf));
            const sy = r2(cy + (vertical ? v.y * alongHalf : off));
            const tx = r2(sx + v.x * len);
            const ty = r2(sy + v.y * len);

            pen.arrow(sx, sy, tx, ty, { weight: EMPHASIS_W });

            const text = pen.fit(a.label, LABEL, budget);
            const w = pen.width(text, LABEL);
            const rawX = vertical
                ? sx
                : d === 'right'
                    ? Math.max(tx, cx + bw / 2 + w / 2 + 6)
                    : Math.min(tx, cx - bw / 2 - w / 2 - 6);
            pen.text(
                text,
                clamp(rawX, w / 2 + 5, W - w / 2 - 5),
                r2(vertical ? ty + (d === 'up' ? -8 : 15) : sy - 8),
                { anchor: 'middle' },
            );
        });
    }
}

function projectile(pen: Pen, spec: ProjectileSpec): void {
    const H = 230;
    const groundY = H - 32;
    const topY = 26;
    const mode = spec.mode ?? 'drop';
    const startX = mode === 'throw' ? 46 : W / 2;
    const endX = mode === 'throw' ? W - 54 : W / 2;
    const unitName = spec.unit ?? 'm';

    const HEAD_R = 15, BALL_R = 8;
    const headCy = groundY - 60;
    const headTop = headCy - HEAD_R;
    const restY = spec.target === 'head' ? headTop - BALL_R - 2 : groundY - BALL_R;

    // The normalised path from the shared geometry, mapped onto this canvas - so print and screen
    // draw the same curve rather than two implementations of it. The easing IS the content: free
    // fall is quadratic in time, and a linear drop teaches the wrong thing in a physics lesson.
    const pts = trajectory(mode).map((p) => ({
        x: startX + (endX - startX) * p.x,
        y: topY + (restY - topY) * p.y,
    }));
    const last = pts[pts.length - 1] ?? { x: endX, y: groundY };
    const first = pts[0] ?? { x: startX, y: topY };

    pen.line(16, groundY, W - 16, groundY);

    if (spec.height !== undefined) {
        const hx = mode === 'throw' ? 26 : startX - 52;
        pen.line(hx, topY, hx, restY, { weight: HAIR_W, dash: DASH });
        pen.head(hx, restY, 0, 1, 4);
        pen.head(hx, topY, 0, -1, 4);
        // "120metres" is 42 points wide and the throw's measure stands 26 from the left edge, so
        // the obvious placement runs the label off the paper. It flips to the other side of the
        // dashed line rather than being clipped - MEASURED, because the label is the caller's own
        // number and a number half off the page is worse than no diagram.
        const text = `${spec.height}${unitName}`;
        const w = pen.width(text, LABEL);
        if (w <= hx - 7) {
            // Beside the measure, at the middle of the measure - which is the middle of the FALL,
            // not of the canvas. The component splits the difference between the top and the
            // ground even when the object lands on a head well above it, and the label then floats
            // below the line it belongs to.
            pen.text(text, hx - 5, (topY + restY) / 2, { anchor: 'end', max: hx - 7 });
        } else {
            // A throw's measure stands 26 points from the left edge and cannot hold a wide label on
            // either side without crossing the velocity vector, so it sits over the top of the
            // measure instead, where a throw has nothing but sky.
            pen.text(text, clamp(hx, w / 2 + 3, W - w / 2 - 3), topY - 5, { anchor: 'middle' });
        }
    }

    pen.path(toPath(pts), { weight: HAIR_W, dash: DASH });

    // Newton, minimally. An outline and nothing else: a face would be illustration, and
    // illustration is not something this library can generate honestly.
    if (spec.target === 'head') {
        pen.circle(endX, headCy, HEAD_R);
        pen.path(`M ${r2(endX - 30)} ${groundY} Q ${r2(endX - 26)} ${r2(headCy + HEAD_R + 4)} ${endX} ${r2(headCy + HEAD_R)}`);
        pen.path(`M ${r2(endX + 30)} ${groundY} Q ${r2(endX + 26)} ${r2(headCy + HEAD_R + 4)} ${endX} ${r2(headCy + HEAD_R)}`);
    }

    // The object, where it came to rest - which is what the screen shows once the fall has run.
    pen.circle(last.x, restY, BALL_R, { fill: pen.ink });

    if (spec.object) {
        // A thrown object launches from the LEFT at rest height, which is exactly where the
        // velocity vector and its caption go, so the name sits above them there rather than through
        // them. A drop starts at the top with nothing beside it and keeps the obvious placement.
        const lifted = spec.showVectors && mode === 'throw';
        pen.text(spec.object, first.x + 13, lifted ? first.y - 22 : first.y + 4, {
            max: W - first.x - 20,
        });
    }

    if (spec.showVectors) {
        pen.arrow(first.x, first.y + 12, first.x, first.y + 42, { weight: EMPHASIS_W });
        pen.text('weight (mg)', first.x + 6, first.y + 38, { size: LABEL_SM });
        if (mode === 'throw') {
            pen.arrow(first.x, first.y, first.x + 40, first.y, { weight: EMPHASIS_W });
            pen.text('velocity', first.x + 8, first.y - 6, { size: LABEL_SM });
        }
    }
}

interface Box { x0: number; x1: number; y0: number; y1: number }

/** Where a ray leaving `p` along `d` crosses the edge of the drawing box. */
function exitAt(p: Pt, d: Pt, box: Box): Pt {
    let t = Number.POSITIVE_INFINITY;
    if (d.x > 0) t = Math.min(t, (box.x1 - p.x) / d.x);
    if (d.x < 0) t = Math.min(t, (box.x0 - p.x) / d.x);
    if (d.y > 0) t = Math.min(t, (box.y1 - p.y) / d.y);
    if (d.y < 0) t = Math.min(t, (box.y0 - p.y) / d.y);
    if (!Number.isFinite(t) || t < 0) return p;
    return { x: r2(p.x + d.x * t), y: r2(p.y + d.y * t) };
}

function rayDiagram(pen: Pen, spec: RayDiagramSpec): void {
    const H = 200;
    const cx = W / 2, cy = 96;
    const box: Box = { x0: 12, x1: W - 12, y0: 14, y1: H - 18 };

    const element = spec.element;
    const isMirror = element === 'concaveMirror' || element === 'convexMirror';
    const d = spec.objectDistance;
    const h0 = spec.objectHeight ?? 1;

    // Every position comes from the thin-lens or mirror equation in the Cartesian convention the
    // syllabus uses. An image nudged to where it looks right teaches that an object at 3F gives an
    // image at 3F, which is the error this diagram exists to prevent.
    const f = element === 'convexLens' || element === 'convexMirror' ? 1 : -1;
    const u = -d;
    const invV = isMirror ? 1 / f - 1 / u : 1 / f + 1 / u;
    const v = invV === 0 ? Number.POSITIVE_INFINITY : 1 / invV;
    const atInfinity = Math.abs(invV) < 0.02;
    const beyond = atInfinity || Math.abs(v) > 6.5;
    const m = isMirror ? -v / u : v / u;
    const hi = m * h0;
    const real = isMirror ? v < 0 : v > 0;

    const S = Math.max(2.35, d + 0.45, beyond ? 0 : Math.abs(v) + 0.5);
    const sx = scale([-S, S], [box.x0 + 4, box.x1 - 4]);
    const ppu = (box.x1 - box.x0 - 8) / (2 * S);
    const hSpan = Math.max(h0, beyond ? 0 : Math.abs(hi));
    const yUnit = Math.min(30, 60 / hSpan);
    const sy = (Y: number): number => r2(cy - Y * yUnit);
    const P = (X: number, Y: number): Pt => ({ x: r2(sx(X)), y: sy(Y) });
    const pixDir = (v2: Pt): Pt => ({ x: v2.x * ppu, y: -v2.y * yUnit });

    const objTip = P(-d, h0);
    const hitA = P(0, h0);
    const pole = P(0, 0);

    const dirA: Pt = element === 'convexLens' ? { x: 1, y: -h0 }
        : element === 'concaveLens' ? { x: 1, y: h0 }
            : element === 'concaveMirror' ? { x: -1, y: -h0 }
                : { x: -1, y: h0 };
    const dirB: Pt = isMirror ? { x: -d, y: -h0 } : { x: d, y: -h0 };
    const apparentF = element === 'concaveLens' ? -1 : element === 'convexMirror' ? 1 : null;

    const endA = exitAt(hitA, pixDir(dirA), box);
    const endB = exitAt(pole, pixDir(dirB), box);

    // Backward extensions. Only a VIRTUAL image needs them - it is where the emerging rays only
    // appear to come from - so they are dashed, and that difference is the lesson.
    let extA: string | null = null;
    let extB: string | null = null;
    if (!beyond && !real) {
        const end = apparentF !== null && Math.abs(apparentF) > Math.abs(v) ? apparentF : v;
        const t = end / -dirA.x;
        extA = toPath([hitA, P(end, h0 - dirA.y * t)]);
        extB = isMirror ? toPath([pole, P(v, hi)])
            : Math.abs(v) > d ? toPath([objTip, P(v, hi)]) : null;
    }

    const focal = isMirror
        ? [{ X: f, label: 'F' }, { X: 2 * f, label: '2F' }]
        : [{ X: -1, label: 'F' }, { X: 1, label: 'F' }, { X: -2, label: '2F' }, { X: 2, label: '2F' }];

    const mh = clamp(h0 * yUnit + 12, 38, 70);
    const lensW = 9, bow = 12;
    const face = element === 'concaveMirror' ? -1 : 1;

    pen.line(box.x0, cy, box.x1, cy, { weight: 0.6 });

    if (element === 'convexLens') {
        pen.path(`M ${cx} ${r2(cy - mh)} Q ${cx + lensW} ${cy} ${cx} ${r2(cy + mh)}`);
        pen.path(`M ${cx} ${r2(cy - mh)} Q ${cx - lensW} ${cy} ${cx} ${r2(cy + mh)}`);
    } else if (element === 'concaveLens') {
        pen.line(cx - lensW, cy - mh, cx + lensW, cy - mh);
        pen.line(cx - lensW, cy + mh, cx + lensW, cy + mh);
        pen.path(`M ${cx - lensW} ${r2(cy - mh)} Q ${cx + lensW - 4} ${cy} ${cx - lensW} ${r2(cy + mh)}`);
        pen.path(`M ${cx + lensW} ${r2(cy - mh)} Q ${cx - lensW + 4} ${cy} ${cx + lensW} ${r2(cy + mh)}`);
    } else {
        pen.path(`M ${r2(cx + face * bow)} ${r2(cy - mh)} Q ${r2(cx - face * bow)} ${cy} ${r2(cx + face * bow)} ${r2(cy + mh)}`);
        // Hatching marks the silvered back, so the reflecting face is never ambiguous.
        for (let i = 0; i < 7; i++) {
            const t = (i + 0.5) / 7;
            const w0 = (1 - t) * (1 - t), w1 = 2 * (1 - t) * t, w2 = t * t;
            const hx = (w0 + w2) * (cx + face * bow) + w1 * (cx - face * bow);
            const hy = w0 * (cy - mh) + w1 * cy + w2 * (cy + mh);
            pen.line(hx, hy, hx + 7, hy - 5, { weight: 0.6 });
        }
    }

    const imgX = beyond ? 0 : r2(sx(v));
    focal.forEach((mark) => {
        const fx = r2(sx(mark.X));
        // Nudge a focus label clear of an arrow standing on the same point - an object at 2F is the
        // commonest spec there is.
        const near = Math.abs(fx - objTip.x) < 11 || (!beyond && Math.abs(fx - imgX) < 11);
        pen.line(fx, cy - 4, fx, cy + 4);
        pen.text(mark.label, near ? fx + 4 : fx, cy + 13, {
            size: LABEL_SM, anchor: near ? 'start' : 'middle',
        });
    });

    pen.arrow(objTip.x, cy, objTip.x, objTip.y, { weight: EMPHASIS_W });
    pen.text('Object', clamp(objTip.x, 20, W - 20), objTip.y - 7, { anchor: 'middle' });

    pen.line(objTip.x, objTip.y, hitA.x, hitA.y);
    pen.arrow(hitA.x, hitA.y, endA.x, endA.y);
    pen.line(objTip.x, objTip.y, pole.x, pole.y);
    pen.arrow(pole.x, pole.y, endB.x, endB.y);

    if (extA) pen.path(extA, { weight: HAIR_W, dash: DASH });
    if (extB) pen.path(extB, { weight: HAIR_W, dash: DASH });

    if (beyond) {
        pen.text(
            atInfinity
                ? 'Image at infinity - the rays emerge parallel'
                : `Image ${real ? 'real' : 'virtual'} at ${round(Math.abs(v), 1)}f, beyond this view`,
            cx, H - 5, { size: LABEL_SM, anchor: 'middle', max: W - 20 },
        );
        return;
    }

    const imgTipY = sy(hi);
    // A virtual image is dashed, and a real one is not. On screen that is a dash pattern at the
    // same weight; here it is the same, because the distinction is not decoration.
    pen.line(imgX, cy, imgX, imgTipY, {
        weight: EMPHASIS_W, dash: real ? undefined : [3.5, 2.5],
    });
    pen.head(imgX, imgTipY, 0, imgTipY - cy);
    pen.text('Image', clamp(imgX, 34, W - 34), hi > 0 ? imgTipY - 18 : imgTipY + 12, { anchor: 'middle' });
    pen.text(
        `${real ? 'real' : 'virtual'}, ${hi < 0 ? 'inverted' : 'upright'}`,
        clamp(imgX, 34, W - 34), hi > 0 ? imgTipY - 8 : imgTipY + 22,
        { size: LABEL_SM, anchor: 'middle' },
    );
}

type ComponentType = CircuitSpec['components'][number]['type'];

/** Half the width of each symbol along the wire, so the wire MEETS it rather than runs behind it. */
const FOOTPRINT: Record<ComponentType, number> = {
    battery: 9, bulb: 11, resistor: 13, switch: 10, ammeter: 11, voltmeter: 11,
};

const TYPE_NAME: Record<ComponentType, string> = {
    battery: 'battery', bulb: 'bulb', resistor: 'resistor',
    switch: 'switch', ammeter: 'ammeter', voltmeter: 'voltmeter',
};

interface Placed {
    type: ComponentType;
    label: string;
    x: number;
    y: number;
    vertical: boolean;
    tx: number;
    ty: number;
    anchor: Anchor;
    budget: number;
    /** Read bottom-to-top. A crowded parallel rail has vertical room where it has no horizontal. */
    upright?: boolean;
}

/** A straight run of wire with the symbols' footprints cut out of it. */
function wireRun(
    axis: 'h' | 'v', fixed: number, from: number, to: number, holes: Array<[number, number]>,
): string {
    const pt = (v: number): string => (axis === 'h' ? `${r2(v)} ${r2(fixed)}` : `${r2(fixed)} ${r2(v)}`);
    let cur = from;
    let d = '';
    for (const [a, b] of [...holes].sort((p, q) => p[0] - q[0])) {
        if (a > cur) d += `M ${pt(cur)} L ${pt(a)} `;
        cur = Math.max(cur, b);
    }
    if (to > cur) d += `M ${pt(cur)} L ${pt(to)} `;
    return d;
}

/**
 * One symbol, drawn about `(cx, cy)`.
 *
 * This is the one diagram where the reader already knows what the picture must look like - a cell
 * is a long plate and a short plate, a lamp is a circle with a cross - because a student copies it
 * into an exercise book and is marked on it. So every symbol is the textbook one.
 *
 * `vertical` rotates the local coordinates by -90 the way the component's `transform` does, which
 * is why the two meter letters are drawn by the caller instead: they stay upright.
 */
function circuitSymbol(pen: Pen, type: ComponentType, cx: number, cy: number, vertical: boolean): void {
    const m = (x: number, y: number): Pt => (vertical ? { x: cx + y, y: cy - x } : { x: cx + x, y: cy + y });
    const seg = (x1: number, y1: number, x2: number, y2: number): void => {
        const a = m(x1, y1), b = m(x2, y2);
        pen.line(a.x, a.y, b.x, b.y);
    };
    switch (type) {
        case 'battery':
            // Two cells: long plate, short plate, long plate, short plate.
            seg(-9, -11, -9, 11); seg(-4, -6, -4, 6); seg(4, -11, 4, 11); seg(9, -6, 9, 6);
            return;
        case 'bulb':
            pen.circle(cx, cy, 11);
            seg(-7.8, -7.8, 7.8, 7.8); seg(-7.8, 7.8, 7.8, -7.8);
            return;
        case 'resistor': {
            const a = m(-13, -6.5), b = m(13, -6.5), c = m(13, 6.5), d = m(-13, 6.5);
            pen.path(`M ${a.x} ${a.y} L ${b.x} ${b.y} L ${c.x} ${c.y} L ${d.x} ${d.y} Z`);
            return;
        }
        case 'switch': {
            // Open on purpose: a closed switch is indistinguishable from a plain wire, and the gap
            // is the thing being taught.
            seg(-10, 0, 7, -11);
            const l = m(-10, 0), r = m(10, 0);
            pen.circle(l.x, l.y, 1.6, { fill: pen.ink });
            pen.circle(r.x, r.y, 1.6, { fill: pen.ink });
            return;
        }
        case 'ammeter':
        case 'voltmeter':
            pen.circle(cx, cy, 11);
            return;
    }
}

function circuit(pen: Pen, spec: CircuitSpec): void {
    const x0 = 26, x1 = 294, y0 = 50, y1 = 136;
    const midY = (y0 + y1) / 2;
    const parallel = spec.arrangement === 'parallel';

    const all = spec.components.map((c) => ({ type: c.type, label: c.label ?? TYPE_NAME[c.type] }));
    // Only the FIRST battery takes the supply position; a second one is an ordinary component on
    // the loop, which is what the spec is actually describing.
    const supplyIndex = all.findIndex((c) => c.type === 'battery');
    const supply = supplyIndex >= 0 ? all[supplyIndex] : undefined;
    const rest = all.filter((_, i) => i !== supplyIndex);

    const placed: Placed[] = [];
    const wire: string[] = [];

    if (parallel) {
        const supplyX = x0 + 46;
        if (supply) {
            placed.push({
                type: 'battery', label: supply.label, x: supplyX, y: y1, vertical: false,
                tx: supplyX, ty: y1 + 22, anchor: 'middle', budget: 80,
            });
        }
        const first = supply ? x0 + 92 : x0 + 40;
        const step = rest.length > 1 ? (x1 - first) / (rest.length - 1) : 0;
        const budget = rest.length > 1 ? Math.max(14, step - 16) : 70;
        // Seven branches on a 268-point rail leaves 29 points between them, and 29 points of
        // Helvetica is "L…" - a label that identifies nothing. The branch itself is 86 points tall,
        // so a crowded rail turns its names on their side and gets all of them, which is what a
        // circuit printed in a textbook does with a component list too.
        const upright = budget < 34;

        wire.push(wireRun('h', y0, x0, x1, []));
        // The right-hand edge is only drawn when nothing branches onto it - otherwise the last
        // branch IS that edge, and drawing both would put a second wire on top of the first.
        if (rest.length === 0) wire.push(wireRun('v', x1, y0, y1, []));
        wire.push(wireRun('h', y1, x0, x1, supply ? [[supplyX - 9, supplyX + 9]] : []));
        wire.push(wireRun('v', x0, y0, y1, []));

        rest.forEach((c, j) => {
            const bx = rest.length > 1 ? r2(first + step * j) : x1;
            const last = j === rest.length - 1;
            placed.push({
                type: c.type, label: c.label, x: bx, y: midY, vertical: true,
                tx: upright
                    ? bx + FOOTPRINT[c.type] + 4
                    : last ? bx - FOOTPRINT[c.type] - 4 : bx + FOOTPRINT[c.type] + 4,
                ty: midY + 3,
                anchor: last ? 'end' : 'start',
                budget: upright ? y1 - y0 - 10 : budget,
                upright,
            });
            wire.push(wireRun('v', bx, y0, y1, [[midY - FOOTPRINT[c.type], midY + FOOTPRINT[c.type]]]));
        });
    } else {
        const onTop = rest.slice(0, Math.ceil(rest.length / 2));
        // The leftovers come back along the bottom, right to left, so component order reads as one
        // clockwise trip round the loop starting at the cell.
        const onBottom = [...rest.slice(onTop.length)].reverse();
        const budgetFor = (count: number): number =>
            Math.max(22, (x1 - x0 - 24) / Math.max(count, 1) - 6);

        const spread = (items: typeof rest, y: number, above: boolean, offset: number): void => {
            const total = items.length + offset;
            const from = x0 + 22, to = x1 - 22;
            items.forEach((c, j) => {
                const at = r2(from + ((to - from) * (j + offset + 0.5)) / total);
                placed.push({
                    type: c.type, label: c.label, x: at, y, vertical: false,
                    tx: at, ty: above ? y - 17 : y + 22, anchor: 'middle', budget: budgetFor(total),
                });
            });
        };

        spread(onTop, y0, true, 0);
        if (supply) {
            const total = onBottom.length + 1;
            const from = x0 + 22, to = x1 - 22;
            const at = r2(from + ((to - from) * 0.5) / total);
            placed.push({
                type: 'battery', label: supply.label, x: at, y: y1, vertical: false,
                tx: at, ty: y1 + 22, anchor: 'middle', budget: budgetFor(total),
            });
            spread(onBottom, y1, false, 1);
        } else {
            spread(onBottom, y1, false, 0);
        }

        const holes = (y: number): Array<[number, number]> =>
            placed.filter((p) => p.y === y).map((p) => [p.x - FOOTPRINT[p.type], p.x + FOOTPRINT[p.type]]);
        wire.push(wireRun('h', y0, x0, x1, holes(y0)));
        wire.push(wireRun('h', y1, x0, x1, holes(y1)));
        wire.push(wireRun('v', x0, y0, y1, []));
        wire.push(wireRun('v', x1, y0, y1, []));
    }

    pen.path(wire.join(''));

    for (const p of placed) {
        circuitSymbol(pen, p.type, p.x, p.y, p.vertical);
        if (p.type === 'ammeter' || p.type === 'voltmeter') {
            pen.text(p.type === 'ammeter' ? 'A' : 'V', p.x, p.y + 3, { anchor: 'middle' });
        }
    }
    for (const p of placed) {
        if (p.upright) pen.vtext(p.label, p.tx, midY, { size: LABEL_SM, max: p.budget });
        else pen.text(p.label, p.tx, p.ty, { size: LABEL_SM, anchor: p.anchor, max: p.budget });
    }
}

// ─── General and computing ──────────────────────────────────────────────────────

function timeline(pen: Pen, spec: TimelineSpec): void {
    if ((spec.orientation ?? 'vertical') === 'horizontal') {
        const { rows, axisY, half } = timelineHorizontal(spec);
        // Arrowed, because a timeline has a direction and the reader should not have to infer it.
        pen.arrow(8, axisY, W - 8, axisY);

        for (const e of rows) {
            // The block is centred on its tick but pushed inside the canvas at the two ends. The
            // stub stays on the tick, so a shifted block still points at its own event.
            const tx = clamp(e.x, 6 + half, W - 6 - half);
            const d = e.above ? -1 : 1;
            const atFirst = e.above ? axisY - 18 - (e.at.length - 1) * LINE_SM : axisY + 21;
            const labelFirst = e.above
                ? atFirst - LINE_SM - 4 - (e.label.length - 1) * LINE
                : axisY + 21 + e.at.length * LINE_SM + 4;
            pen.line(e.x, axisY, e.x, axisY + d * 10);
            pen.circle(e.x, axisY, 2.8, { fill: pen.ink });
            e.at.forEach((line, li) => {
                pen.text(line, tx, atFirst + li * LINE_SM, {
                    size: LABEL_SM, anchor: 'middle', max: half * 2,
                });
            });
            e.label.forEach((line, li) => {
                pen.text(line, tx, labelFirst + li * LINE, { anchor: 'middle', max: half * 2 });
            });
        }
        return;
    }

    const { rows, height } = timelineVertical(spec);
    pen.arrow(TL_AXIS_X, 8, TL_AXIS_X, height - 8);

    /** Baseline of line `i` in a block of `n` lines centred on `mid`. */
    const baseline = (mid: number, n: number, i: number): number =>
        r2(mid - ((n - 1) * LINE) / 2 + 3.5 + i * LINE);

    for (const r of rows) {
        pen.circle(TL_AXIS_X, r.mid, 3.2, { fill: pen.ink });
        r.at.forEach((line, li) => {
            pen.text(line, TL_AXIS_X - 11, baseline(r.mid, r.at.length, li), {
                size: LABEL_SM, anchor: 'end', max: TL_AXIS_X - 14,
            });
        });
        r.label.forEach((line, li) => {
            pen.text(line, TL_AXIS_X + 11, baseline(r.mid, r.label.length, li), {
                max: W - TL_AXIS_X - 16,
            });
        });
    }
}

function flowchart(pen: Pen, spec: FlowchartSpec): void {
    const { boxH, gap } = flowLayout(spec);
    const boxW = FLOW_BOX_W;
    const cx = W / 2 - 26; // left of centre, leaving a lane on the right for No branches
    const yOf = (i: number): number => gap + i * (boxH + gap);
    const size = boxH < 34 ? LABEL_SM : LABEL;
    const lineH = boxH < 34 ? LINE_SM : LINE;

    spec.nodes.forEach((node, i) => {
        const y = yOf(i);
        const lines = wrapTwo(node.label, capacity(boxW - 24, size));
        const isDecision = node.type === 'decision';
        const isTerminal = node.type === 'start' || node.type === 'end';

        if (isDecision) {
            pen.path(
                `M ${cx} ${r2(y)} L ${r2(cx + boxW / 2)} ${r2(y + boxH / 2)}`
                + ` L ${cx} ${r2(y + boxH)} L ${r2(cx - boxW / 2)} ${r2(y + boxH / 2)} Z`,
            );
        } else if (node.type === 'io') {
            pen.path(
                `M ${r2(cx - boxW / 2 + 10)} ${r2(y)} L ${r2(cx + boxW / 2)} ${r2(y)}`
                + ` L ${r2(cx + boxW / 2 - 10)} ${r2(y + boxH)} L ${r2(cx - boxW / 2)} ${r2(y + boxH)} Z`,
            );
        } else if (isTerminal) {
            // A stadium: the terminal shape every textbook uses for start and stop.
            const rr = boxH / 2;
            pen.path(
                `M ${r2(cx - boxW / 2 + rr)} ${r2(y)} L ${r2(cx + boxW / 2 - rr)} ${r2(y)}`
                + ` A ${r2(rr)} ${r2(rr)} 0 0 1 ${r2(cx + boxW / 2 - rr)} ${r2(y + boxH)}`
                + ` L ${r2(cx - boxW / 2 + rr)} ${r2(y + boxH)}`
                + ` A ${r2(rr)} ${r2(rr)} 0 0 1 ${r2(cx - boxW / 2 + rr)} ${r2(y)} Z`,
            );
        } else {
            pen.rect(cx - boxW / 2, y, boxW, boxH);
        }

        lines.forEach((line, li) => {
            pen.text(
                line, cx,
                y + boxH / 2 + (lines.length === 1 ? size * 0.36 : li === 0 ? -2 : lineH - 2),
                { size, anchor: 'middle', max: isDecision ? boxW * 0.6 : boxW - 12 },
            );
        });

        // Fall-through to the next node. On a decision this is the Yes branch.
        if (spec.nodes[i + 1]) {
            pen.arrow(cx, y + boxH, cx, yOf(i + 1));
            if (isDecision) pen.text('Yes', cx + 5, y + boxH + 12, { size: LABEL_SM });
        }

        // The No branch: out to the right, then back to a node that exists. The validator
        // guarantees the target index is real, so this cannot point into nothing.
        if (isDecision && node.noTo !== undefined) {
            const ty = yOf(node.noTo) + boxH / 2;
            pen.path(
                `M ${r2(cx + boxW / 2)} ${r2(y + boxH / 2)} L ${W - 14} ${r2(y + boxH / 2)}`
                + ` L ${W - 14} ${r2(ty)} L ${r2(cx + boxW / 2)} ${r2(ty)}`,
            );
            pen.head(cx + boxW / 2, ty, -1, 0);
            pen.text('No', cx + boxW / 2 + 5, y + boxH / 2 - 5, { size: LABEL_SM });
        }
    });
}

function cycle(pen: Pen, spec: CycleSpec): void {
    const { stages, R, cy } = cycleLayout(spec);
    const CX = W / 2;
    const n = spec.stages.length;
    const step = (Math.PI * 2) / n;
    // Clear the markers at both ends so the arrowhead lands in open space.
    const gap = (CYCLE_NODE_R + 7) / R;

    // The arrows ARE the ring - including the one from the last stage back to the first, which is
    // the only thing this diagram says that a numbered list does not.
    stages.forEach((s) => {
        const from = polar(CX, cy, R, s.a + gap);
        const to = polar(CX, cy, R, s.a + step - gap);
        // Sweep 1 is clockwise on screen, which is the direction `ringAngles` walks.
        pen.path(`M ${from.x} ${from.y} A ${R} ${R} 0 0 1 ${to.x} ${to.y}`);
        // The tangent of a clockwise arc at its end point is perpendicular to the radius there.
        const a = s.a + step - gap;
        pen.head(to.x, to.y, -Math.sin(a), Math.cos(a));
    });

    stages.forEach((s, i) => {
        const p = polar(CX, cy, R, s.a);
        pen.circle(p.x, p.y, CYCLE_NODE_R, { fill: pen.ink, opacity: WASH, weight: STROKE_W });
        pen.text(String(i + 1), p.x, p.y + 3, { size: LABEL_SM, anchor: 'middle' });
        const room = s.anchor === 'start' ? W - 6 - s.qx : s.anchor === 'end' ? s.qx - 6 : W - 12;
        s.lines.forEach((line, li) => {
            pen.text(line, s.qx, r2(cy + s.first + li * LINE), {
                anchor: s.anchor, max: room,
            });
        });
    });
}

/** One item, one row: cut to the width of the region it has to sit inside. */
function rowsFor(items: string[] | undefined, cap: number): string[] {
    const list = items ?? [];
    if (list.length <= cap) return list;
    return [...list.slice(0, cap - 1), `+${list.length - cap + 1} more`];
}

/** A full circle as a path. */
function ringPath(cx: number, cy: number, r: number): string {
    return `M ${r2(cx - r)} ${r2(cy)} A ${r} ${r} 0 1 0 ${r2(cx + r)} ${r2(cy)}`
        + ` A ${r} ${r} 0 1 0 ${r2(cx - r)} ${r2(cy)}`;
}

const ROW = 11;

function venn(pen: Pen, spec: VennSpec): void {
    const layout = vennLayout(spec);
    const CX = W / 2;
    // The fill IS the overlap: one wash per circle, so where two overlap the density doubles and
    // where three overlap it trebles. Nothing is clipped or masked to achieve it, exactly as on
    // screen - and unlike a second colour, it survives a one-colour print.

    if (layout.kind === 'two') {
        const r = 82, offset = 48;
        const cy = layout.cy;
        const c: [number, number] = [CX - offset, CX + offset];

        for (const x of c) {
            pen.circle(x, cy, r, { fill: pen.ink, opacity: WASH });
            pen.path(ringPath(x, cy, r));
        }

        layout.labels.forEach((lines, i) => {
            lines.forEach((line, li) => {
                pen.text(line, c[i] ?? CX, r2(cy - r - 9 - (lines.length - 1 - li) * LINE), {
                    anchor: 'middle', max: 120,
                });
            });
        });

        // At `dy` from the centre line each circle is 2*hw wide, which fixes the three regions.
        // Every row is measured, so nothing leaves its region.
        const span = (dy: number, which: 0 | 1 | 2): { mid: number; width: number } => {
            const hw = Math.sqrt(Math.max(r * r - dy * dy, 1));
            const lo = which === 0 ? c[0] - hw : which === 1 ? c[0] + hw : c[1] - hw;
            const hi = which === 0 ? c[1] - hw : which === 1 ? c[1] + hw : c[0] + hw;
            return { mid: r2((lo + hi) / 2), width: hi - lo - 10 };
        };

        const regions: Array<{ items: string[]; which: 0 | 1 | 2 }> = [
            { items: rowsFor(spec.sets[0]?.items, 6), which: 0 },
            { items: rowsFor(spec.sets[1]?.items, 6), which: 1 },
            { items: rowsFor(spec.intersection, 6), which: 2 },
        ];
        for (const region of regions) {
            region.items.forEach((item, j) => {
                const dy = (j - (region.items.length - 1) / 2) * ROW;
                const at = span(dy, region.which);
                pen.text(item, at.mid, r2(cy + dy + 3), {
                    size: LABEL_SM, anchor: 'middle', max: at.width,
                });
            });
        }
        return;
    }

    // Three sets use the standard symmetric arrangement, so the only regions the spec can address
    // are the three "only" lobes and the centre where all three meet - which is what `VennSpec`
    // carries.
    const r = 66, dd = 40;
    const cy = layout.cy;
    const angles = ringAngles(3);
    const centres = angles.map((a) => polar(CX, cy, dd, a));

    for (const p of centres) {
        pen.circle(p.x, p.y, r, { fill: pen.ink, opacity: WASH });
        pen.path(ringPath(p.x, p.y, r));
    }

    layout.labels.forEach((lines, i) => {
        lines.forEach((line, li) => {
            pen.text(
                line,
                i === 0 ? CX : i === 1 ? CX + 26 : CX - 26,
                r2(i === 0 ? cy - 112 - (lines.length - 1 - li) * LINE : cy + 100 + li * LINE),
                { anchor: i === 0 ? 'middle' : i === 1 ? 'start' : 'end', max: 140 },
            );
        });
    });

    angles.forEach((a, i) => {
        // Widths that stay inside a lobe at every row it can occupy, worked out from the circle
        // geometry rather than by eye - the lobes are much narrower than they look.
        const p = polar(CX, cy, dd + r * 0.45, a);
        const width = i === 0 ? 84 : 62;
        const items = rowsFor(spec.sets[i]?.items, 4);
        items.forEach((item, j) => {
            pen.text(item, p.x, r2(p.y + (j - (items.length - 1) / 2) * ROW + 3), {
                size: LABEL_SM, anchor: 'middle', max: width,
            });
        });
    });

    const centre = rowsFor(spec.intersection, 4);
    centre.forEach((item, j) => {
        pen.text(item, CX, r2(cy + (j - (centre.length - 1) / 2) * ROW + 3), {
            size: LABEL_SM, anchor: 'middle', max: 48,
        });
    });
}

// ─── The entry point ────────────────────────────────────────────────────────────

/**
 * Draw `spec` into a box `DIAGRAM_WIDTH` wide and `diagramHeightFor(spec)` tall, with its
 * bottom-left corner at `(ctx.x, ctx.y)`.
 *
 * Returns nothing, and draws nothing at all for a spec `isDrawableDiagram` refuses - the same
 * answer `<Diagram>` gives on screen, and for the same reason: a caller then prints the caption or
 * the surrounding text, which is a smaller loss than a confidently wrong picture handed to thirty
 * children. Validate with `isDrawableDiagram` and `diagramHeightFor` BEFORE reserving the space,
 * and the refusal costs nothing at all.
 */

// ─── The seven kinds added on 2026-09-06 ────────────────────────────────────────
// Same geometry as the screen components in packages/ui/src/diagrams, so a figure prints as it
// was shown. Each is described in the screen file; here only the print translation.

const LP_BOX = { x: 14, y: 22, w: 170, h: 150 };

function silhouettePath(shape: LabelledPartsSpec['shape']): string {
    const { x, y, w, h } = LP_BOX;
    const cx = x + w / 2, cy = y + h / 2;
    switch (shape) {
        case 'circle': { const r = Math.min(w, h) / 2 - 4; return `M ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy}`; }
        case 'ellipse': { const rx = w / 2 - 4, ry = h / 2 - 12; return `M ${cx - rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx - rx} ${cy}`; }
        case 'rectangle': return `M ${x + 6} ${y + 10} H ${x + w - 6} V ${y + h - 10} H ${x + 6} Z`;
        case 'cell': return `M ${x + 10} ${y + 24} Q ${x + 8} ${y + 6} ${x + 40} ${y + 8} Q ${cx} ${y + 2} ${x + w - 30} ${y + 10} Q ${x + w - 4} ${y + 20} ${x + w - 8} ${cy} Q ${x + w - 6} ${y + h - 14} ${x + w - 40} ${y + h - 6} Q ${cx} ${y + h} ${x + 30} ${y + h - 10} Q ${x + 6} ${y + h - 20} ${x + 10} ${y + 24} Z`;
        case 'leaf': return `M ${x + 8} ${y + h - 8} Q ${x + 20} ${y + 20} ${x + w - 10} ${y + 10} Q ${x + w - 20} ${y + h - 20} ${x + 8} ${y + h - 8} Z M ${x + 8} ${y + h - 8} L ${x + w - 10} ${y + 10}`;
        case 'flask': return `M ${cx - 16} ${y + 8} H ${cx + 16} V ${y + 46} L ${x + w - 20} ${y + h - 12} Q ${x + w - 18} ${y + h - 4} ${x + w - 28} ${y + h - 4} H ${x + 28} Q ${x + 18} ${y + h - 4} ${x + 20} ${y + h - 12} L ${cx - 16} ${y + 46} Z`;
    }
}

function labelledParts(pen: Pen, spec: LabelledPartsSpec): void {
    if (spec.title) pen.text(spec.title, LP_BOX.x, 14, { max: W - 28 });
    const d = silhouettePath(spec.shape);
    pen.path(d, { fill: pen.ink, opacity: WASH, weight: 0 });
    pen.path(d);
    const listTop = LP_BOX.y + 8;
    spec.parts.forEach((p, i) => {
        const px = r2(LP_BOX.x + p.x * LP_BOX.w), py = r2(LP_BOX.y + p.y * LP_BOX.h);
        const ly = listTop + i * 16;
        pen.line(px, py, 200 - 8, ly - 4, { weight: HAIR_W, opacity: 0.6 });
        pen.circle(px, py, 5, { fill: pen.ink, weight: 0 });
        pen.text(`${i + 1}. ${p.label}`, 200, ly, { size: LABEL_SM, max: W - 206 });
    });
}

function barChart(pen: Pen, spec: BarChartSpec): void {
    const LEFT = 30, RIGHT = 12, TOP = 18, BASE = 190 - 34;
    const max = spec.bars.reduce((m, b) => Math.max(m, b.value), 0) || 1;
    const y = scale([0, max], [BASE, TOP]);
    const n = spec.bars.length;
    const slot = (W - LEFT - RIGHT) / n;
    const barW = Math.min(44, slot * 0.62);
    pen.line(LEFT, TOP - 6, LEFT, BASE);
    pen.line(LEFT, BASE, W - RIGHT, BASE);
    pen.text('0', LEFT - 4, BASE + 3, { size: LABEL_SM, anchor: 'end' });
    pen.text(String(round(max, 2)), LEFT - 4, TOP + 3, { size: LABEL_SM, anchor: 'end' });
    spec.bars.forEach((b, i) => {
        const x = r2(LEFT + slot * i + (slot - barW) / 2);
        const top = r2(y(b.value));
        pen.rect(x, top, barW, BASE - top, { fill: pen.ink, opacity: WASH, weight: 0 });
        pen.rect(x, top, barW, BASE - top);
        pen.text(`${round(b.value, 2)}${spec.unit ? ` ${spec.unit}` : ''}`, x + barW / 2, top - 4, { size: LABEL_SM, anchor: 'middle', max: slot });
        pen.text(b.label, x + barW / 2, BASE + 13, { anchor: 'middle', max: slot - 4 });
    });
}

function pieChart(pen: Pen, spec: PieChartSpec): void {
    const CX = 105, CY = 95, R = 70;
    const angles = pieAngles(spec.slices.map((s) => s.value));
    const opacities = [0.32, 0.12, 0.22, 0.06, 0.28, 0.16];
    spec.slices.forEach((s, i) => {
        const { start, end, share } = angles[i]!;
        const a = polar(CX, CY, R, start), b = polar(CX, CY, R, end);
        const large = end - start > Math.PI ? 1 : 0;
        const d = share >= 0.999
            ? `M ${CX - R} ${CY} A ${R} ${R} 0 1 0 ${CX + R} ${CY} A ${R} ${R} 0 1 0 ${CX - R} ${CY}`
            : `M ${CX} ${CY} L ${r2(a.x)} ${r2(a.y)} A ${R} ${R} 0 ${large} 1 ${r2(b.x)} ${r2(b.y)} Z`;
        pen.path(d, { fill: pen.ink, opacity: opacities[i % opacities.length], weight: 0 });
        pen.path(d);
        if (share >= 0.06) {
            const mid = polar(CX, CY, R * 0.62, (start + end) / 2);
            pen.text(`${Math.round(share * 100)}%`, r2(mid.x), r2(mid.y + 3), { size: LABEL_SM, anchor: 'middle' });
        }
        const ky = 40 + i * 20;
        pen.rect(196, ky - 8, 10, 10, { fill: pen.ink, opacity: opacities[i % opacities.length], weight: 0 });
        pen.rect(196, ky - 8, 10, 10);
        pen.text(`${s.label} (${round(s.value, 2)})`, 212, ky, { size: LABEL_SM, max: W - 218 });
    });
}

function coordinateGrid(pen: Pen, spec: CoordinateGridSpec): void {
    const PAD = 22;
    const [x0, x1] = spec.xRange, [y0, y1] = spec.yRange;
    const span = Math.max(x1 - x0, y1 - y0);
    const unit = Math.min(W - 2 * PAD, 220 - 2 * PAD) / span;
    const gx = scale([x0, x1], [PAD, PAD + (x1 - x0) * unit]);
    const gy = scale([y0, y1], [PAD + (y1 - y0) * unit, PAD]);
    const labelEvery = span > 10 ? 2 : 1;
    for (let x = x0; x <= x1; x += 1) pen.line(r2(gx(x)), gy(y1), r2(gx(x)), gy(y0), { weight: 0.35, opacity: 0.3 });
    for (let y = y0; y <= y1; y += 1) pen.line(gx(x0), r2(gy(y)), gx(x1), r2(gy(y)), { weight: 0.35, opacity: 0.3 });
    const axisY = y0 <= 0 && y1 >= 0 ? gy(0) : gy(y0);
    const axisX = x0 <= 0 && x1 >= 0 ? gx(0) : gx(x0);
    pen.line(gx(x0), r2(axisY), gx(x1), r2(axisY));
    pen.line(r2(axisX), gy(y1), r2(axisX), gy(y0));
    for (let x = x0; x <= x1; x += 1) if (x % labelEvery === 0 && x !== 0) pen.text(String(x), r2(gx(x)), r2(axisY + 11), { size: LABEL_SM, anchor: 'middle' });
    for (let y = y0; y <= y1; y += 1) if (y % labelEvery === 0 && y !== 0) pen.text(String(y), r2(axisX - 4), r2(gy(y) + 3), { size: LABEL_SM, anchor: 'end' });
    const pts = spec.points ?? [];
    if (spec.connect && pts.length > 1) {
        pen.path(pts.map((p, i) => `${i ? 'L' : 'M'} ${r2(gx(p.x))} ${r2(gy(p.y))}`).join(' ') + (pts.length > 2 ? ' Z' : ''), { weight: EMPHASIS_W });
    }
    pts.forEach((p) => {
        pen.circle(r2(gx(p.x)), r2(gy(p.y)), 3.2, { fill: pen.ink, weight: 0 });
        pen.text(p.label ?? `(${p.x}, ${p.y})`, r2(gx(p.x) + 5), r2(gy(p.y) - 5), { size: LABEL_SM });
    });
}

function clockFace(pen: Pen, spec: ClockFaceSpec): void {
    const CX = 160, CY = 92, R = 74;
    pen.circle(CX, CY, R);
    for (let i = 0; i < 60; i += 1) {
        const a = -Math.PI / 2 + (i / 60) * Math.PI * 2;
        const major = i % 5 === 0;
        const o = polar(CX, CY, R - 1, a), n = polar(CX, CY, R - (major ? 8 : 4), a);
        pen.line(r2(o.x), r2(o.y), r2(n.x), r2(n.y), { weight: major ? 1.2 : 0.5 });
    }
    for (let i = 0; i < 12; i += 1) {
        const p = polar(CX, CY, R - 18, -Math.PI / 2 + ((i + 1) / 12) * Math.PI * 2);
        pen.text(String(i + 1), r2(p.x), r2(p.y + 3.5), { anchor: 'middle' });
    }
    const minuteAngle = -Math.PI / 2 + (spec.minute / 60) * Math.PI * 2;
    const hourAngle = -Math.PI / 2 + (((spec.hour % 12) + spec.minute / 60) / 12) * Math.PI * 2;
    const mh = polar(CX, CY, R * 0.82, minuteAngle), hh = polar(CX, CY, R * 0.55, hourAngle);
    pen.line(CX, CY, r2(hh.x), r2(hh.y), { weight: 3 });
    pen.line(CX, CY, r2(mh.x), r2(mh.y), { weight: 1.8 });
    pen.circle(CX, CY, 3, { fill: pen.ink, weight: 0 });
    if (spec.showDigital) pen.text(`${spec.hour}:${String(spec.minute).padStart(2, '0')}`, CX, CY + R + 22, { size: LABEL_SM, anchor: 'middle' });
}

function placeValue(pen: Pen, spec: PlaceValueSpec): void {
    const base = placeValueBase(spec);
    const cols = placeValueColumns(spec.number, base);
    const n = cols.length;
    const colW = Math.min(48, (W - 28) / n);
    const left = r2((W - colW * n) / 2);
    const TOP = 22, HEAD = 22, CELL = 36;
    cols.forEach((c, i) => {
        const x = r2(left + i * colW);
        pen.rect(x, TOP, colW, HEAD, { fill: pen.ink, opacity: WASH, weight: 0 });
        pen.rect(x, TOP, colW, HEAD);
        pen.rect(x, TOP + HEAD, colW, CELL);
        pen.text(base === 10 && c.value >= 1000 ? c.value.toLocaleString('en-IN') : c.name, x + colW / 2, TOP + 14, { size: 7, anchor: 'middle', max: colW - 4 });
        pen.text(String(c.digit), x + colW / 2, TOP + HEAD + 24, { size: 16, anchor: 'middle' });
    });
    const total = cols.reduce((t, c) => t + c.digit * c.value, 0);
    pen.text(`${cols.map((c) => `${c.digit}x${c.value}`).join(' + ')} = ${total}`, W / 2, TOP + HEAD + CELL + 20, { size: LABEL_SM, anchor: 'middle', max: W - 20 });
    pen.text(base === 2 ? `${spec.number.toString(2)} in binary is ${spec.number}` : spec.number.toLocaleString('en-IN'), W / 2, TOP + HEAD + CELL + 36, { anchor: 'middle', max: W - 20 });
}

/** The ladder, computed row by row; the answer read upwards. Same layout as the screen. */
function divisionLadder(pen: Pen, spec: DivisionLadderSpec): void {
    const rows = divisionLadderRows(spec.number, spec.base);
    const ROW = 22, TOP = 18, LEFT = 70, baseW = 34, numW = 84, remW = 60;
    const digits = rows.map((r) => baseDigit(r.remainder)).reverse().join('');
    pen.text(`divide by ${spec.base}`, LEFT + baseW + numW / 2, 12, { size: LABEL_SM, anchor: 'middle' });
    pen.text('remainder', LEFT + baseW + numW + 14 + remW / 2, 12, { size: LABEL_SM, anchor: 'middle' });
    rows.forEach((r, i) => {
        const y = TOP + i * ROW;
        pen.rect(LEFT, y, baseW, ROW, { fill: pen.ink, opacity: WASH, weight: 0 });
        pen.rect(LEFT, y, baseW, ROW);
        pen.text(String(spec.base), LEFT + baseW / 2, y + 15, { anchor: 'middle' });
        pen.rect(LEFT + baseW, y, numW, ROW);
        pen.text(String(r.dividend), LEFT + baseW + numW / 2, y + 15, { size: 11, anchor: 'middle' });
        pen.text(`${r.remainder}${r.remainder >= 10 ? ` (${baseDigit(r.remainder)})` : ''}`, LEFT + baseW + numW + 14 + remW / 2, y + 15, { size: 11, anchor: 'middle' });
    });
    const yEnd = TOP + rows.length * ROW;
    pen.rect(LEFT + baseW, yEnd, numW, ROW);
    pen.text('0', LEFT + baseW + numW / 2, yEnd + 15, { anchor: 'middle' });
    const ax = LEFT + baseW + numW + 14 + remW + 8;
    pen.line(ax, yEnd - 4, ax, TOP + 6);
    pen.path(`M ${ax} ${TOP} L ${ax - 4} ${TOP + 8} L ${ax + 4} ${TOP + 8} Z`, { fill: pen.ink });
    pen.text(`${spec.number} = ${digits} in base ${spec.base}`, W / 2, yEnd + ROW + 24, { anchor: 'middle', max: W - 20 });
    pen.text('read the remainders from the bottom up', W / 2, yEnd + ROW + 38, { size: LABEL_SM, anchor: 'middle', max: W - 20 });
}

/** An ellipse as four cubic arcs, since the pen draws paths, lines, rectangles and circles only. */
function ellipsePath(cx: number, cy: number, rx: number, ry: number): string {
    const k = 0.5523;
    const ox = r2(rx * k), oy = r2(ry * k);
    return `M ${r2(cx - rx)} ${cy} C ${r2(cx - rx)} ${r2(cy - oy)} ${r2(cx - ox)} ${r2(cy - ry)} ${cx} ${r2(cy - ry)} C ${r2(cx + ox)} ${r2(cy - ry)} ${r2(cx + rx)} ${r2(cy - oy)} ${r2(cx + rx)} ${cy} C ${r2(cx + rx)} ${r2(cy + oy)} ${r2(cx + ox)} ${r2(cy + ry)} ${cx} ${r2(cy + ry)} C ${r2(cx - ox)} ${r2(cy + ry)} ${r2(cx - rx)} ${r2(cy + oy)} ${r2(cx - rx)} ${cy} Z`;
}

/** Rings inside rings, outermost drawn first; labels on the upper edge, members in the band. */
function nestedSets(pen: Pen, spec: NestedSetsSpec): void {
    const n = spec.rings.length;
    const cx = W / 2, cy = 230 / 2 + 6, outer = 96, step = outer / n;
    for (let i = n - 1; i >= 0; i -= 1) {
        const r = spec.rings[i]!;
        const rad = r2(step * (i + 1)), ry = r2(rad * 0.78);
        pen.path(ellipsePath(cx, cy, rad, ry), { fill: pen.ink, opacity: 0.05, weight: 0 });
        pen.path(ellipsePath(cx, cy, rad, ry));
        pen.text(r.label, cx, cy - ry + 13, { anchor: 'middle', max: rad * 1.6 });
        if (r.items?.length) {
            const innerTop = i > 0 ? cy - r2(step * i * 0.78) : cy;
            const y = i === 0 ? cy + 4 : r2((cy - ry + innerTop) / 2 + 14);
            pen.text(r.items.join('   '), cx, y, { size: LABEL_SM, anchor: 'middle', max: rad * 1.7 });
        }
    }
}

function tableDiagram(pen: Pen, spec: TableSpec): void {
    const PAD = 10, ROW = 20, HEAD = 22;
    const n = spec.columns.length;
    const colW = (W - 2 * PAD) / n;
    const bodyH = HEAD + spec.rows.length * ROW;
    pen.rect(PAD, PAD, W - 2 * PAD, HEAD, { fill: pen.ink, opacity: WASH, weight: 0 });
    if (spec.highlightRow !== undefined) pen.rect(PAD, PAD + HEAD + spec.highlightRow * ROW, W - 2 * PAD, ROW, { fill: pen.ink, opacity: 0.08, weight: 0 });
    pen.rect(PAD, PAD, W - 2 * PAD, bodyH);
    pen.line(PAD, PAD + HEAD, W - PAD, PAD + HEAD);
    for (let i = 1; i < n; i += 1) pen.line(r2(PAD + colW * i), PAD, r2(PAD + colW * i), PAD + bodyH, { weight: HAIR_W });
    spec.columns.forEach((c, i) => pen.text(c, r2(PAD + colW * i + colW / 2), PAD + 15, { anchor: 'middle', max: colW - 8 }));
    spec.rows.forEach((r, ri) => r.forEach((cell, ci) => {
        pen.text(cell, r2(PAD + colW * ci + colW / 2), PAD + HEAD + ri * ROW + 14, { size: LABEL_SM, anchor: 'middle', max: colW - 8 });
    }));
}

export function drawDiagram(ctx: DrawCtx, spec: DiagramSpec): void {
    if (!isDrawableDiagram(spec)) return;

    const body = bodyHeight(spec);
    const pen = new Pen(ctx, body + (spec.caption ? CAPTION_ROOM : 0));

    switch (spec.kind) {
        case 'numberLine': numberLine(pen, spec); break;
        case 'fractionBar': fractionBar(pen, spec); break;
        case 'array': arrayDiagram(pen, spec); break;
        case 'barModel': barModel(pen, spec); break;
        case 'plot': plot(pen, spec); break;
        case 'angle': angle(pen, spec); break;
        case 'polygon': polygon(pen, spec); break;
        case 'forces': forces(pen, spec); break;
        case 'projectile': projectile(pen, spec); break;
        case 'rayDiagram': rayDiagram(pen, spec); break;
        case 'circuit': circuit(pen, spec); break;
        case 'timeline': timeline(pen, spec); break;
        case 'flowchart': flowchart(pen, spec); break;
        case 'cycle': cycle(pen, spec); break;
        case 'venn': venn(pen, spec); break;
        case 'labelledParts': labelledParts(pen, spec); break;
        case 'barChart': barChart(pen, spec); break;
        case 'pieChart': pieChart(pen, spec); break;
        case 'coordinateGrid': coordinateGrid(pen, spec); break;
        case 'clockFace': clockFace(pen, spec); break;
        case 'placeValue': placeValue(pen, spec); break;
        case 'divisionLadder': divisionLadder(pen, spec); break;
        case 'nestedSets': nestedSets(pen, spec); break;
        case 'table': tableDiagram(pen, spec); break;
    }

    if (spec.caption) {
        pen.text(spec.caption, W / 2, body + 10, {
            size: LABEL_SM, anchor: 'middle', max: W - 16,
        });
    }
}
