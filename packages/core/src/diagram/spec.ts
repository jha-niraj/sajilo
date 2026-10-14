/**
 * Teaching diagrams - the SPEC, shared by every renderer.
 *
 * ## Why this is in `@repo/core` and not beside the React component
 *
 * A lesson plan is printed (`packages/pdf/src/lesson-plan.ts`), so a diagram needs a screen
 * renderer and, eventually, a `pdf-lib` one. `QuestionFigure` solved that by copy-pasting its
 * `FigureSpec` and validator into both packages, which works only for as long as somebody
 * remembers to edit both. Here the spec, the validator and the shared geometry live in one place
 * with no React and no pdf-lib, and each renderer imports them.
 *
 * ## Why a spec at all
 *
 * These diagrams are produced by an AI writing a lesson plan. A model cannot draw - asked for raw
 * path data it returns a blob, every time, because it has no eyes - but it CAN specify. So the
 * model emits `{ kind: 'projectile', height: 12 }` and a human-written component draws it. A wrong
 * spec is visible and checkable. Wrong path data is not.
 *
 * ## The validator is the contract with the model
 *
 * `isDrawableDiagram` refuses rather than guesses, exactly like `isDrawableFigure`. Every list is
 * CAPPED and every number range-checked, because the producer is a language model and an uncapped
 * timeline of four hundred events renders as a smear off the side of the canvas. A refused diagram
 * costs a paragraph of text; a silently broken one is printed and handed to thirty children.
 */

/** Anything a caller may attach to any diagram. */
interface DiagramBase {
	/** Shown under the figure. Also the fallback when a renderer cannot draw. */
	caption?: string;
}

// ─── Maths ──────────────────────────────────────────────────────────────────────

/** A mark on the line: a labelled point, or a jump from one value to another. */
export interface NumberLineMark {
	at: number;
	label?: string;
	/** Draw an arc from `at` to here - how "8 + 5" is taught before it is written. */
	jumpTo?: number;
}

export interface NumberLineSpec extends DiagramBase {
	kind: 'numberLine';
	from: number;
	to: number;
	/** Spacing between ticks. Must divide the range into at most `MAX_TICKS` steps. */
	step?: number;
	marks?: NumberLineMark[];
}

export interface FractionBarSpec extends DiagramBase {
	kind: 'fractionBar';
	/** One bar, or two stacked for a comparison such as 1/2 against 2/4. */
	bars: Array<{ parts: number; shaded: number; label?: string }>;
}

export interface ArraySpec extends DiagramBase {
	kind: 'array';
	rows: number;
	cols: number;
	/** `dots` for repeated addition, `squares` for area. */
	style?: 'dots' | 'squares';
	/** Ring the first N, for grouping. */
	highlight?: number;
}

export interface BarModelSpec extends DiagramBase {
	kind: 'barModel';
	/** Singapore-style bars. `value` sets the length; `label` names the quantity. */
	bars: Array<{ label: string; value: number; brace?: string }>;
	/** A brace across every bar, e.g. the total in a part-whole problem. */
	total?: string;
}

export interface PlotSpec extends DiagramBase {
	kind: 'plot';
	/** `y = mx + c`, or `y = ax^2 + bx + c` when `a` is given. */
	fn: { a?: number; m?: number; c?: number };
	xRange?: [number, number];
	yRange?: [number, number];
	points?: Array<{ x: number; y: number; label?: string }>;
}

// ─── Geometry ───────────────────────────────────────────────────────────────────

export interface AngleSpec extends DiagramBase {
	kind: 'angle';
	degrees: number;
	label?: string;
	/** Name the two rays, e.g. "AB" and "AC". */
	rays?: [string, string];
}

export interface PolygonSpec extends DiagramBase {
	kind: 'polygon';
	/** Vertices in order, as fractions of the canvas (0..1). Three to six of them. */
	points: Array<{ x: number; y: number; label?: string }>;
	/** Side labels, in the same order as the edges leaving each point. */
	sides?: string[];
	/** Mark a right angle at this vertex index. */
	rightAngleAt?: number;
}

