"use client";

/**
 * A Singapore-style bar model - the picture a word problem is solved with before any algebra.
 *
 * ## The proportion is the method
 *
 * The whole technique is "look, this bar is twice that one", so bar length is strictly
 * `value / maxValue` of one shared full width. Nothing is nudged: there is deliberately no minimum
 * width, because a bar of 1 against a bar of 100 SHOULD be a sliver. Rounding a sliver up to
 * something readable would make the picture lie about the very relation it exists to show.
 *
 * ## Where a label goes is decided per bar
 *
 * Inside the bar when it fits, beside it when the bar is too short to hold it, and above it when
 * the name is long enough that neither works. All three are how a textbook prints it, and the
 * alternative - one fixed position - either overflows the short bars or wastes the page.
 */

import * as React from "react";
import { round, scale, type BarModelSpec } from "@repo/core/diagram";
import { motion } from "framer-motion";
import {
	Appear, DrawPath, LABEL, LABEL_SM, SOFT_FILL, STROKE,
	useDiagramMotion, DiagramFrame, DRAW,
} from "./canvas";

const W = 320;
const BAR_X = 14;
const RIGHT_EDGE = W - 14;
const FULL_W = RIGHT_EDGE - BAR_X;
const BAR_H = 30;
const GAP = 14;
const PAD = 14;
const LINE_H = 13;

const r2 = (v: number): number => round(v, 2);

/** Rough advance width. Enough to choose between three placements; never used as a coordinate. */
function textW(s: string, size: number): number {
	return s.length * size * 0.55;
}

function widest(lines: string[], size: number): number {
	return lines.reduce((m, l) => Math.max(m, textW(l, size)), 0);
}

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

/** An underbrace from `x0` to `x1`, tips up, point down. Shallow on a short span so it stays a brace. */
function underBrace(x0: number, x1: number, y: number): string {
	const d = Math.min(6, Math.max(1, (x1 - x0) / 4));
	const mid = (x0 + x1) / 2;
	return `M ${r2(x0)} ${r2(y)} Q ${r2(x0)} ${r2(y + d)} ${r2(x0 + d)} ${r2(y + d)}`
		+ ` L ${r2(mid - d)} ${r2(y + d)}`
		+ ` Q ${r2(mid)} ${r2(y + d)} ${r2(mid)} ${r2(y + 2 * d)}`
		+ ` Q ${r2(mid)} ${r2(y + d)} ${r2(mid + d)} ${r2(y + d)}`
		+ ` L ${r2(x1 - d)} ${r2(y + d)}`
		+ ` Q ${r2(x1)} ${r2(y + d)} ${r2(x1)} ${r2(y)}`;
}

