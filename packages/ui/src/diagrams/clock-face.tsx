"use client";

/**
 * A clock face. The hour hand moves WITH the minutes - at 10:40 it sits two-thirds of the way
 * from ten to eleven - which is exactly the thing students get wrong and the thing a drawn clock
 * must get right.
 */

import { polar, round, type ClockFaceSpec } from "@repo/core/diagram";
import { Appear, LABEL, LABEL_SM, STROKE, useDiagramMotion, DiagramFrame } from "./canvas";

const W = 320, CX = 160, CY = 92, R = 74;

export function ClockFace({ spec, animate }: { spec: ClockFaceSpec; animate?: boolean }) {
	const moving = useDiagramMotion(animate);
	const minuteAngle = -Math.PI / 2 + (spec.minute / 60) * Math.PI * 2;
	const hourAngle = -Math.PI / 2 + (((spec.hour % 12) + spec.minute / 60) / 12) * Math.PI * 2;
	const mh = polar(CX, CY, R * 0.82, minuteAngle);
	const hh = polar(CX, CY, R * 0.55, hourAngle);
	const H = spec.showDigital ? 200 : 182;

	return (
		<DiagramFrame spec={spec} width={W} height={H}>
			<circle cx={CX} cy={CY} r={R} {...STROKE} />
			{Array.from({ length: 60 }, (_, i) => {
				const a = -Math.PI / 2 + (i / 60) * Math.PI * 2;
				const major = i % 5 === 0;
				const o = polar(CX, CY, R - 1, a), n = polar(CX, CY, R - (major ? 8 : 4), a);
				return <line key={i} x1={round(o.x, 2)} y1={round(o.y, 2)} x2={round(n.x, 2)} y2={round(n.y, 2)} stroke="currentColor" strokeWidth={major ? 1.4 : 0.6} />;
			})}
			{Array.from({ length: 12 }, (_, i) => {
				const p = polar(CX, CY, R - 18, -Math.PI / 2 + ((i + 1) / 12) * Math.PI * 2);
				return <text key={i} x={round(p.x, 2)} y={round(p.y + 3.5, 2)} textAnchor="middle" {...LABEL}>{i + 1}</text>;
			})}
			<Appear animate={moving} delay={0.3}>
				<line x1={CX} y1={CY} x2={round(hh.x, 2)} y2={round(hh.y, 2)} stroke="currentColor" strokeWidth={3.2} strokeLinecap="round" />
			</Appear>
			<Appear animate={moving} delay={0.5}>
				<line x1={CX} y1={CY} x2={round(mh.x, 2)} y2={round(mh.y, 2)} stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
			</Appear>
			<circle cx={CX} cy={CY} r={3} fill="currentColor" />
			{spec.showDigital && (
				<Appear animate={moving} delay={0.8}>
					<text x={CX} y={CY + R + 22} textAnchor="middle" {...LABEL_SM}>{spec.hour}:{String(spec.minute).padStart(2, "0")}</text>
				</Appear>
			)}
		</DiagramFrame>
	);
}
