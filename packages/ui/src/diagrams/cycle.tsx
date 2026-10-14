"use client";

/**
 * A cycle - the water cycle, a life cycle, the fetch-decode-execute loop.
 *
 * ## The ring has to CLOSE, or it is just a list
 *
 * The one thing this diagram says that a numbered list does not is that the last stage leads back
 * to the first. So the arrows are drawn as arcs ON the ring, including the arc from the last stage
 * back to the first, and the numbered markers sit in the gaps between them. There is no separate
 * ring outline: the arrows are the ring.
 *
 * ## Labels sit outside, and the bottom of a ring is the hard case
 *
 * A label placed on the ring collides with the arrows, so every label sits outside its marker,
 * pushed radially outwards. Which way the text runs is decided by where on the ring it is - it
 * reads outwards on the left and right, and stacks above or below at the top and bottom - and the
 * column it is wrapped into is measured to the canvas edge, so a stage at three o'clock cannot
 * write itself off the side.
 */

import { polar, ringAngles, round, type CycleSpec } from "@repo/core/diagram";
import {
	Appear, ArrowDefs, DrawPath, LABEL, LABEL_SM, SOFT_FILL, STROKE,
	diagramId, useDiagramMotion, DiagramFrame,
} from "./canvas";

const W = 320, CX = W / 2;
// 5.6 is closer to the real average advance of the 11px label face than 6.0 was. The estimate
// only decides how many characters fit before wrapping, and over-estimating it cost a whole
// character of column - enough to hyphenate "Condensation" in the water cycle.
const CHAR = 5.6, LINE = 13;
const NODE_R = 13;

/** Wrap to a column, breaking a word longer than the column rather than letting it overflow. */
function wrap(text: string, per: number): string[] {
	const cap = Math.max(5, Math.floor(per));
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

export function Cycle({ spec, animate }: { spec: CycleSpec; animate?: boolean }) {
	const id = diagramId(spec);
	const moving = useDiagramMotion(animate);

	const n = spec.stages.length;
	// A bigger ring for more stages, so the arc between two markers stays long enough to read as
	// an arrow rather than as a tick.
	// Pulled in from 46 + 3.5n. The ring was pushed so far out that a stage at three o'clock had
	// only ~70px to the canvas edge for its name, so a normal word broke mid-syllable. The circle
	// loses a few pixels and every side label gains a character.
	const R = 40 + n * 3;
	const labelR = R + NODE_R + 9;
	const angles = ringAngles(n);
	const step = (Math.PI * 2) / n;

	// Everything below is measured from the ring centre, which lets the canvas be sized to the
	// labels afterwards rather than the labels being squeezed into a guessed canvas.
	const stages = spec.stages.map((text, i) => {
		const a = angles[i] ?? 0;
		const cos = Math.cos(a), sin = Math.sin(a);
		const qx = round(CX + labelR * cos, 2), qy = round(labelR * sin, 2);
		// Typed rather than inferred: a bare ternary widens to `string`, which the SVG
		// `textAnchor` attribute will not take.
		const anchor: "start" | "end" | "middle" =
			cos > 0.34 ? "start" : cos < -0.34 ? "end" : "middle";
		const room = anchor === "start" ? W - 8 - qx
			: anchor === "end" ? qx - 8
				: 2 * Math.min(qx - 8, W - 8 - qx);
		const lines = wrap(text, room / CHAR);
		const first = sin < -0.5 ? qy - 2 - (lines.length - 1) * LINE
			: sin > 0.5 ? qy + 12
				: round(qy + 4 - ((lines.length - 1) * LINE) / 2, 2);
		return { a, qx, anchor, lines, first };
	});

	const minY = stages.reduce((m, s) => Math.min(m, s.first - 9), -(R + NODE_R));
	const maxY = stages.reduce(
		(m, s) => Math.max(m, s.first + (s.lines.length - 1) * LINE + 3),
		R + NODE_R,
	);
	const cy = round(12 - minY, 2);
	const H = round(maxY - minY + 24, 2);

	// Clear the markers at both ends so the arrowhead lands in open space.
	const gap = (NODE_R + 7) / R;

	return (
		<DiagramFrame spec={spec} width={W} height={H}>
			<ArrowDefs id={id} />

			{stages.map((s, i) => {
				const from = polar(CX, cy, R, s.a + gap);
				const to = polar(CX, cy, R, s.a + step - gap);
				return (
					<DrawPath
						key={`arc-${i}`}
						// Sweep 1 is clockwise on screen, which is the direction `ringAngles` walks.
						d={`M ${from.x} ${from.y} A ${R} ${R} 0 0 1 ${to.x} ${to.y}`}
						animate={moving}
						delay={0.15 + i * 0.18}
						{...STROKE}
						markerEnd={`url(#${id})`}
					/>
				);
			})}

			{stages.map((s, i) => {
				const p = polar(CX, cy, R, s.a);
				return (
					<Appear key={`s-${i}`} animate={moving} delay={0.5 + i * 0.18}>
						<circle cx={p.x} cy={p.y} r={NODE_R} {...SOFT_FILL} />
						<circle cx={p.x} cy={p.y} r={NODE_R} {...STROKE} />
						<text x={p.x} y={p.y + 3.5} textAnchor="middle" {...LABEL_SM}>{i + 1}</text>
						{s.lines.map((line, li) => (
							<text
								key={li}
								x={s.qx}
								y={round(cy + s.first + li * LINE, 2)}
								textAnchor={s.anchor}
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
