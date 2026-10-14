"use client";

/**
 * A bar chart - the data-handling figure the maths syllabus asks for from Class 4 up.
 *
 * Bars are strictly to scale of the largest value, with the value written above each. The axis is
 * drawn from zero, always: a bar chart that starts its axis elsewhere is the first lie a student
 * meets in statistics, and this one cannot tell it.
 */

import { round, scale, type BarChartSpec } from "@repo/core/diagram";
import { Appear, LABEL, LABEL_SM, SOFT_FILL, STROKE, useDiagramMotion, DiagramFrame } from "./canvas";
import { motion } from "framer-motion";

const W = 320, H = 190;
const LEFT = 30, RIGHT = 12, TOP = 18, BASE = H - 34;

export function BarChart({ spec, animate }: { spec: BarChartSpec; animate?: boolean }) {
	const moving = useDiagramMotion(animate);
	const max = spec.bars.reduce((m, b) => Math.max(m, b.value), 0) || 1;
	const y = scale([0, max], [BASE, TOP]);
	const n = spec.bars.length;
	const slot = (W - LEFT - RIGHT) / n;
	const barW = Math.min(44, slot * 0.62);

	return (
		<DiagramFrame spec={spec} width={W} height={H}>
			<line x1={LEFT} y1={TOP - 6} x2={LEFT} y2={BASE} {...STROKE} />
			<line x1={LEFT} y1={BASE} x2={W - RIGHT} y2={BASE} {...STROKE} />
			<text x={LEFT - 4} y={BASE + 3} textAnchor="end" {...LABEL_SM}>0</text>
			<text x={LEFT - 4} y={TOP + 3} textAnchor="end" {...LABEL_SM}>{round(max, 2)}</text>
			{spec.bars.map((b, i) => {
				const x = round(LEFT + slot * i + (slot - barW) / 2, 2);
				const top = round(y(b.value), 2);
				const h = round(BASE - top, 2);
				const label = b.label.length > 9 ? `${b.label.slice(0, 8)}…` : b.label;
				return (
					<g key={i}>
						{moving ? (
							<>
								<motion.rect x={x} width={barW} initial={{ y: BASE, height: 0 }} animate={{ y: top, height: h }} transition={{ duration: 0.6, delay: i * 0.1 }} {...SOFT_FILL} />
								<motion.rect x={x} width={barW} initial={{ y: BASE, height: 0 }} animate={{ y: top, height: h }} transition={{ duration: 0.6, delay: i * 0.1 }} {...(STROKE as object)} fill="none" />
							</>
						) : (
							<>
								<rect x={x} y={top} width={barW} height={h} {...SOFT_FILL} />
								<rect x={x} y={top} width={barW} height={h} {...STROKE} />
							</>
						)}
						<Appear animate={moving} delay={0.5 + i * 0.1}>
							<text x={x + barW / 2} y={top - 4} textAnchor="middle" {...LABEL_SM}>{round(b.value, 2)}{spec.unit ? ` ${spec.unit}` : ""}</text>
							<text x={x + barW / 2} y={BASE + 13} textAnchor="middle" {...LABEL}>{label}</text>
						</Appear>
					</g>
				);
			})}
		</DiagramFrame>
	);
}
