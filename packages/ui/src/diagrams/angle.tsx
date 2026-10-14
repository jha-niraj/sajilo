"use client";

/**
 * An angle - two rays from one vertex, with the opening marked and measured.
 *
 * ## A right angle is drawn as a square, never as an arc
 *
 * Every textbook marks 90 degrees with the small square corner, and a student is expected to READ
 * that square as "this is a right angle" without a number beside it. Drawing an arc there would be
 * a different, weaker claim about the same picture, so 90 degrees gets the square and everything
 * else gets the arc.
 *
 * ## The vertex is placed by the angle, not by the canvas
 *
 * Centring the vertex is the obvious thing and it is wrong at both ends: a 30 degree angle then
 * wastes the whole left half of the canvas, and a 350 degree one runs off it. So the sector's own
 * bounding box is computed first - the two rays plus whichever of the four compass directions the
 * sweep passes through - and the vertex is placed so that box lands centred and whole.
 */

import { round, type AngleSpec } from "@repo/core/diagram";
import {
	Appear, ArrowDefs, DrawPath, EMPHASIS, LABEL, STROKE,
	diagramId, useDiagramMotion, DiagramFrame,
} from "./canvas";

const rad = (deg: number): number => (deg * Math.PI) / 180;

/** Unit vector at `deg`, measured anticlockwise from east. SVG y grows downwards, hence the -sin. */
function dir(deg: number): { x: number; y: number } {
	return { x: Math.cos(rad(deg)), y: -Math.sin(rad(deg)) };
}

