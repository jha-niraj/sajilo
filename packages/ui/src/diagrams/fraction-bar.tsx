"use client";

/**
 * Fraction bars - one or more bars cut into equal parts, some of them shaded.
 *
 * ## Every bar is the SAME width, and that is the entire point
 *
 * A fraction bar on its own teaches almost nothing; two stacked bars teach equivalence. 1/2 above
 * 2/4 only shows that they are the same amount if both bars start at the same x and end at the same
 * x, so the width here is a constant and never derived from `parts`. A bar sized to its own
 * denominator would make 2/4 wider than 1/2 and quietly teach the opposite of the lesson.
 *
 * The fraction itself is written in the left gutter as a stacked numerator over denominator, the
 * way it is written on a board, so the picture and the notation sit side by side.
 */

import { round, type FractionBarSpec } from "@repo/core/diagram";
import {
	Appear, DrawPath, LABEL, LABEL_SM, SOFT_FILL, STROKE,
	useDiagramMotion, DiagramFrame,
} from "./canvas";

/** Break an optional bar label onto at most two lines so it cannot run off the canvas. */
function wrap(text: string, per: number): string[] {
	if (text.length <= per) return [text];
	// A single unbroken run longer than a line has to be cut, or it walks off the canvas: the
	// validator allows 80 characters and says nothing about spaces.
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

const W = 320;
const GUTTER_CX = 22;      // centre of the left gutter, where the fraction is written
const BAR_X = 44;
const BAR_W = W - BAR_X - 12;
const BAR_H = 32;
const GAP = 16;
const LINE_H = 12;
const PAD = 12;

export function FractionBar({ spec, animate }: { spec: FractionBarSpec; animate?: boolean }) {
	const moving = useDiagramMotion(animate);

	// Rows are laid out top-down because a bar with a two-line label is taller than one without,
	// and a fixed row height would either clip the long ones or leave a hole under the short ones.
	let cursor = PAD;
	const rows = spec.bars.map((bar) => {
		const lines = bar.label ? wrap(bar.label, 48) : [];
		const top = cursor + lines.length * LINE_H;
		cursor = top + BAR_H + GAP;
		return { bar, lines, top };
	});
	const H = cursor - GAP + PAD;

	return (
		<DiagramFrame spec={spec} width={W} height={H}>
			{rows.map(({ bar, lines, top }, i) => {
				const cellW = BAR_W / bar.parts;
				const base = i * 0.18;
				// Enough shaded cells to count one by one, but 24 of them must not take four
				// seconds, so the whole sweep is budgeted rather than the individual step.
				const step = bar.shaded > 0 ? Math.min(0.09, 0.6 / bar.shaded) : 0;

				return (
					<g key={i}>
						{/* Shading is the datum, so it arrives cell by cell - that reading IS the
						    fraction being counted out. */}
						{Array.from({ length: bar.shaded }, (_, c) => (
							<Appear key={`s-${c}`} animate={moving} delay={base + 0.45 + c * step}>
								<rect
									x={round(BAR_X + c * cellW, 2)}
									y={top}
									width={round(cellW, 2)}
									height={BAR_H}
									{...SOFT_FILL}
								/>
							</Appear>
						))}

						{/* The outline draws itself first - it is the whole the parts are parts of. */}
						<DrawPath
							d={`M ${BAR_X} ${top} L ${BAR_X + BAR_W} ${top}`
								+ ` L ${BAR_X + BAR_W} ${top + BAR_H} L ${BAR_X} ${top + BAR_H} Z`}
							animate={moving}
							delay={base}
							{...STROKE}
						/>

						<Appear animate={moving} delay={base + 0.3}>
							{Array.from({ length: bar.parts - 1 }, (_, c) => (
								<line
									key={`d-${c}`}
									x1={round(BAR_X + (c + 1) * cellW, 2)}
									y1={top}
									x2={round(BAR_X + (c + 1) * cellW, 2)}
									y2={top + BAR_H}
									{...STROKE}
								/>
							))}
						</Appear>

						{/* The fraction, written as it is written on a board. */}
						<Appear animate={moving} delay={base + 0.55}>
							<text x={GUTTER_CX} y={top + 13} textAnchor="middle" {...LABEL}>
								{bar.shaded}
							</text>
							<line
								x1={GUTTER_CX - 10} y1={top + 16} x2={GUTTER_CX + 10} y2={top + 16}
								{...STROKE}
							/>
							<text x={GUTTER_CX} y={top + 28} textAnchor="middle" {...LABEL}>
								{bar.parts}
							</text>
						</Appear>

						{lines.length > 0 && (
							<Appear animate={moving} delay={base + 0.55}>
								{lines.map((line, li) => (
									<text
										key={li}
										x={BAR_X}
										y={top - (lines.length - li) * LINE_H + 7}
										{...LABEL_SM}
									>
										{line}
									</text>
								))}
							</Appear>
						)}
					</g>
				);
			})}
		</DiagramFrame>
	);
}
