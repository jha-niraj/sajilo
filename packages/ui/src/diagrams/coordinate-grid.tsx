"use client";

/**
 * A coordinate grid with integer lines, both axes through the origin when it is in range, and
 * plotted points - optionally joined in order for a shape or a translation. Every line is on an
 * integer, every point is where its coordinates say; nothing is nudged to look tidy.
 */

import { round, scale, type CoordinateGridSpec } from "@repo/core/diagram";
import { Appear, DrawPath, LABEL_SM, STROKE, useDiagramMotion, DiagramFrame } from "./canvas";

const W = 320, H = 220;
const PAD = 22;

export function CoordinateGrid({ spec, animate }: { spec: CoordinateGridSpec; animate?: boolean }) {
	const moving = useDiagramMotion(animate);
	const [x0, x1] = spec.xRange, [y0, y1] = spec.yRange;
	const span = Math.max(x1 - x0, y1 - y0);
	const size = Math.min(W - 2 * PAD, H - 2 * PAD);
	const unit = size / span;
	const gx = scale([x0, x1], [PAD, PAD + (x1 - x0) * unit]);
	const gy = scale([y0, y1], [PAD + (y1 - y0) * unit, PAD]);
	const xs = Array.from({ length: x1 - x0 + 1 }, (_, i) => x0 + i);
	const ys = Array.from({ length: y1 - y0 + 1 }, (_, i) => y0 + i);
	const labelEvery = span > 10 ? 2 : 1;
	const pts = spec.points ?? [];
	const axisY = y0 <= 0 && y1 >= 0 ? gy(0) : gy(y0);
	const axisX = x0 <= 0 && x1 >= 0 ? gx(0) : gx(x0);

	return (
		<DiagramFrame spec={spec} width={W} height={PAD * 2 + (y1 - y0) * unit + 8}>
			{xs.map((x) => <line key={`vx${x}`} x1={round(gx(x), 2)} y1={gy(y1)} x2={round(gx(x), 2)} y2={gy(y0)} stroke="currentColor" strokeWidth={0.4} opacity={0.25} />)}
			{ys.map((y) => <line key={`hy${y}`} x1={gx(x0)} y1={round(gy(y), 2)} x2={gx(x1)} y2={round(gy(y), 2)} stroke="currentColor" strokeWidth={0.4} opacity={0.25} />)}
			<line x1={gx(x0)} y1={round(axisY, 2)} x2={gx(x1)} y2={round(axisY, 2)} {...STROKE} />
			<line x1={round(axisX, 2)} y1={gy(y1)} x2={round(axisX, 2)} y2={gy(y0)} {...STROKE} />
			{xs.filter((x) => x % labelEvery === 0 && x !== 0).map((x) => (
				<text key={`lx${x}`} x={round(gx(x), 2)} y={round(axisY + 11, 2)} textAnchor="middle" {...LABEL_SM}>{x}</text>
			))}
			{ys.filter((y) => y % labelEvery === 0 && y !== 0).map((y) => (
				<text key={`ly${y}`} x={round(axisX - 4, 2)} y={round(gy(y) + 3, 2)} textAnchor="end" {...LABEL_SM}>{y}</text>
			))}
			{spec.connect && pts.length > 1 && (
				<DrawPath d={pts.map((p, i) => `${i ? "L" : "M"} ${round(gx(p.x), 2)} ${round(gy(p.y), 2)}`).join(" ") + (pts.length > 2 ? " Z" : "")} animate={moving} {...STROKE} strokeWidth={1.6} />
			)}
			{pts.map((p, i) => (
				<Appear key={i} animate={moving} delay={0.3 + i * 0.12}>
					<circle cx={round(gx(p.x), 2)} cy={round(gy(p.y), 2)} r={3.2} fill="currentColor" />
					<text x={round(gx(p.x) + 5, 2)} y={round(gy(p.y) - 5, 2)} {...LABEL_SM}>{p.label ?? `(${p.x}, ${p.y})`}</text>
				</Appear>
			))}
		</DiagramFrame>
	);
}
