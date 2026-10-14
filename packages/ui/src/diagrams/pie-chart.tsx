"use client";

/**
 * A pie chart. Shares are computed from the values, so the picture can never disagree with the
 * numbers. Slices alternate fill opacity rather than hue, so the figure survives a one-colour
 * photocopy - the way most of these reach a student.
 */

import { pieAngles, polar, round, type PieChartSpec } from "@repo/core/diagram";
import { Appear, DrawPath, LABEL_SM, STROKE, useDiagramMotion, DiagramFrame } from "./canvas";

const W = 320, H = 190;
const CX = 105, CY = 95, R = 70;

function slicePath(start: number, end: number): string {
	const a = polar(CX, CY, R, start), b = polar(CX, CY, R, end);
	const large = end - start > Math.PI ? 1 : 0;
	return `M ${CX} ${CY} L ${round(a.x, 2)} ${round(a.y, 2)} A ${R} ${R} 0 ${large} 1 ${round(b.x, 2)} ${round(b.y, 2)} Z`;
}

export function PieChart({ spec, animate }: { spec: PieChartSpec; animate?: boolean }) {
	const moving = useDiagramMotion(animate);
	const angles = pieAngles(spec.slices.map((s) => s.value));
	const opacities = [0.32, 0.12, 0.22, 0.06, 0.28, 0.16];

	return (
		<DiagramFrame spec={spec} width={W} height={H}>
			{spec.slices.map((s, i) => {
				const { start, end, share } = angles[i]!;
				const d = share >= 0.999 ? `M ${CX - R} ${CY} A ${R} ${R} 0 1 0 ${CX + R} ${CY} A ${R} ${R} 0 1 0 ${CX - R} ${CY}` : slicePath(start, end);
				const mid = polar(CX, CY, R * 0.62, (start + end) / 2);
				return (
					<g key={i}>
						<Appear animate={moving} delay={i * 0.12}><path d={d} fill="currentColor" opacity={opacities[i % opacities.length]} /></Appear>
						<DrawPath d={d} animate={moving} delay={i * 0.12} {...STROKE} />
						{share >= 0.06 && (
							<Appear animate={moving} delay={0.4 + i * 0.12}>
								<text x={round(mid.x, 2)} y={round(mid.y + 3, 2)} textAnchor="middle" {...LABEL_SM}>{Math.round(share * 100)}%</text>
							</Appear>
						)}
					</g>
				);
			})}
			{spec.slices.map((s, i) => {
				const y = 40 + i * 20;
				return (
					<Appear key={`k-${i}`} animate={moving} delay={0.5 + i * 0.1}>
						<rect x={196} y={y - 8} width={10} height={10} fill="currentColor" opacity={opacities[i % opacities.length]} />
						<rect x={196} y={y - 8} width={10} height={10} {...STROKE} />
						<text x={212} y={y} {...LABEL_SM}>{s.label.length > 16 ? `${s.label.slice(0, 15)}…` : s.label} ({round(s.value, 2)})</text>
					</Appear>
				);
			})}
		</DiagramFrame>
	);
}
