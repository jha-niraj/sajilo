"use client";

/**
 * A table as a figure. Columns share the width; a highlighted row carries a wash. Cells are cut to
 * their column, never allowed to run into the next one.
 */

import { round, type TableSpec } from "@repo/core/diagram";
import { Appear, LABEL, LABEL_SM, SOFT_FILL, STROKE, useDiagramMotion, DiagramFrame } from "./canvas";

const W = 320, PAD = 10, ROW = 20, HEAD = 22;

function fit(text: string, px: number): string {
	const max = Math.max(3, Math.floor(px / 5.6));
	return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

export function TableDiagram({ spec, animate }: { spec: TableSpec; animate?: boolean }) {
	const moving = useDiagramMotion(animate);
	const n = spec.columns.length;
	const colW = (W - 2 * PAD) / n;
	const H = PAD + HEAD + spec.rows.length * ROW + PAD;

	return (
		<DiagramFrame spec={spec} width={W} height={H}>
			<rect x={PAD} y={PAD} width={W - 2 * PAD} height={HEAD} {...SOFT_FILL} />
			{spec.highlightRow !== undefined && (
				<rect x={PAD} y={PAD + HEAD + spec.highlightRow * ROW} width={W - 2 * PAD} height={ROW} fill="currentColor" opacity={0.08} />
			)}
			<rect x={PAD} y={PAD} width={W - 2 * PAD} height={HEAD + spec.rows.length * ROW} {...STROKE} />
			<line x1={PAD} y1={PAD + HEAD} x2={W - PAD} y2={PAD + HEAD} {...STROKE} />
			{spec.columns.slice(1).map((_, i) => (
				<line key={i} x1={round(PAD + colW * (i + 1), 2)} y1={PAD} x2={round(PAD + colW * (i + 1), 2)} y2={PAD + HEAD + spec.rows.length * ROW} stroke="currentColor" strokeWidth={0.5} opacity={0.5} />
			))}
			{spec.columns.map((c, i) => (
				<text key={i} x={round(PAD + colW * i + colW / 2, 2)} y={PAD + 15} textAnchor="middle" fontWeight={600} {...LABEL}>{fit(c, colW - 8)}</text>
			))}
			{spec.rows.map((r, ri) => (
				<Appear key={ri} animate={moving} delay={0.15 + ri * 0.08}>
					{r.map((cell, ci) => (
						<text key={ci} x={round(PAD + colW * ci + colW / 2, 2)} y={PAD + HEAD + ri * ROW + 14} textAnchor="middle" {...LABEL_SM}>{fit(cell, colW - 8)}</text>
					))}
				</Appear>
			))}
		</DiagramFrame>
	);
}
