"use client";

/**
 * A cartesian plot of `y = mx + c` or `y = ax^2 + bx + c`.
 *
 * ## The curve is sampled, never faked
 *
 * A parabola drawn as one quadratic bezier is only correct when the range happens to be symmetric
 * about the vertex, and it is wrong everywhere else in a way no one notices until a student reads a
 * value off it. So the points come from `samplePlot` in the shared geometry, which is the same
 * function a print renderer will call, and the curve is a polyline through them.
 *
 * ## The axes cross at the origin when the origin is on screen
 *
 * A textbook graph has its axes through zero, not pinned to the edge of the paper. When the range
 * does not contain zero the axis is clamped to the nearest edge instead, and the "O" is dropped -
 * labelling an edge as the origin would be a straight lie about where zero is.
 *
 * The curve is clipped to the plotting rectangle, so a steep quadratic cannot escape past the axes
 * and draw over the labels.
 */

import {
	autoYRange, round, samplePlot, scale, ticks, toPath, type PlotSpec,
} from "@repo/core/diagram";
import {
	Appear, ArrowDefs, DASH, DrawPath, EMPHASIS, LABEL, LABEL_SM, STROKE,
	diagramId, useDiagramMotion, DiagramFrame,
} from "./canvas";

const W = 320, H = 240;
const L = 38, R = 14, T = 26, B = 30;
const PX0 = L, PX1 = W - R, PY0 = T, PY1 = H - B;

/** Faint enough to sit behind the curve, still visible in a one-colour print. */
const GRID = { ...DASH, opacity: 0.22 } as const;

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** Two lines at most, hard-breaking an unbroken run, so the validator's 80 characters always fit. */
function wrap(text: string, per: number): string[] {
	if (text.length <= per) return [text];
	const words = text.split(" ").flatMap((w) => {
		if (w.length <= per) return [w];
		const chunks: string[] = [];
		for (let i = 0; i < w.length; i += per) chunks.push(w.slice(i, i + per));
		return chunks;
	});
	const lines: string[] = [];
	let cur = "";
	for (const w of words) {
		if ((cur + " " + w).trim().length > per && cur) { lines.push(cur); cur = w; }
		else cur = (cur + " " + w).trim();
	}
	if (cur) lines.push(cur);
	return lines.slice(0, 2);
}

/**
 * Ticks anchored on a multiple of the step rather than on `from`.
 *
 * `ticks` starts counting at `from`, which is right for a number line taught in twos and wrong
 * here: a graph whose x ticks read -5, -3, -1, 1 has no tick at zero, and zero is the one value a
 * reader looks for. The step it chooses is still the step used.
 */
function alignedTicks(from: number, to: number, maxTicks: number): number[] {
	const base = ticks(from, to, undefined, maxTicks);
	const first = base[0], second = base[1];
	const step = first !== undefined && second !== undefined ? round(second - first) : 1;
	const start = round(Math.ceil(from / step - 1e-9) * step);
	return ticks(start, to, step, maxTicks);
}

/** The equation, written the way it is written on a board. */
function equation(fn: PlotSpec["fn"]): string {
	let out = "";
	const push = (coef: number, tail: string): void => {
		if (coef === 0) return;
		const sign = out === "" ? (coef < 0 ? "-" : "") : coef < 0 ? " - " : " + ";
		const mag = Math.abs(round(coef, 2));
		out += `${sign}${mag === 1 && tail !== "" ? "" : mag}${tail}`;
	};
	push(fn.a ?? 0, "x²");
	push(fn.m ?? 0, "x");
	push(fn.c ?? 0, "");
	return `y = ${out === "" ? "0" : out}`;
}

