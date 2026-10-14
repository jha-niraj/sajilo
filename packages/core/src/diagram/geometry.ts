/**
 * The geometry every renderer shares.
 *
 * Pure arithmetic, no DOM and no drawing. The point is that a screen renderer and a `pdf-lib` one
 * cannot disagree about WHERE things go - only about how they are painted. `QuestionFigure` keeps
 * two independent implementations and relies on both being edited together; this keeps the maths
 * in one place so there is nothing to keep in step.
 */

import type { PlotSpec, ProjectileSpec } from './spec';

export interface Box { width: number; height: number; padding: number }

/** The default canvas. Wide enough to sit beside lesson text without being a thumbnail. */
export const CANVAS: Box = { width: 320, height: 200, padding: 24 };

/** A linear scale from a data range onto a pixel range. The one function everything else uses. */
export function scale(domain: [number, number], range: [number, number]) {
	const [d0, d1] = domain;
	const [r0, r1] = range;
	const span = d1 - d0;
	// A zero span would divide by zero and put every point at the same place. Pin to the middle,
	// which at least draws something honest rather than a NaN that renders as nothing.
	const k = span === 0 ? 0 : (r1 - r0) / span;
	return (v: number): number => (span === 0 ? (r0 + r1) / 2 : r0 + (v - d0) * k);
}

/**
 * Tick values across a range.
 *
 * `step` is honoured when given, because a number line for teaching twos must show twos and not a
 * prettier interval. Without one, the step is chosen so the count stays readable.
 */
export function ticks(from: number, to: number, step?: number, maxTicks = 21): number[] {
	const span = to - from;
	let s = step && step > 0 ? step : 1;
	if (!step) {
		const raw = span / (maxTicks - 1);
		const mag = 10 ** Math.floor(Math.log10(Math.max(raw, 1e-9)));
		s = [1, 2, 5, 10].map((m) => m * mag).find((c) => span / c <= maxTicks - 1) ?? mag * 10;
	}
	const out: number[] = [];
	// Counted rather than accumulated: repeated addition of 0.1 drifts, and a tick at
	// 0.30000000000000004 renders as that.
	const n = Math.floor(span / s + 1e-9);
	for (let i = 0; i <= n; i++) out.push(round(from + i * s));
	return out;
}

/** Kill float noise from scaled arithmetic before it reaches a label or a coordinate. */
export function round(v: number, dp = 4): number {
	const f = 10 ** dp;
	return Math.round(v * f) / f;
}

/** `y` for a linear or quadratic plot. */
export function evalFn(fn: PlotSpec['fn'], x: number): number {
	const { a = 0, m = 0, c = 0 } = fn;
	return a * x * x + m * x + c;
}

/**
 * Sample a plotted function into points.
 *
 * Samples rather than a bezier because a quadratic drawn as one curve segment is wrong the moment
 * the range is not symmetric about the vertex, and nobody notices until a student reads the graph.
 */
export function samplePlot(
	fn: PlotSpec['fn'],
	xRange: [number, number],
	samples = 64,
): Array<{ x: number; y: number }> {
	const [x0, x1] = xRange;
	const out: Array<{ x: number; y: number }> = [];
	for (let i = 0; i <= samples; i++) {
		const x = x0 + ((x1 - x0) * i) / samples;
		out.push({ x, y: evalFn(fn, x) });
	}
	return out;
}

/** A y-range that actually contains the curve, when the caller did not pick one. */
export function autoYRange(fn: PlotSpec['fn'], xRange: [number, number]): [number, number] {
	const ys = samplePlot(fn, xRange, 32).map((p) => p.y);
	const lo = Math.min(...ys, 0);
	const hi = Math.max(...ys, 0);
	const pad = Math.max((hi - lo) * 0.15, 1);
	return [Math.floor(lo - pad), Math.ceil(hi + pad)];
}

/**
 * The path of a falling or thrown object, as fractions of the canvas (0..1, y down).
 *
 * **The easing IS the content.** Free fall is quadratic in time, so a linear drop does not merely
 * look wrong, it teaches the wrong thing in a physics lesson. `t` here is normalised time, and the
 * vertical term is `t^2` for exactly that reason.
 */
export function trajectory(mode: ProjectileSpec['mode'], samples = 24): Array<{ x: number; y: number }> {
	const out: Array<{ x: number; y: number }> = [];
	for (let i = 0; i <= samples; i++) {
		const t = i / samples;
		out.push(mode === 'throw'
			// A throw is constant horizontal speed against the same quadratic fall, which is why
			// the two halves of the arc are not mirror images unless it lands at launch height.
			? { x: t, y: round(2 * t - t * t * 2 > 1 ? 1 : 1 - (2 * t - 2 * t * t) * 2) }
			: { x: 0, y: round(t * t) });
	}
	return out;
}

/** Points to an SVG polyline string. */
export function toPolyline(points: Array<{ x: number; y: number }>): string {
	return points.map((p) => `${round(p.x, 2)},${round(p.y, 2)}`).join(' ');
}

/** Points to an SVG path `d`, as straight segments. */
export function toPath(points: Array<{ x: number; y: number }>): string {
	if (points.length === 0) return '';
	const [first, ...rest] = points;
	return `M ${round(first!.x, 2)} ${round(first!.y, 2)}`
		+ rest.map((p) => ` L ${round(p.x, 2)} ${round(p.y, 2)}`).join('');
}

/** Evenly spaced angles around a ring, starting at twelve o'clock. */
export function ringAngles(count: number): number[] {
	return Array.from({ length: count }, (_, i) => (i / count) * Math.PI * 2 - Math.PI / 2);
}

export function polar(cx: number, cy: number, r: number, angle: number): { x: number; y: number } {
	return { x: round(cx + r * Math.cos(angle), 2), y: round(cy + r * Math.sin(angle), 2) };
}

/** The share of each slice as a start and end angle in radians, clockwise from twelve o'clock. */
export function pieAngles(values: number[]): Array<{ start: number; end: number; share: number }> {
	const total = values.reduce((t, v) => t + v, 0) || 1;
	let a = -Math.PI / 2;
	return values.map((v) => {
		const share = v / total;
		const start = a;
		a += share * Math.PI * 2;
		return { start, end: a, share };
	});
}

/** Place-value columns of a whole number, most significant first. Base ten or base two. */
export function placeValueColumns(n: number, base: 10 | 2 = 10): Array<{ digit: number; value: number; name: string }> {
	const digits = Math.max(1, n).toString(base).split('').map(Number);
	if (n === 0) return [{ digit: 0, value: 1, name: base === 10 ? 'ones' : '1' }];
	const tenNames = ['ones', 'tens', 'hundreds', 'thousands', 'ten thousands', 'hundred thousands', 'millions', 'ten millions', 'hundred millions'];
	return digits.map((digit, i) => {
		const power = digits.length - 1 - i;
		const value = Math.pow(base, power);
		return { digit, value, name: base === 10 ? (tenNames[power] ?? `10^${power}`) : String(value) };
	});
}
