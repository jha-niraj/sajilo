"use client";

/**
 * Place-value columns. The digits and the column values are COMPUTED from the number, so the
 * picture of 1011 in base two cannot say anything but 8 + 0 + 2 + 1 = 11. This is the figure the
 * binary lesson needed and the first fifteen kinds could not draw.
 */

import { placeValueColumns, placeValueBase, round, type PlaceValueSpec } from "@repo/core/diagram";
import { Appear, LABEL, LABEL_SM, SOFT_FILL, STROKE, useDiagramMotion, DiagramFrame } from "./canvas";

const W = 320;

export function PlaceValue({ spec, animate }: { spec: PlaceValueSpec; animate?: boolean }) {
	const moving = useDiagramMotion(animate);
	const base = placeValueBase(spec);
	const cols = placeValueColumns(spec.number, base);
	const n = cols.length;
	const colW = Math.min(48, (W - 28) / n);
	const left = round((W - colW * n) / 2, 2);
	const TOP = 22, HEAD = 22, CELL = 36;
	const total = cols.reduce((t, c) => t + c.digit * c.value, 0);
	const H = TOP + HEAD + CELL + 46;

	return (
		<DiagramFrame spec={spec} width={W} height={H}>
			{cols.map((c, i) => {
				const x = round(left + i * colW, 2);
				return (
					<g key={i}>
						<rect x={x} y={TOP} width={colW} height={HEAD} {...SOFT_FILL} />
						<rect x={x} y={TOP} width={colW} height={HEAD} {...STROKE} />
						<rect x={x} y={TOP + HEAD} width={colW} height={CELL} {...STROKE} />
						<text x={x + colW / 2} y={TOP + 14} textAnchor="middle" fontSize={8} fill="currentColor" opacity={0.8}>
							{base === 10 && c.value >= 1000 ? c.value.toLocaleString("en-IN") : c.name}
						</text>
						<Appear animate={moving} delay={0.2 + i * 0.12}>
							<text x={x + colW / 2} y={TOP + HEAD + 24} textAnchor="middle" fontSize={18} fontWeight={600} fill="currentColor">{c.digit}</text>
						</Appear>
					</g>
				);
			})}
			<Appear animate={moving} delay={0.4 + n * 0.12}>
				<text x={W / 2} y={TOP + HEAD + CELL + 20} textAnchor="middle" {...LABEL_SM}>
					{cols.map((c) => `${c.digit}×${c.value}`).join(" + ")} = {total}
				</text>
				<text x={W / 2} y={TOP + HEAD + CELL + 36} textAnchor="middle" {...LABEL}>
					{base === 2 ? `${spec.number.toString(2)} in binary is ${spec.number}` : `${spec.number.toLocaleString("en-IN")}`}
				</text>
			</Appear>
		</DiagramFrame>
	);
}