// ─── Science ────────────────────────────────────────────────────────────────────

export interface ForcesSpec extends DiagramBase {
	kind: 'forces';
	/** What the arrows act on. */
	body?: string;
	arrows: Array<{
		direction: 'up' | 'down' | 'left' | 'right';
		label: string;
		/** Relative arrow length, 0..1. Equal magnitudes must draw equal. */
		magnitude?: number;
	}>;
}

export interface ProjectileSpec extends DiagramBase {
	kind: 'projectile';
	/** Straight down (the apple) or an arc (a thrown ball). */
	mode?: 'drop' | 'throw';
	/** Drop height, in whatever `unit` says. Sets the label, never the pixels. */
	height?: number;
	unit?: string;
	/** Label the falling thing - "apple", "ball", "stone". */
	object?: string;
	/** Draw the weight vector and, for a throw, the velocity components. */
	showVectors?: boolean;
	/** Draw a head under it. The one concession to the Newton story. */
	target?: 'ground' | 'head';
}

export interface RayDiagramSpec extends DiagramBase {
	kind: 'rayDiagram';
	element: 'convexLens' | 'concaveLens' | 'concaveMirror' | 'convexMirror';
	/** Object distance and height, as multiples of the focal length. */
	objectDistance: number;
	objectHeight?: number;
}

export interface CircuitSpec extends DiagramBase {
	kind: 'circuit';
	arrangement?: 'series' | 'parallel';
	components: Array<{
		type: 'battery' | 'bulb' | 'resistor' | 'switch' | 'ammeter' | 'voltmeter';
		label?: string;
	}>;
}

// ─── General and computing ──────────────────────────────────────────────────────

export interface TimelineSpec extends DiagramBase {
	kind: 'timeline';
	events: Array<{ at: string; label: string }>;
	/** Vertical suits long labels; horizontal suits few, short ones. */
	orientation?: 'horizontal' | 'vertical';
}

export interface FlowchartSpec extends DiagramBase {
	kind: 'flowchart';
	nodes: Array<{
		type: 'start' | 'end' | 'process' | 'decision' | 'io';
		label: string;
		/** For a decision: where the No branch rejoins, as a node index. Yes falls through. */
		noTo?: number;
	}>;
}

export interface CycleSpec extends DiagramBase {
	kind: 'cycle';
	/** Three to six stages around a ring - the water cycle, a life cycle, an algorithm loop. */
	stages: string[];
}

export interface VennSpec extends DiagramBase {
	kind: 'venn';
	sets: Array<{ label: string; items?: string[] }>;
	/** What sits in the overlap. */
	intersection?: string[];
}

// ─── The seven added for "Nothing Left to Fill In" (2026-09-06) ─────────────────
//
// Chosen from where the CDC syllabus reaches and the first fifteen did not. Each is still a
// parametric FAMILY drawn by code from a few numbers - the model specifies, never draws.

/** A silhouette with numbered parts and their names: a cell, a flower, a flask, a leaf. */
export interface LabelledPartsSpec extends DiagramBase {
	kind: 'labelledParts';
	shape: 'circle' | 'ellipse' | 'rectangle' | 'leaf' | 'flask' | 'cell';
	/** What the whole thing is - "Plant cell". */
	title?: string;
	/** Each part sits at (x, y) as fractions of the silhouette's box and is named in a numbered list. */
	parts: Array<{ label: string; x: number; y: number }>;
}

export interface BarChartSpec extends DiagramBase {
	kind: 'barChart';
	bars: Array<{ label: string; value: number }>;
	/** Printed after each value - "kg", "students". */
	unit?: string;
}

export interface PieChartSpec extends DiagramBase {
	kind: 'pieChart';
	/** Two to six slices. Values are in any unit; the chart shows their share. */
	slices: Array<{ label: string; value: number }>;
}

