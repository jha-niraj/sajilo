"use client";

/**
 * The division ladder: repeated division with the remainder beside each row and the answer read
 * upwards. Every number is COMPUTED from `number` and `base`, so the ladder for 46 in base 2 can
 * only ever say 23 r0, 11 r1, 5 r1, 2 r1, 1 r0, 0 r1 and 101110. This is the worked example every
 * base-conversion page needs and a painted picture gets wrong one time in five.
 */

import { divisionLadderRows, baseDigit, round, type DivisionLadderSpec } from "@repo/core/diagram";
import { Appear, LABEL, LABEL_SM, SOFT_FILL, STROKE, useDiagramMotion, DiagramFrame } from "./canvas";

const W = 320;

export function DivisionLadder({ spec, animate }: { spec: DivisionLadderSpec; animate?: boolean }) {
	const moving = useDiagramMotion(animate);
	const rows = divisionLadderRows(spec.number, spec.base);
	const ROW = 22, TOP = 18, LEFT = 70;
	const digits = rows.map((r) => baseDigit(r.remainder)).reverse().join("");
	const H = TOP + (rows.length + 1) * ROW + 44;
	const baseW = 34, numW = 84, remW = 60;

	return (
		<DiagramFrame spec={spec} width={W} height={H}>
			<text x={LEFT + baseW + numW / 2} y={12} textAnchor="middle" {...LABEL_SM}>divide by {spec.base}</text>
			<text x={LEFT + baseW + numW + 14 + remW / 2} y={12} textAnchor="middle" {...LABEL_SM}>remainder</text>
			{rows.map((r, i) => {
				const y = TOP + i * ROW;
				return (
					<Appear key={i} animate={moving} delay={0.15 + i * 0.14}>
						<rect x={LEFT} y={y} width={baseW} height={ROW} {...SOFT_FILL} />
						<rect x={LEFT} y={y} width={baseW} height={ROW} {...STROKE} />
						<text x={LEFT + baseW / 2} y={y + 15} textAnchor="middle" {...LABEL}>{spec.base}</text>
						<rect x={LEFT + baseW} y={y} width={numW} height={ROW} {...STROKE} />
						<text x={LEFT + baseW + numW / 2} y={y + 15} textAnchor="middle" fontSize={12} fontWeight={600} fill="currentColor">{r.dividend}</text>
						<text x={LEFT + baseW + numW + 14 + remW / 2} y={y + 15} textAnchor="middle" fontSize={12} fontWeight={600} fill="currentColor">
							{r.remainder}{r.remainder >= 10 ? ` (${baseDigit(r.remainder)})` : ""}
						</text>
					</Appear>
				);
			})}
			<Appear animate={moving} delay={0.15 + rows.length * 0.14}>
				<rect x={LEFT + baseW} y={TOP + rows.length * ROW} width={numW} height={ROW} {...STROKE} />
				<text x={LEFT + baseW + numW / 2} y={TOP + rows.length * ROW + 15} textAnchor="middle" {...LABEL}>0</text>
				{/* The arrow up the remainder column: the answer is read from the bottom. */}
				<line x1={LEFT + baseW + numW + 14 + remW + 8} y1={round(TOP + rows.length * ROW - 4, 2)} x2={LEFT + baseW + numW + 14 + remW + 8} y2={TOP + 6} {...STROKE} />
				<polygon points={`${LEFT + baseW + numW + 14 + remW + 8},${TOP} ${LEFT + baseW + numW + 14 + remW + 4},${TOP + 8} ${LEFT + baseW + numW + 14 + remW + 12},${TOP + 8}`} fill="currentColor" />
				<text x={W / 2} y={TOP + (rows.length + 1) * ROW + 24} textAnchor="middle" {...LABEL}>
					{spec.number} = {digits} in base {spec.base}
				</text>
				<text x={W / 2} y={TOP + (rows.length + 1) * ROW + 38} textAnchor="middle" {...LABEL_SM}>read the remainders from the bottom up</text>
			</Appear>
		</DiagramFrame>
	);
}