export function BarModel({ spec, animate }: { spec: BarModelSpec; animate?: boolean }) {
	const moving = useDiagramMotion(animate);

	const maxValue = spec.bars.reduce((m, b) => Math.max(m, b.value), 0) || 1;
	const len = scale([0, maxValue], [0, FULL_W]);

	let cursor = PAD;
	const rows = spec.bars.map((bar) => {
		const barW = r2(len(bar.value));
		const valueTxt = String(round(bar.value, 2));
		const valueW = textW(valueTxt, 9.5);
		const valueInside = barW >= valueW + 16;
		const labelW = textW(bar.label, 11);

		const innerRoom = barW - 12 - (valueInside ? valueW + 8 : 0);
		const besideX = BAR_X + barW + 8 + (valueInside ? 0 : valueW + 8);
		const besideRoom = RIGHT_EDGE - besideX;
		const place = labelW <= innerRoom ? "inside" : labelW <= besideRoom ? "beside" : "above";

		const aboveLines = place === "above" ? wrap(bar.label, 46) : [];
		const braceLines = bar.brace ? wrap(bar.brace, 44) : [];
		const top = cursor + aboveLines.length * LINE_H;
		const braceH = braceLines.length > 0 ? 20 + braceLines.length * 11 : 0;
		cursor = top + BAR_H + braceH + GAP;

		return {
			bar, barW, valueTxt, valueInside, valueW, place, aboveLines, braceLines, top,
			// Centred in whatever the value has not already taken.
			innerCx: BAR_X + (barW - (valueInside ? valueW + 8 : 0)) / 2,
			besideX,
			// A caption wider than the bar it belongs to cannot be centred on it: a bar worth 1
			// against a bar worth 100 is a few pixels at the far left, and a caption centred there
			// would either leave the canvas or, clamped, float away from the brace it names. Left
			// aligning it under the brace's own left tip keeps the two attached.
			braceWide: widest(braceLines, 9.5) > barW,
		};
	});

	const stackBottom = cursor - GAP;
	const totalLines = spec.total ? wrap(spec.total, 46) : [];
	const totalH = totalLines.length > 0 ? 23 + totalLines.length * 11 : 0;
	const H = stackBottom + totalH + PAD;

	return (
		<DiagramFrame spec={spec} width={W} height={H}>
			{rows.map((row, i) => {
				const { bar, barW, top } = row;
				const delay = i * 0.14;
				const grow = { ...DRAW, duration: 0.6, delay };

				return (
					<g key={i}>
						{/* Two rects rather than one: a filled body and a drawn outline, so the fill
						    stays a soft datum instead of fading the stroke with it. */}
						{moving ? (
							<>
								<motion.rect
									x={BAR_X} y={top} height={BAR_H}
									initial={{ width: 0 }} animate={{ width: barW }} transition={grow}
									{...SOFT_FILL}
								/>
								<motion.rect
									x={BAR_X} y={top} height={BAR_H}
									initial={{ width: 0 }} animate={{ width: barW }} transition={grow}
									{...(STROKE as React.ComponentProps<typeof motion.rect>)}
								/>
							</>
						) : (
							<>
								<rect x={BAR_X} y={top} width={barW} height={BAR_H} {...SOFT_FILL} />
								<rect x={BAR_X} y={top} width={barW} height={BAR_H} {...STROKE} />
							</>
						)}

						<Appear animate={moving} delay={delay + 0.55}>
							<text
								x={row.valueInside ? r2(BAR_X + barW - 6) : r2(BAR_X + barW + 6)}
								y={top + BAR_H / 2 + 3.5}
								textAnchor={row.valueInside ? "end" : "start"}
								{...LABEL_SM}
							>
								{row.valueTxt}
							</text>

							{row.place === "inside" && (
								<text x={r2(row.innerCx)} y={top + BAR_H / 2 + 4} textAnchor="middle" {...LABEL}>
									{bar.label}
								</text>
							)}
							{row.place === "beside" && (
								<text x={r2(row.besideX)} y={top + BAR_H / 2 + 4} {...LABEL}>
									{bar.label}
								</text>
							)}
							{row.aboveLines.map((line, li) => (
								<text
									key={li}
									x={BAR_X}
									y={top - (row.aboveLines.length - li) * LINE_H + 7}
									{...LABEL}
								>
									{line}
								</text>
							))}
						</Appear>

						{row.braceLines.length > 0 && (
							<>
								<DrawPath
									d={underBrace(BAR_X, BAR_X + barW, top + BAR_H + 4)}
									animate={moving}
									delay={delay + 0.7}
									{...STROKE}
								/>
								<Appear animate={moving} delay={delay + 0.95}>
									{row.braceLines.map((line, li) => (
										<text
											key={li}
											x={row.braceWide ? BAR_X : r2(BAR_X + barW / 2)}
											y={top + BAR_H + 26 + li * 11}
											textAnchor={row.braceWide ? "start" : "middle"}
											{...LABEL_SM}
										>
											{line}
										</text>
									))}
								</Appear>
							</>
						)}
					</g>
				);
			})}

			{/* The total spans the longest bar, which by construction is the full width - that is
			    what makes it read as the whole the other bars are parts of. */}
			{totalLines.length > 0 && (
				<>
					<DrawPath
						d={underBrace(BAR_X, BAR_X + FULL_W, stackBottom + 6)}
						animate={moving}
						delay={rows.length * 0.14 + 0.8}
						{...STROKE}
					/>
					<Appear animate={moving} delay={rows.length * 0.14 + 1.05}>
						{totalLines.map((line, li) => (
							<text
								key={li}
								x={BAR_X + FULL_W / 2}
								y={stackBottom + 28 + li * 11}
								textAnchor="middle"
								{...LABEL}
							>
								{line}
							</text>
						))}
					</Appear>
				</>
			)}
		</DiagramFrame>
	);
}