export interface CoordinateGridSpec extends DiagramBase {
	kind: 'coordinateGrid';
	/** Integer ranges, at most `LIMITS.gridSpan` units across. */
	xRange: [number, number];
	yRange: [number, number];
	points?: Array<{ x: number; y: number; label?: string }>;
	/** Join the points in order - a shape, a translation, a line through two points. */
	connect?: boolean;
}

export interface ClockFaceSpec extends DiagramBase {
	kind: 'clockFace';
	hour: number;
	minute: number;
	/** Print the time in digits under the face. */
	showDigital?: boolean;
}

/** A whole number in its place-value columns - base ten, or base two for binary. */
export interface PlaceValueSpec extends DiagramBase {
	kind: 'placeValue';
	number: number;
	/** The editor's choice control writes strings, so both spellings are accepted; use `placeValueBase`. */
	base?: 10 | 2 | '10' | '2';
}

export function placeValueBase(spec: { base?: 10 | 2 | '10' | '2' }): 10 | 2 {
	return spec.base === 2 || spec.base === '2' ? 2 : 10;
}

/**
 * Repeated division with remainders, the ladder every base conversion is taught with. The rows
 * are COMPUTED from the number and the base, so the picture of 46 in base 2 cannot say anything
 * but 23 r0, 11 r1, 5 r1, 2 r1, 1 r0, 0 r1 and the answer read upwards.
 */
export interface DivisionLadderSpec extends DiagramBase {
	kind: 'divisionLadder';
	number: number;
	/** 2 for binary, 8 for octal, 16 for hexadecimal; any 2 to 16. */
	base: number;
}

/** Sets inside sets: natural numbers inside integers inside rationals. Innermost first. */
export interface NestedSetsSpec extends DiagramBase {
	kind: 'nestedSets';
	/** From the innermost to the outermost, 2 to 4 rings. Each with a label and up to 4 example members. */
	rings: Array<{ label: string; items?: string[] }>;
}

export interface TableSpec extends DiagramBase {
	kind: 'table';
	columns: string[];
	rows: string[][];
	/** Index of a row to draw emphasised. */
	highlightRow?: number;
}

export type DiagramSpec =
	| NumberLineSpec | FractionBarSpec | ArraySpec | BarModelSpec | PlotSpec
	| AngleSpec | PolygonSpec
	| ForcesSpec | ProjectileSpec | RayDiagramSpec | CircuitSpec
	| TimelineSpec | FlowchartSpec | CycleSpec | VennSpec
	| LabelledPartsSpec | BarChartSpec | PieChartSpec | CoordinateGridSpec | ClockFaceSpec | PlaceValueSpec | TableSpec
	| DivisionLadderSpec | NestedSetsSpec;

export type DiagramKind = DiagramSpec['kind'];

/** Every kind, for a picker or a prompt. Exhaustive by construction - see the test. */
export const DIAGRAM_KINDS = [
	'numberLine', 'fractionBar', 'array', 'barModel', 'plot',
	'angle', 'polygon',
	'forces', 'projectile', 'rayDiagram', 'circuit',
	'timeline', 'flowchart', 'cycle', 'venn',
	'labelledParts', 'barChart', 'pieChart', 'coordinateGrid', 'clockFace', 'placeValue', 'table',
	'divisionLadder', 'nestedSets',
] as const;

// ─── Limits ─────────────────────────────────────────────────────────────────────
//
// Not defensive programming. The producer is a language model, and every one of these
// is a shape it will eventually ask for: a number line from 0 to 1000000, a flowchart
// of forty nodes, a fraction in ninety-seconds. Refusing is the honest answer, because
// the alternative renders and is unreadable, and nobody checks a picture that appeared.

