"use client";

/**
 * An array - rows and columns of dots for repeated addition, or of squares for area.
 *
 * ## The cell size comes from the counts, never the other way round
 *
 * A 2 by 3 array and a 12 by 12 array are both legal, and 144 cells at the size that suits six of
 * them would be a wall the width of a page. So the cell is solved for: it is the largest square
 * that fits both the available width and a sane height, capped so a tiny array does not blow up
 * into three enormous dots.
 *
 * ## The highlight is one ring, not N rings
 *
 * `highlight` means "the first N, taken together" - a group of six inside a four by five array is
 * how a division is shown before it is written. Ringing each cell separately would say the opposite,
 * that the six are six separate things. Because the first N in reading order are always some whole
 * rows plus part of one more, that group is an L, and the outline below is that L traced once.
 */

import { round, type ArraySpec } from "@repo/core/diagram";
import {
	Appear, ArrowDefs, DASH, DrawPath, EMPHASIS, LABEL, LABEL_SM,
	STROKE, diagramId, useDiagramMotion, DiagramFrame,
} from "./canvas";

const W = 320;
const LEFT = 44;      // room for the vertical row measure and its label
const RIGHT = 16;
const TOP = 34;       // room for the horizontal column measure and its label
const BOTTOM = 34;    // room for the "rows x cols = total" line

/**
 * The outline of the first `count` cells, taken in reading order.
 *
 * Whole rows give a rectangle; a part row on the end turns it into an L. `pad` pushes each edge
 * outwards, which is why the step corner moves down and right rather than being offset uniformly.
 */
function groupOutline(
	count: number, rows: number, cols: number,
	left: number, top: number, cell: number, pad: number,
): string | null {
	const n = Math.min(Math.floor(count), rows * cols);
	if (n <= 0) return null;

	const full = Math.floor(n / cols);
	const rem = n % cols;
	const x0 = round(left - pad, 2);
	const x1 = round(left + cols * cell + pad, 2);
	const yTop = round(top - pad, 2);

	if (rem === 0) {
		const yBot = round(top + full * cell + pad, 2);
		return `M ${x0} ${yTop} L ${x1} ${yTop} L ${x1} ${yBot} L ${x0} ${yBot} Z`;
	}

	const xRem = round(left + rem * cell + pad, 2);
	const yBot = round(top + (full + 1) * cell + pad, 2);
	if (full === 0) {
		return `M ${x0} ${yTop} L ${xRem} ${yTop} L ${xRem} ${yBot} L ${x0} ${yBot} Z`;
	}

	const yStep = round(top + full * cell + pad, 2);
	return `M ${x0} ${yTop} L ${x1} ${yTop} L ${x1} ${yStep}`
		+ ` L ${xRem} ${yStep} L ${xRem} ${yBot} L ${x0} ${yBot} Z`;
}

export function ArrayDiagram({ spec, animate }: { spec: ArraySpec; animate?: boolean }) {
	const id = diagramId(spec);
	const moving = useDiagramMotion(animate);

	const { rows, cols } = spec;
	const style = spec.style ?? "dots";
	const availW = W - LEFT - RIGHT;

	// Square cells, bounded by the width, by a height that still fits on a page, and by a cap so a
	// one-by-two array is a diagram rather than a poster.
	const cell = Math.min(30, availW / cols, 300 / rows);
	const gridW = cell * cols;
	const gridH = cell * rows;
	const left = LEFT + (availW - gridW) / 2;
	const top = TOP;
	const H = top + gridH + BOTTOM;

	const total = rows * cols;
	// One budget for the whole sweep, so 144 cells and 4 cells both finish in about the same time.
	const step = Math.min(0.04, 0.7 / total);
	const dotR = Math.min(cell * 0.26, 6);
	const ring = groupOutline(spec.highlight ?? 0, rows, cols, left, top, cell, 2);

	return (
		<DiagramFrame spec={spec} width={W} height={H}>
			<ArrowDefs id={id} />

			{/* The array itself, laid down first. */}
			{Array.from({ length: rows }, (_, r) =>
				Array.from({ length: cols }, (_, c) => {
					const cx = left + c * cell + cell / 2;
					const cy = top + r * cell + cell / 2;
					return (
						<Appear key={`${r}-${c}`} animate={moving} delay={0.15 + (r * cols + c) * step}>
							{style === "squares" ? (
								<rect
									x={round(left + c * cell, 2)}
									y={round(top + r * cell, 2)}
									width={round(cell, 2)}
									height={round(cell, 2)}
									{...STROKE}
								/>
							) : (
								<circle cx={round(cx, 2)} cy={round(cy, 2)} r={round(dotR, 2)} fill="currentColor" />
							)}
						</Appear>
					);
				}),
			)}

			{/* Counts on the outside, measured rather than merely written, so it is clear which
			    number belongs to which direction. */}
			<Appear animate={moving} delay={0.95}>
				<line
					x1={round(left, 2)} y1={top - 10} x2={round(left + gridW, 2)} y2={top - 10}
					{...DASH} markerStart={`url(#${id})`} markerEnd={`url(#${id})`}
				/>
				<text x={round(left + gridW / 2, 2)} y={top - 17} textAnchor="middle" {...LABEL_SM}>
					{cols} {cols === 1 ? "column" : "columns"}
				</text>

				<line
					x1={round(left - 14, 2)} y1={top} x2={round(left - 14, 2)} y2={round(top + gridH, 2)}
					{...DASH} markerStart={`url(#${id})`} markerEnd={`url(#${id})`}
				/>
				<text
					x={round(left - 24, 2)}
					y={round(top + gridH / 2, 2)}
					textAnchor="middle"
					transform={`rotate(-90 ${round(left - 24, 2)} ${round(top + gridH / 2, 2)})`}
					{...LABEL_SM}
				>
					{rows} {rows === 1 ? "row" : "rows"}
				</text>
			</Appear>

			{/* The ring goes on last: it is a reading of the array, so it has to arrive after it. */}
			{ring && (
				<DrawPath d={ring} animate={moving} delay={1.15} {...EMPHASIS} />
			)}

			<Appear animate={moving} delay={1.3}>
				<text x={round(left + gridW / 2, 2)} y={round(top + gridH + 22, 2)} textAnchor="middle" {...LABEL}>
					{rows} × {cols} = {total}
				</text>
			</Appear>
		</DiagramFrame>
	);
}
