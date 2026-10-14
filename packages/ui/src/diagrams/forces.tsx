"use client";

/**
 * A free-body diagram - a labelled body with the forces acting on it drawn as arrows.
 *
 * ## Length is a pure function of magnitude, and that is the whole point
 *
 * "Balanced forces" is something a student is expected to READ OFF the picture: two arrows of the
 * same length pulling opposite ways means the object does not accelerate. So the length of an
 * arrow depends on nothing but its own `magnitude` - not on the largest force present, not on the
 * direction, not on how much room is left on that side. Normalising against the biggest arrow, or
 * shortening the horizontal ones because their labels are wider, would silently turn a balanced
 * diagram into an unbalanced one. Labels are truncated instead; arrows never are.
 *
 * ## Two forces in the same direction
 *
 * Drawn side by side, offset along the perpendicular, rather than one on top of the other. The
 * offset is capped to the body's own half-width so every arrow still starts ON the body it acts on.
 */

import { round, type ForcesSpec } from "@repo/core/diagram";
import {
	Appear, ArrowDefs, DrawPath, EMPHASIS, LABEL, STROKE,
	diagramId, useDiagramMotion, DiagramFrame,
} from "./canvas";

type Direction = ForcesSpec["arrows"][number]["direction"];

const DIRS: Record<Direction, { x: number; y: number }> = {
	up: { x: 0, y: -1 },
	down: { x: 0, y: 1 },
	left: { x: -1, y: 0 },
	right: { x: 1, y: 0 },
};

/** Arrow lengths, in pixels. `MIN` keeps a very small force visible as an arrow rather than a nub. */
const MAX_LEN = 62, MIN_LEN = 18, DEFAULT_LEN = 48;

/** The one place a magnitude becomes a length. Same input, same output, in every direction. */
function lengthOf(magnitude: number | undefined): number {
	return magnitude === undefined ? DEFAULT_LEN : Math.max(MIN_LEN, round(magnitude * MAX_LEN, 2));
}

function clip(text: string, max: number): string {
	return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

const textWidth = (text: string): number => text.length * 6.2;

/** Break the body's name onto at most two lines so a long one does not burst its box. */
function wrap(text: string, per = 14): string[] {
	if (text.length <= per) return [text];
	const lines: string[] = [];
	let cur = "";
	for (const w of text.split(" ")) {
		if (`${cur} ${w}`.trim().length > per && cur) { lines.push(cur); cur = w; }
		else cur = `${cur} ${w}`.trim();
	}
	if (cur) lines.push(cur);
	return lines.slice(0, 2).map((l) => clip(l, 16));
}

export function Forces({ spec, animate }: { spec: ForcesSpec; animate?: boolean }) {
	const id = diagramId(spec);
	const moving = useDiagramMotion(animate);

	const W = 320, H = 230;
	const cx = W / 2, cy = H / 2;

	const bodyLines = spec.body ? wrap(spec.body) : [];
	const widest = bodyLines.reduce((m, l) => Math.max(m, textWidth(l)), 0);
	const bw = Math.min(116, Math.max(76, widest + 24));
	const bh = 46;

	// Group by direction first: an arrow needs to know how many others share its side before it
	// knows where to sit.
	const order: Direction[] = ["up", "down", "left", "right"];
	const grouped = order.map((d) => ({
		d,
		items: spec.arrows.map((a, i) => ({ a, i })).filter(({ a }) => a.direction === d),
	}));

	return (
		<DiagramFrame spec={spec} width={W} height={H}>
			<ArrowDefs id={id} />

			{/* The body, drawn first - the arrows act on it, so it has to be there to act on. */}
			<Appear animate={moving} delay={0}>
				<rect x={cx - bw / 2} y={cy - bh / 2} width={bw} height={bh} rx={6} {...STROKE} />
				{bodyLines.map((line, li) => (
					<text
						key={li}
						x={cx}
						y={cy + (bodyLines.length === 1 ? 4 : li === 0 ? -2 : 12)}
						textAnchor="middle"
						{...LABEL}
					>
						{line}
					</text>
				))}
			</Appear>

			{grouped.map(({ d, items }) => {
				const vertical = d === "up" || d === "down";
				// Two different halves of the same box: one is how far out the face is, the other
				// is how much of that face there is to spread along.
				const alongHalf = vertical ? bh / 2 : bw / 2;
				const spreadHalf = vertical ? bw / 2 : bh / 2;
				// Spread across the whole face the arrows leave from, never past its edge.
				const spread = items.length > 1 ? ((spreadHalf - 9) * 2) / (items.length - 1) : 0;
				// Side-by-side arrows put their labels side by side too, so the name has to fit in
				// the gap. Arrows sharing a horizontal direction stack their labels vertically
				// instead, where they are never each other's neighbours.
				const budget = vertical && items.length > 1
					? Math.max(4, Math.min(14, Math.floor(spread / 6.2)))
					: 14;

				return items.map(({ a, i }, j) => {
					const v = DIRS[d];
					const off = (j - (items.length - 1) / 2) * spread;
					const len = lengthOf(a.magnitude);
					const sx = round(cx + (vertical ? off : v.x * alongHalf), 2);
					const sy = round(cy + (vertical ? v.y * alongHalf : off), 2);
					const tx = round(sx + v.x * len, 2);
					const ty = round(sy + v.y * len, 2);

					const text = clip(a.label, budget);
					const w = textWidth(text);
					// A vertical arrow is labelled past its tip. A horizontal one is labelled above
					// its tip and pushed clear of the body, so a short arrow does not print its
					// name across the box.
					const rawX = vertical
						? sx
						: d === "right"
							? Math.max(tx, cx + bw / 2 + w / 2 + 6)
							: Math.min(tx, cx - bw / 2 - w / 2 - 6);
					const lx = round(Math.min(Math.max(rawX, w / 2 + 5), W - w / 2 - 5), 2);
					const ly = round(vertical ? ty + (d === "up" ? -9 : 17) : sy - 9, 2);

					return (
						<g key={`f-${i}`}>
							<DrawPath
								d={`M ${sx} ${sy} L ${tx} ${ty}`}
								animate={moving}
								delay={0.35 + i * 0.18}
								{...EMPHASIS}
								markerEnd={`url(#${id})`}
							/>
							<Appear animate={moving} delay={0.9 + i * 0.18}>
								<text x={lx} y={ly} textAnchor="middle" {...LABEL}>{text}</text>
							</Appear>
						</g>
					);
				});
			})}
		</DiagramFrame>
	);
}