export const LIMITS = {
	ticks: 40,
	marks: 12,
	bars: 4,
	arrayCells: 144,
	arraySide: 20,
	points: 8,
	polygonPoints: 6,
	arrows: 6,
	components: 8,
	events: 12,
	nodes: 14,
	stages: 6,
	sets: 3,
	items: 6,
	labelChars: 80,
	parts: 8,
	chartBars: 8,
	slices: 6,
	gridSpan: 20,
	tableCols: 5,
	tableRows: 8,
	placeValueMax: 999_999_999,
	ladderMax: 1_000_000,
	ladderRows: 20,
	rings: 4,
	ringItems: 4,
} as const;

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isPos = (v: unknown): v is number => isNum(v) && v > 0;
const isStr = (v: unknown): v is string =>
	typeof v === 'string' && v.trim().length > 0 && v.length <= LIMITS.labelChars;
const optStr = (v: unknown): boolean => v === undefined || isStr(v);
const optNum = (v: unknown): boolean => v === undefined || isNum(v);
const arr = (v: unknown, max: number): v is unknown[] =>
	Array.isArray(v) && v.length > 0 && v.length <= max;

function rec(v: unknown): Record<string, unknown> | null {
	return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/**
 * True when this value is a diagram every renderer can draw.
 *
 * Same rule as `isDrawableFigure`: an unknown kind, a missing dimension or a number out of range
 * means NO diagram, never a guessed one. A caller renders the caption or the surrounding text
 * instead, which is a smaller loss than a confidently wrong picture.
 */
export function isDrawableDiagram(value: unknown): value is DiagramSpec {
	const s = rec(value);
	if (!s || !optStr(s.caption)) return false;

	switch (s.kind) {
		case 'numberLine': {
			if (!isNum(s.from) || !isNum(s.to) || s.from >= s.to) return false;
			if (s.step !== undefined && !isPos(s.step)) return false;
			const step = (s.step as number | undefined) ?? 1;
			if ((s.to - s.from) / step > LIMITS.ticks) return false;
			if (s.marks !== undefined) {
				if (!arr(s.marks, LIMITS.marks)) return false;
				if (!s.marks.every((m) => {
					const k = rec(m);
					return !!k && isNum(k.at) && optStr(k.label) && optNum(k.jumpTo);
				})) return false;
			}
			return true;
		}
		case 'fractionBar':
			return arr(s.bars, LIMITS.bars) && s.bars.every((b) => {
				const k = rec(b);
				return !!k && isPos(k.parts) && (k.parts as number) <= 24
					&& isNum(k.shaded) && (k.shaded as number) >= 0
					&& (k.shaded as number) <= (k.parts as number) && optStr(k.label);
			});
		case 'array':
			return isPos(s.rows) && isPos(s.cols)
				&& (s.rows as number) <= LIMITS.arraySide && (s.cols as number) <= LIMITS.arraySide
				&& (s.rows as number) * (s.cols as number) <= LIMITS.arrayCells
				&& (s.style === undefined || s.style === 'dots' || s.style === 'squares')
				// A highlight past the last cell is a group that cannot be drawn. Refusing beats
				// clamping: the renderer would silently ring the whole array and the caller would
				// never learn that "the first 30 of 12" was not a thing it could ask for.
				&& (s.highlight === undefined
					|| (isNum(s.highlight) && (s.highlight as number) >= 0
						&& (s.highlight as number) <= (s.rows as number) * (s.cols as number)));
		case 'barModel':
			return arr(s.bars, LIMITS.bars) && optStr(s.total) && s.bars.every((b) => {
				const k = rec(b);
				return !!k && isStr(k.label) && isPos(k.value) && optStr(k.brace);
			});
		case 'plot': {
			const f = rec(s.fn);
			if (!f || !optNum(f.a) || !optNum(f.m) || !optNum(f.c)) return false;
			if (f.a === undefined && f.m === undefined) return false;
			for (const r of [s.xRange, s.yRange]) {
				if (r === undefined) continue;
				if (!Array.isArray(r) || r.length !== 2) return false;
				if (!isNum(r[0]) || !isNum(r[1]) || (r[0] as number) >= (r[1] as number)) return false;
			}
			if (s.points !== undefined) {
				if (!arr(s.points, LIMITS.points)) return false;
				if (!s.points.every((p) => {
					const k = rec(p);
					return !!k && isNum(k.x) && isNum(k.y) && optStr(k.label);
				})) return false;
			}
			return true;
		}
		case 'angle':
			return isNum(s.degrees) && (s.degrees as number) > 0 && (s.degrees as number) < 360
				&& optStr(s.label)
				&& (s.rays === undefined
					|| (Array.isArray(s.rays) && s.rays.length === 2 && s.rays.every(isStr)));
		case 'polygon': {
			if (!Array.isArray(s.points) || s.points.length < 3 || s.points.length > LIMITS.polygonPoints) return false;
			if (!s.points.every((p) => {
				const k = rec(p);
				return !!k && isNum(k.x) && isNum(k.y)
					&& (k.x as number) >= 0 && (k.x as number) <= 1
					&& (k.y as number) >= 0 && (k.y as number) <= 1 && optStr(k.label);
			})) return false;
			if (s.sides !== undefined
				&& !(Array.isArray(s.sides) && s.sides.length <= LIMITS.polygonPoints && s.sides.every(isStr))) return false;
			if (s.rightAngleAt !== undefined
				&& !(isNum(s.rightAngleAt) && (s.rightAngleAt as number) >= 0
					&& (s.rightAngleAt as number) < s.points.length)) return false;
			return true;
		}
		case 'forces':
			return optStr(s.body) && arr(s.arrows, LIMITS.arrows) && s.arrows.every((a) => {
				const k = rec(a);
				return !!k && isStr(k.label)
					&& ['up', 'down', 'left', 'right'].includes(String(k.direction))
					&& (k.magnitude === undefined
						|| (isNum(k.magnitude) && (k.magnitude as number) > 0 && (k.magnitude as number) <= 1));
			});
		case 'projectile':
			return (s.mode === undefined || s.mode === 'drop' || s.mode === 'throw')
				&& (s.height === undefined || isPos(s.height))
				&& optStr(s.unit) && optStr(s.object)
				&& (s.showVectors === undefined || typeof s.showVectors === 'boolean')
				&& (s.target === undefined || s.target === 'ground' || s.target === 'head');
		case 'rayDiagram':
			return ['convexLens', 'concaveLens', 'concaveMirror', 'convexMirror'].includes(String(s.element))
				&& isPos(s.objectDistance) && (s.objectDistance as number) <= 6
				&& (s.objectHeight === undefined
					|| (isPos(s.objectHeight) && (s.objectHeight as number) <= 3));
		case 'circuit':
			return (s.arrangement === undefined || s.arrangement === 'series' || s.arrangement === 'parallel')
				&& arr(s.components, LIMITS.components) && s.components.every((c) => {
					const k = rec(c);
					return !!k && optStr(k.label) && ['battery', 'bulb', 'resistor', 'switch', 'ammeter', 'voltmeter']
						.includes(String(k.type));
				});
		case 'timeline':
			return (s.orientation === undefined || s.orientation === 'horizontal' || s.orientation === 'vertical')
				&& arr(s.events, LIMITS.events) && s.events.every((e) => {
					const k = rec(e);
					return !!k && isStr(k.at) && isStr(k.label);
				});
		case 'flowchart': {
			if (!arr(s.nodes, LIMITS.nodes)) return false;
			return s.nodes.every((n) => {
				const k = rec(n);
				if (!k || !isStr(k.label)) return false;
				if (!['start', 'end', 'process', 'decision', 'io'].includes(String(k.type))) return false;
				// A No branch must point at a node that exists, or the arrow goes nowhere.
				if (k.noTo !== undefined
					&& !(isNum(k.noTo) && (k.noTo as number) >= 0
						&& (k.noTo as number) < (s.nodes as unknown[]).length)) return false;
				return true;
			});
		}
		case 'cycle':
			return Array.isArray(s.stages) && s.stages.length >= 3
				&& s.stages.length <= LIMITS.stages && s.stages.every(isStr);
		case 'venn': {
			if (!Array.isArray(s.sets) || s.sets.length < 2 || s.sets.length > LIMITS.sets) return false;
			const okItems = (v: unknown): boolean =>
				v === undefined || (Array.isArray(v) && v.length <= LIMITS.items && v.every(isStr));
			if (!s.sets.every((x) => {
				const k = rec(x);
				return !!k && isStr(k.label) && okItems(k.items);
			})) return false;
			return okItems(s.intersection);
		}
		case 'labelledParts':
			return ['circle', 'ellipse', 'rectangle', 'leaf', 'flask', 'cell'].includes(String(s.shape))
				&& optStr(s.title)
				&& arr(s.parts, LIMITS.parts) && s.parts.every((p) => {
					const k = rec(p);
					return !!k && isStr(k.label) && isNum(k.x) && isNum(k.y)
						&& (k.x as number) >= 0 && (k.x as number) <= 1 && (k.y as number) >= 0 && (k.y as number) <= 1;
				});
		case 'barChart':
			return optStr(s.unit) && arr(s.bars, LIMITS.chartBars) && s.bars.every((b) => {
				const k = rec(b);
				return !!k && isStr(k.label) && isNum(k.value) && (k.value as number) >= 0;
			}) && (s.bars as unknown[]).some((b) => ((rec(b)?.value as number) ?? 0) > 0);
		case 'pieChart':
			return Array.isArray(s.slices) && s.slices.length >= 2 && s.slices.length <= LIMITS.slices
				&& s.slices.every((x) => {
					const k = rec(x);
					return !!k && isStr(k.label) && isPos(k.value);
				});
		case 'coordinateGrid': {
			const okRange = (r: unknown): r is [number, number] =>
				Array.isArray(r) && r.length === 2 && isNum(r[0]) && isNum(r[1])
				&& Number.isInteger(r[0]) && Number.isInteger(r[1])
				&& (r[1] as number) > (r[0] as number) && (r[1] as number) - (r[0] as number) <= LIMITS.gridSpan;
			if (!okRange(s.xRange) || !okRange(s.yRange)) return false;
			if (s.connect !== undefined && typeof s.connect !== 'boolean') return false;
			if (s.points !== undefined) {
				if (!arr(s.points, LIMITS.points)) return false;
				const [x0, x1] = s.xRange; const [y0, y1] = s.yRange;
				if (!s.points.every((p) => {
					const k = rec(p);
					return !!k && isNum(k.x) && isNum(k.y) && optStr(k.label)
						&& (k.x as number) >= x0 && (k.x as number) <= x1 && (k.y as number) >= y0 && (k.y as number) <= y1;
				})) return false;
			}
			return true;
		}
		case 'clockFace':
			return isNum(s.hour) && Number.isInteger(s.hour) && (s.hour as number) >= 1 && (s.hour as number) <= 12
				&& isNum(s.minute) && Number.isInteger(s.minute) && (s.minute as number) >= 0 && (s.minute as number) <= 59
				&& (s.showDigital === undefined || typeof s.showDigital === 'boolean');
		case 'placeValue': {
			if (!isNum(s.number) || !Number.isInteger(s.number) || (s.number as number) < 0) return false;
			if (s.base !== undefined && s.base !== 10 && s.base !== 2 && s.base !== '10' && s.base !== '2') return false;
			// Ten columns is what fits: 999,999,999 in base ten, 1023 in base two.
			return (s.base === 2 || s.base === '2') ? (s.number as number) <= 1023 : (s.number as number) <= LIMITS.placeValueMax;
		}
		case 'divisionLadder': {
			if (!isNum(s.number) || !Number.isInteger(s.number) || (s.number as number) < 1 || (s.number as number) > LIMITS.ladderMax) return false;
			if (!isNum(s.base) || !Number.isInteger(s.base) || (s.base as number) < 2 || (s.base as number) > 16) return false;
			// Twenty rows is a page; 1,000,000 in base 2 is twenty rows exactly.
			return divisionLadderRows(s.number as number, s.base as number).length <= LIMITS.ladderRows;
		}
		case 'nestedSets':
			return Array.isArray(s.rings) && s.rings.length >= 2 && s.rings.length <= LIMITS.rings
				&& s.rings.every((r) => {
					const k = rec(r);
					return !!k && isStr(k.label) && (k.items === undefined || (Array.isArray(k.items) && k.items.length <= LIMITS.ringItems && k.items.every(isStr)));
				});
		case 'table': {
			if (!arr(s.columns, LIMITS.tableCols) || !s.columns.every(isStr)) return false;
			if (!arr(s.rows, LIMITS.tableRows)) return false;
			const n = s.columns.length;
			if (!s.rows.every((r) => Array.isArray(r) && r.length === n && r.every((c) => typeof c === 'string' && c.length <= LIMITS.labelChars))) return false;
			return s.highlightRow === undefined
				|| (isNum(s.highlightRow) && (s.highlightRow as number) >= 0 && (s.highlightRow as number) < s.rows.length);
		}
		default:
			return false;
	}
}

/**
 * What the diagram SAYS, in words.
 *
 * Every renderer uses this for the accessible name, and a text-only context (a plain-text export,
 * a screen reader, a lesson plan degraded to prose) uses it instead of the picture. A diagram
 * nobody can read is not a richer lesson plan, it is a gap in one.
 */
export function describeDiagram(spec: DiagramSpec): string {
	const list = (xs: string[]): string =>
		xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;

	switch (spec.kind) {
		case 'numberLine': {
			const jumps = (spec.marks ?? []).filter((m) => m.jumpTo !== undefined)
				.map((m) => `a jump from ${m.at} to ${m.jumpTo}`);
			const pts = (spec.marks ?? []).filter((m) => m.jumpTo === undefined)
				.map((m) => m.label ?? String(m.at));
			return `Number line from ${spec.from} to ${spec.to}`
				+ (pts.length ? `, marking ${list(pts)}` : '')
				+ (jumps.length ? `, with ${list(jumps)}` : '');
		}
		case 'fractionBar':
			return `Fraction bars showing ${list(spec.bars.map((b) => `${b.shaded} of ${b.parts}`))}`;
		case 'array':
			return `A ${spec.rows} by ${spec.cols} array, ${spec.rows * spec.cols} in total`;
		case 'barModel':
			return `Bar model comparing ${list(spec.bars.map((b) => `${b.label} (${b.value})`))}`
				+ (spec.total ? `, total ${spec.total}` : '');
		case 'plot': {
			const { a, m, c } = spec.fn;
			const eq = a !== undefined
				? `y = ${a}x squared${m ? ` + ${m}x` : ''}${c ? ` + ${c}` : ''}`
				: `y = ${m}x${c ? ` + ${c}` : ''}`;
			return `Graph of ${eq}`;
		}
		case 'angle':
			return `An angle of ${spec.degrees} degrees`
				+ (spec.rays ? ` between rays ${spec.rays[0]} and ${spec.rays[1]}` : '');
		case 'polygon':
			return `A ${spec.points.length}-sided shape`
				+ (spec.rightAngleAt !== undefined ? ' with a right angle' : '')
				+ (spec.sides?.length ? `, sides ${list(spec.sides)}` : '');
		case 'forces':
			return `Force diagram${spec.body ? ` on ${spec.body}` : ''}: `
				+ list(spec.arrows.map((a) => `${a.label} acting ${a.direction}`));
		case 'projectile': {
			const what = spec.object ?? 'an object';
			const where = spec.target === 'head' ? ' onto a head below' : ' to the ground';
			const how = spec.mode === 'throw' ? 'thrown and following a curved path' : 'falling straight down';
			return `${what} ${how}${where}`
				+ (spec.height ? `, from ${spec.height}${spec.unit ?? 'm'}` : '');
		}
		case 'rayDiagram': {
			const names: Record<string, string> = {
				convexLens: 'a convex lens', concaveLens: 'a concave lens',
				concaveMirror: 'a concave mirror', convexMirror: 'a convex mirror',
			};
			return `Ray diagram for ${names[spec.element]}, object at ${spec.objectDistance} focal lengths`;
		}
		case 'circuit':
			return `A ${spec.arrangement ?? 'series'} circuit with `
				+ list(spec.components.map((c) => c.label ?? c.type));
		case 'timeline':
			return `Timeline: ${list(spec.events.map((e) => `${e.at}, ${e.label}`))}`;
		case 'flowchart':
			return `Flowchart: ${list(spec.nodes.map((n) => n.label))}`;
		case 'cycle':
			return `A cycle repeating through ${list(spec.stages)}`;
		case 'venn':
			return `Venn diagram of ${list(spec.sets.map((s) => s.label))}`
				+ (spec.intersection?.length ? `, sharing ${list(spec.intersection)}` : '');
		case 'labelledParts':
			return `${spec.title ?? 'A labelled diagram'} with ${spec.parts.length} labelled part${spec.parts.length === 1 ? '' : 's'}: `
				+ list(spec.parts.map((p, i) => `${i + 1} ${p.label}`));
		case 'barChart':
			return `Bar chart: ${list(spec.bars.map((b) => `${b.label} ${b.value}${spec.unit ? ` ${spec.unit}` : ''}`))}`;
		case 'pieChart': {
			const total = spec.slices.reduce((t, x) => t + x.value, 0) || 1;
			return `Pie chart: ${list(spec.slices.map((x) => `${x.label} ${Math.round((x.value / total) * 100)}%`))}`;
		}
		case 'coordinateGrid':
			return `Coordinate grid from x ${spec.xRange[0]} to ${spec.xRange[1]} and y ${spec.yRange[0]} to ${spec.yRange[1]}`
				+ (spec.points?.length ? `, plotting ${list(spec.points.map((p) => p.label ?? `(${p.x}, ${p.y})`))}` : '')
				+ (spec.connect && (spec.points?.length ?? 0) > 1 ? ', joined in order' : '');
		case 'clockFace':
			return `A clock showing ${spec.hour}:${String(spec.minute).padStart(2, '0')}`;
		case 'placeValue':
			return placeValueBase(spec) === 2
				? `${spec.number} written in binary place-value columns: ${spec.number.toString(2)}`
				: `${spec.number} in place-value columns`;
		case 'table':
			return `A table with columns ${list(spec.columns)} and ${spec.rows.length} row${spec.rows.length === 1 ? '' : 's'}`;
		case 'divisionLadder':
			return `${spec.number} divided by ${spec.base} repeatedly: ${divisionLadderRows(spec.number, spec.base).map((r) => `${r.dividend} gives ${r.quotient} remainder ${r.remainder}`).join(', ')}; read upwards, ${spec.number} is ${spec.number.toString(spec.base).toUpperCase()} in base ${spec.base}`;
		case 'nestedSets':
			return `Nested sets, innermost first: ${list(spec.rings.map((r) => r.label + (r.items?.length ? ` (${r.items.join(', ')})` : '')))}`;
	}
}

/** Every row of a division ladder, computed. `digits` is the remainders read upwards. */
export function divisionLadderRows(n: number, base: number): Array<{ dividend: number; quotient: number; remainder: number }> {
	const rows: Array<{ dividend: number; quotient: number; remainder: number }> = [];
	let x = Math.max(0, Math.trunc(n));
	if (x === 0) return [{ dividend: 0, quotient: 0, remainder: 0 }];
	while (x > 0 && rows.length < 64) {
		const q = Math.floor(x / base);
		rows.push({ dividend: x, quotient: q, remainder: x - q * base });
		x = q;
	}
	return rows;
}

/** A remainder as a digit in the target base: 10 is A, 15 is F. */
export function baseDigit(r: number): string {
	return r < 10 ? String(r) : String.fromCharCode(55 + r);
}
