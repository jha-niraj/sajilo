"use client";

/**
 * A number line.
 *
 * The first thing a child is shown for addition, and still the clearest way to explain a negative
 * temperature in class 8. Two jobs: mark values, and draw JUMPS between them, because "8 + 5" is
 * taught as a hop along the line long before it is written as a sum.
 */

import { scale, ticks, round, type NumberLineSpec } from "@repo/core/diagram";
import {
	Appear, ArrowDefs, DASH, DrawPath, EMPHASIS, LABEL, LABEL_SM, STROKE,
	diagramId, useDiagramMotion, DiagramFrame,
} from "./canvas";

export function NumberLine({ spec, animate }: { spec: NumberLineSpec; animate?: boolean }) {
	const id = diagramId(spec);
	const moving = useDiagramMotion(animate);

	const W = 320, H = 150;
	const left = 26, right = W - 26;
	// Low enough to leave room for jump arcs above, high enough for tick labels below.
	const y = 96;

	const x = scale([spec.from, spec.to], [left, right]);
	const tickValues = ticks(spec.from, spec.to, spec.step);
	const marks = spec.marks ?? [];

	return (
		<DiagramFrame spec={spec} width={W} height={H}>
			<ArrowDefs id={id} />

			{/* The line itself, drawn first - everything else refers to it. */}
			<DrawPath
				d={`M ${left - 8} ${y} L ${right + 8} ${y}`}
				animate={moving}
				{...STROKE}
				markerEnd={`url(#${id})`}
				markerStart={`url(#${id})`}
			/>

			{tickValues.map((t, i) => (
				<Appear key={`t-${t}`} animate={moving} delay={0.5 + i * 0.02}>
					<line x1={x(t)} y1={y - 5} x2={x(t)} y2={y + 5} {...STROKE} />
					<text x={x(t)} y={y + 19} textAnchor="middle" {...LABEL_SM}>{round(t, 2)}</text>
				</Appear>
			))}

			{/* Jumps above the line. Drawn as an arc so two consecutive hops stay readable. */}
			{marks.map((m, i) => {
				if (m.jumpTo === undefined) return null;
				const x0 = x(m.at), x1 = x(m.jumpTo);
				const lift = Math.min(38, Math.max(16, Math.abs(x1 - x0) * 0.45));
				const mid = (x0 + x1) / 2;
				return (
					<g key={`j-${i}`}>
						<DrawPath
							d={`M ${x0} ${y - 7} Q ${mid} ${y - 7 - lift} ${x1} ${y - 7}`}
							animate={moving}
							delay={0.8 + i * 0.35}
							{...EMPHASIS}
							markerEnd={`url(#${id})`}
						/>
						<Appear animate={moving} delay={1.4 + i * 0.35}>
							<text x={mid} y={y - 12 - lift} textAnchor="middle" {...LABEL}>
								{m.label ?? `+${round(m.jumpTo - m.at, 2)}`}
							</text>
						</Appear>
					</g>
				);
			})}

			{/* Plain marks sit ON the line, so they read as positions rather than as jumps. */}
			{marks.map((m, i) => {
				if (m.jumpTo !== undefined) return null;
				return (
					<Appear key={`m-${i}`} animate={moving} delay={0.9 + i * 0.15}>
						<circle cx={x(m.at)} cy={y} r={4} fill="currentColor" />
						<line x1={x(m.at)} y1={y} x2={x(m.at)} y2={y - 26} {...DASH} />
						<text x={x(m.at)} y={y - 31} textAnchor="middle" {...LABEL}>
							{m.label ?? round(m.at, 2)}
						</text>
					</Appear>
				);
			})}
		</DiagramFrame>
	);
}