export function Plot({ spec, animate }: { spec: PlotSpec; animate?: boolean }) {
	const id = diagramId(spec);
	const clipId = `${id}clip`;
	const moving = useDiagramMotion(animate);

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

	const curve = toPath(samplePlot(spec.fn, xr, 96).map((p) => ({ x: x(p.x), y: y(p.y) })));

	return (
		<DiagramFrame spec={spec} width={W} height={H}>
			<ArrowDefs id={id} />
			<defs>
				<clipPath id={clipId}>
					<rect x={PX0} y={PY0} width={PX1 - PX0} height={PY1 - PY0} />
				</clipPath>
			</defs>

			<Appear animate={moving} delay={0.1}>
				<text x={8} y={14} {...LABEL}>{equation(spec.fn)}</text>
			</Appear>

			<Appear animate={moving} delay={0.15}>
				{xTicks.map((t) => (
					<line key={`gx-${t}`} x1={round(x(t), 2)} y1={PY0} x2={round(x(t), 2)} y2={PY1} {...GRID} />
				))}
				{yTicks.map((t) => (
					<line key={`gy-${t}`} x1={PX0} y1={round(y(t), 2)} x2={PX1} y2={round(y(t), 2)} {...GRID} />
				))}
			</Appear>

			{/* Axes draw themselves first - everything after is read against them. */}
			<DrawPath
				d={`M ${PX0} ${round(axisY, 2)} L ${PX1} ${round(axisY, 2)}`}
				animate={moving}
				{...STROKE}
				markerEnd={`url(#${id})`}
			/>
			<DrawPath
				d={`M ${round(axisX, 2)} ${PY1} L ${round(axisX, 2)} ${PY0}`}
				animate={moving}
				delay={0.2}
				{...STROKE}
				markerEnd={`url(#${id})`}
			/>

			<Appear animate={moving} delay={0.6}>
				{/* Above the axis, not below it: the x tick labels run along underneath and the last
				    of them sits directly under this arrow. */}
				<text x={PX1 + 4} y={round(axisY, 2) - 6} {...LABEL}>x</text>
				<text x={round(axisX, 2) + 7} y={PY0 + 3} {...LABEL}>y</text>
				{originVisible && (
					<text x={round(axisX, 2) - 5} y={round(axisY, 2) + 13} textAnchor="end" {...LABEL_SM}>O</text>
				)}

				{xTicks.map((t) => (originVisible && t === 0 ? null : (
					<g key={`tx-${t}`}>
						<line
							x1={round(x(t), 2)} y1={round(axisY - 3.5, 2)}
							x2={round(x(t), 2)} y2={round(axisY + 3.5, 2)}
							{...STROKE}
						/>
						<text x={round(x(t), 2)} y={round(axisY + 15, 2)} textAnchor="middle" {...LABEL_SM}>
							{round(t, 2)}
						</text>
					</g>
				)))}
				{yTicks.map((t) => (originVisible && t === 0 ? null : (
					<g key={`ty-${t}`}>
						<line
							x1={round(axisX - 3.5, 2)} y1={round(y(t), 2)}
							x2={round(axisX + 3.5, 2)} y2={round(y(t), 2)}
							{...STROKE}
						/>
						<text x={round(axisX - 7, 2)} y={round(y(t) + 3.5, 2)} textAnchor="end" {...LABEL_SM}>
							{round(t, 2)}
						</text>
					</g>
				)))}
			</Appear>

			<g clipPath={`url(#${clipId})`}>
				<DrawPath d={curve} animate={moving} delay={0.8} {...EMPHASIS} />

				{pts.map((p, i) => (
					<Appear key={`p-${i}`} animate={moving} delay={1.5 + i * 0.1}>
						<circle cx={round(x(p.x), 2)} cy={round(y(p.y), 2)} r={3.5} fill="currentColor" />
					</Appear>
				))}
			</g>

			{/* Labels go OUTSIDE the clip: a caption sliced in half by the plot edge is worse than
			    one that leans inwards. A point the caller has ranged off the graph gets none, since
			    there is no dot for it to name. */}
			{pts.map((p, i) => {
				if (!p.label) return null;
				if (p.x < xr[0] || p.x > xr[1] || p.y < yr[0] || p.y > yr[1]) return null;
				const px = round(x(p.x), 2), py = round(y(p.y), 2);
				const lines = wrap(p.label, 40);
				const w = lines.reduce((m, l) => Math.max(m, l.length * 5.25), 0);
				const toLeft = px + 6 + w > PX1;
				const below = py - 7 - (lines.length - 1) * 11 < PY0 + 6;
				const lx = Math.min(
					W - 4 - (toLeft ? 0 : w),
					Math.max(4 + (toLeft ? w : 0), toLeft ? px - 6 : px + 6),
				);
				return (
					<Appear key={`pl-${i}`} animate={moving} delay={1.55 + i * 0.1}>
						{lines.map((line, li) => (
							<text
								key={li}
								x={round(lx, 2)}
								y={below ? py + 15 + li * 11 : py - 7 - (lines.length - 1 - li) * 11}
								textAnchor={toLeft ? "end" : "start"}
								{...LABEL_SM}
							>
								{line}
							</text>
						))}
					</Appear>
				);
			})}
		</DiagramFrame>
	);
}