/** A ray name may be 80 characters; a tip label has room for ten of them. */
function clip(text: string, max: number): string {
	return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

/** Roughly how wide a label renders at the shared 11px label size. */
const textWidth = (text: string): number => text.length * 6.2;

export function Angle({ spec, animate }: { spec: AngleSpec; animate?: boolean }) {
	const id = diagramId(spec);
	const moving = useDiagramMotion(animate);

	const W = 320, H = 220;
	const deg = spec.degrees;
	// A hair of tolerance: an angle arriving as 89.999 from a calculation is still the square.
	const isRight = Math.abs(deg - 90) < 0.5;

	const rayNames: [string, string] | null = spec.rays
		? [clip(spec.rays[0], 10), clip(spec.rays[1], 10)]
		: null;

	// The sector spans from the ray at 0 to the ray at `deg`, so its extremes are the two ray tips
	// plus any compass direction the sweep crosses on the way.
	const corners = [{ x: 0, y: 0 }, dir(0), dir(deg)];
	for (const a of [90, 180, 270]) if (a < deg) corners.push(dir(a));
	const minX = Math.min(...corners.map((p) => p.x));
	const maxX = Math.max(...corners.map((p) => p.x));
	const minY = Math.min(...corners.map((p) => p.y));
	const maxY = Math.max(...corners.map((p) => p.y));

	// Room kept beyond the tips for the ray names, so fitting the sector can never push one of them
	// off the canvas - the shape shrinks instead of the label being clipped.
	const namePad = rayNames ? Math.max(textWidth(rayNames[0]), textWidth(rayNames[1])) + 14 : 0;
	const padX = 16 + namePad, padY = 26;
	const boxW = W - 2 * padX, boxH = H - 2 * padY;
	const r = Math.min(96, boxW / (maxX - minX), boxH / (maxY - minY));

	const vx = padX + (boxW - (maxX - minX) * r) / 2 - minX * r;
	const vy = padY + (boxH - (maxY - minY) * r) / 2 - minY * r;
	const at = (a: number, radius: number) => {
		const d = dir(a);
		return { x: round(vx + d.x * radius, 2), y: round(vy + d.y * radius, 2) };
	};

	const tipA = at(0, r), tipB = at(deg, r);
	const arcR = Math.max(20, Math.min(42, r * 0.36));
	const arcStart = at(0, arcR), arcEnd = at(deg, arcR);
	// Sweep 0 is anticlockwise on screen, which is the direction the angle is measured in.
	const arcD = `M ${arcStart.x} ${arcStart.y} A ${arcR} ${arcR} 0 ${deg > 180 ? 1 : 0} 0 ${arcEnd.x} ${arcEnd.y}`;

	const sq = Math.min(arcR * 0.62, 22);
	const c1 = at(0, sq), c2 = at(90, sq);
	const squareD = `M ${c1.x} ${c1.y} L ${round(c1.x + c2.x - vx, 2)} ${round(c1.y + c2.y - vy, 2)} L ${c2.x} ${c2.y}`;

	const measure = spec.label ?? `${round(deg, 1)}°`;

	// Where the measurement goes. It sits on the bisector, and the only question is at what radius:
	// the label must be wholly INSIDE the arc or wholly outside it, never straddling the line, and
	// it must clear both rays. The wedge widens as `R tan(deg/2)`, so both tests are one formula.
	// Past 180 degrees the reflex side is the open one and no ray is anywhere near the bisector.
	const halfW = textWidth(measure) / 2;
	const tanHalf = deg >= 180 ? Number.POSITIVE_INFINITY : Math.tan(rad(deg / 2));
	// The right angle's barrier is the square's far corner, not an arc.
	const barrier = isRight ? sq * Math.SQRT2 : arcR;
	const insideR = barrier - 3 - halfW;
	const outsideR = Math.max(barrier + 3 + halfW, halfW + 7 / tanHalf);
	const fitsInside = !isRight && insideR > 8 && insideR >= halfW - 2
		&& (insideR - halfW) * tanHalf >= 7;
	// A very narrow angle has no room for the text between its rays at any radius, so the label
	// steps sideways out of the wedge rather than being printed across a ray.
	const asideOf = !fitsInside && outsideR > r - 8;
	const labelR = fitsInside ? insideR : asideOf ? arcR + 14 : outsideR;
	const aside = asideOf ? dir(deg / 2 - 90) : { x: 0, y: 0 };
	const spot = at(deg / 2, labelR);
	const labelAt = {
		x: round(Math.min(Math.max(spot.x + aside.x * 13, halfW + 5), W - halfW - 5), 2),
		y: round(Math.min(Math.max(spot.y + aside.y * 13, 14), H - 6), 2),
	};

	const nameAt = (a: number) => {
		const d = dir(a);
		const p = at(a, r + 11);
		return {
			x: p.x,
			y: round(p.y + (d.y < -0.35 ? -3 : d.y > 0.35 ? 11 : 4), 2),
			anchor: d.x > 0.35 ? "start" : d.x < -0.35 ? "end" : "middle",
		} as const;
	};
	const nameA = nameAt(0), nameB = nameAt(deg);

	return (
		<DiagramFrame spec={spec} width={W} height={H}>
			<ArrowDefs id={id} />

			{/* The rays, arrowheaded because a ray carries on. Drawn first - everything else is
			    measured against them. */}
			<DrawPath
				d={`M ${round(vx, 2)} ${round(vy, 2)} L ${tipA.x} ${tipA.y}`}
				animate={moving}
				{...STROKE}
				markerEnd={`url(#${id})`}
			/>
			<DrawPath
				d={`M ${round(vx, 2)} ${round(vy, 2)} L ${tipB.x} ${tipB.y}`}
				animate={moving}
				delay={0.25}
				{...STROKE}
				markerEnd={`url(#${id})`}
			/>

			{/* The opening: the square corner at 90, the arc everywhere else. */}
			<DrawPath d={isRight ? squareD : arcD} animate={moving} delay={0.75} {...EMPHASIS} />

			<circle cx={round(vx, 2)} cy={round(vy, 2)} r={2.6} fill="currentColor" />

			<Appear animate={moving} delay={1.3}>
				<text x={labelAt.x} y={round(labelAt.y + 4, 2)} textAnchor="middle" {...LABEL}>
					{measure}
				</text>
			</Appear>

			{rayNames && (
				<Appear animate={moving} delay={1.5}>
					<text x={nameA.x} y={nameA.y} textAnchor={nameA.anchor} {...LABEL}>{rayNames[0]}</text>
					<text x={nameB.x} y={nameB.y} textAnchor={nameB.anchor} {...LABEL}>{rayNames[1]}</text>
				</Appear>
			)}
		</DiagramFrame>
	);
}
