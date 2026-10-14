"use client";

/**
 * A timeline - events down a line, or along one.
 *
 * ## Vertical is the default, and that is not a style preference
 *
 * The validator allows an eighty-character label, and eighty characters do not fit under a tick on
 * a 320-wide canvas at any readable size. Vertical gives every event the full width of the figure
 * and grows downwards, which costs nothing; horizontal keeps the shape a history textbook prints
 * and pays for it by ALTERNATING labels above and below the line, so a label only has to clear its
 * neighbour-but-one rather than its neighbour.
 *
 * ## Rows are measured, never assumed
 *
 * Every block is wrapped first and the layout is sized from the line counts that come back, so a
 * one-word event stays compact and a full-length one still fits. Nothing is truncated: a date the
 * caller gave us is data, and dropping half of it silently is worse than a taller figure.
 */

import { round, type TimelineSpec } from "@repo/core/diagram";
import {
	Appear, ArrowDefs, DrawPath, LABEL, LABEL_SM, STROKE,
	diagramId, useDiagramMotion, DiagramFrame,
} from "./canvas";

/** Rough advance widths for the two label tokens. Generous, because overflow cannot be undone. */
const CHAR = 6.0, CHAR_SM = 5.3;
const W = 320;
const LINE = 13, LINE_SM = 11;

/** Wrap to a column, breaking a word longer than the column rather than letting it overflow. */
function wrap(text: string, per: number): string[] {
	const cap = Math.max(4, Math.floor(per));
	const lines: string[] = [];
	let cur = "";
	for (const word of text.split(/\s+/).filter(Boolean)) {
		let w = word;
		while (w.length > cap) {
			if (cur) { lines.push(cur); cur = ""; }
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

export function Timeline({ spec, animate }: { spec: TimelineSpec; animate?: boolean }) {
	return (spec.orientation ?? "vertical") === "horizontal"
		? <Horizontal spec={spec} animate={animate} />
		: <Vertical spec={spec} animate={animate} />;
}

function Vertical({ spec, animate }: { spec: TimelineSpec; animate?: boolean }) {
	const id = diagramId(spec);
	const moving = useDiagramMotion(animate);

	const axisX = 86;
	let y = 18;
	const rows = spec.events.map((e) => {
		const at = wrap(e.at, (axisX - 16) / CHAR_SM);
		const label = wrap(e.label, (W - axisX - 20) / CHAR);
		const h = 16 + Math.max(at.length, label.length) * LINE;
		const mid = round(y + h / 2, 2);
		y += h;
		return { at, label, mid };
	});
	const H = y + 16;

	/** Baseline of line `i` in a block of `n` lines centred on `mid`. */
	const baseline = (mid: number, n: number, i: number): number =>
		round(mid - ((n - 1) * LINE) / 2 + 4 + i * LINE, 2);

	return (
		<DiagramFrame spec={spec} width={W} height={H}>
			<ArrowDefs id={id} />

			{/* Arrowed, because a timeline has a direction and the reader should not have to
			    infer it from the dates. */}
			<DrawPath
				d={`M ${axisX} 8 L ${axisX} ${H - 8}`}
				animate={moving}
				{...STROKE}
				markerEnd={`url(#${id})`}
			/>

			{rows.map((r, i) => (
				<Appear key={i} animate={moving} delay={0.45 + i * 0.12}>
					<circle cx={axisX} cy={r.mid} r={4} fill="currentColor" />
					{r.at.map((line, li) => (
						<text
							key={`a-${li}`}
							x={axisX - 12}
							y={baseline(r.mid, r.at.length, li)}
							textAnchor="end"
							{...LABEL_SM}
						>
							{line}
						</text>
					))}
					{r.label.map((line, li) => (
						<text key={`l-${li}`} x={axisX + 12} y={baseline(r.mid, r.label.length, li)} {...LABEL}>
							{line}
						</text>
					))}
				</Appear>
			))}
		</DiagramFrame>
	);
}

function Horizontal({ spec, animate }: { spec: TimelineSpec; animate?: boolean }) {
	const id = diagramId(spec);
	const moving = useDiagramMotion(animate);

	const n = spec.events.length;
	const padX = 26;
	const slot = n > 1 ? (W - 2 * padX) / (n - 1) : 0;
	// A label's nearest same-side neighbour is two slots away, so a column a little under two
	// slots wide cannot collide with one.
	const col = n > 1 ? clamp(slot * 1.85, 40, 170) : 200;
	const half = Math.min(col / 2, W / 2 - 8);

	const events = spec.events.map((e, i) => {
		const at = wrap(e.at, col / CHAR_SM);
		const label = wrap(e.label, col / CHAR);
		return {
			at,
			label,
			above: i % 2 === 0,
			x: round(n > 1 ? padX + i * slot : W / 2, 2),
			// How far this block reaches from the line, including the ascender of its top row.
			reach: 20 + at.length * LINE_SM + 4 + (label.length - 1) * LINE + 9,
		};
	});

	const side = (above: boolean): number =>
		events.filter((e) => e.above === above).reduce((mx, e) => Math.max(mx, e.reach), 0);
	const axisY = 10 + Math.max(side(true), 24);
	const H = axisY + Math.max(side(false), 24) + 10;

	return (
		<DiagramFrame spec={spec} width={W} height={H}>
			<ArrowDefs id={id} />

			<DrawPath
				d={`M 8 ${axisY} L ${W - 8} ${axisY}`}
				animate={moving}
				{...STROKE}
				markerEnd={`url(#${id})`}
			/>

			{events.map((e, i) => {
				// The block is centred on its tick, but pushed inside the canvas at the two ends.
				// The stub stays on the tick, so a shifted block still points at its own event.
				const tx = clamp(e.x, 6 + half, W - 6 - half);
				const dir = e.above ? -1 : 1;
				// `at` sits nearest the line and the label reads outwards from it, so the order is
				// tick, date, event on both sides.
				const atFirst = e.above
					? axisY - 20 - (e.at.length - 1) * LINE_SM
					: axisY + 24;
				const labelFirst = e.above
					? atFirst - LINE_SM - 4 - (e.label.length - 1) * LINE
					: axisY + 24 + e.at.length * LINE_SM + 4;
				return (
					<Appear key={i} animate={moving} delay={0.45 + i * 0.12}>
						<line x1={e.x} y1={axisY} x2={e.x} y2={axisY + dir * 11} {...STROKE} />
						<circle cx={e.x} cy={axisY} r={3.5} fill="currentColor" />
						{e.at.map((line, li) => (
							<text
								key={`a-${li}`}
								x={tx}
								y={atFirst + li * LINE_SM}
								textAnchor="middle"
								{...LABEL_SM}
							>
								{line}
							</text>
						))}
						{e.label.map((line, li) => (
							<text
								key={`l-${li}`}
								x={tx}
								y={labelFirst + li * LINE}
								textAnchor="middle"
								{...LABEL}
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
