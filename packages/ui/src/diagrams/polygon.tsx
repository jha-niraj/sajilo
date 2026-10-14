"use client";

/**
 * A polygon - three to six vertices, named corners, measured sides.
 *
 * The caller gives the points as fractions of the canvas, so the SHAPE is the caller's decision:
 * a scalene triangle, a trapezium, an L of six corners. This file only has to draw whatever
 * arrives without any of the writing landing on top of it.
 *
 * ## Side labels sit outside, on the edge normal
 *
 * The obvious place for a side label is the midpoint of the edge, and that puts a number directly
 * on the line it is measuring. So each label is pushed out along the edge's normal, in the
 * direction that points AWAY from the centroid - which is the outside of the shape for every
 * polygon the validator accepts. Vertex names are pushed out from the centroid for the same
 * reason. A shape drawn hard against the edge of the canvas has no outside left on that side, so
 * there the label flips to the inside of the shape instead - which keeps it off the outline, where
 * clamping it back onto the canvas would have put it.
 */

import { round, toPath, type PolygonSpec } from "@repo/core/diagram";
import {
	Appear, DrawPath, EMPHASIS, LABEL, LABEL_SM, STROKE,
	useDiagramMotion, DiagramFrame,
} from "./canvas";

interface Pt { x: number; y: number }

/** Labels are free text up to 80 characters; a side of a triangle has room for a short one. */
function clip(text: string, max: number): string {
	return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

/** Roughly how wide a label renders at a given font size. */
const textWidth = (text: string, size: number): number => text.length * size * 0.57;

function unit(from: Pt, to: Pt): Pt {
	const dx = to.x - from.x, dy = to.y - from.y;
	const len = Math.hypot(dx, dy);
	// Two identical points would divide by zero; pointing east is arbitrary but finite, and the
	// validator lets a caller repeat a point.
	return len === 0 ? { x: 1, y: 0 } : { x: dx / len, y: dy / len };
}

export function Polygon({ spec, animate }: { spec: PolygonSpec; animate?: boolean }) {
	const moving = useDiagramMotion(animate);

	const W = 320, H = 240;
	const padX = 40, padY = 34;
	const innerW = W - 2 * padX, innerH = H - 2 * padY;

	const n = spec.points.length;
	const pts: Pt[] = spec.points.map((p) => ({
		x: round(padX + p.x * innerW, 2),
		y: round(padY + p.y * innerH, 2),
	}));
	/** Wrapping accessor - edge i runs from point i to point i+1, and the last edge closes. */
	const nth = (i: number): Pt => pts[((i % n) + n) % n] ?? { x: W / 2, y: H / 2 };

	const centroid: Pt = {
		x: pts.reduce((s, p) => s + p.x, 0) / n,
		y: pts.reduce((s, p) => s + p.y, 0) / n,
	};

	const anchorFor = (dx: number): "start" | "middle" | "end" =>
		dx > 0.3 ? "start" : dx < -0.3 ? "end" : "middle";

	/**
	 * Put a label `dist` away from `base`, on the outside of the shape.
	 *
	 * A shape drawn hard against the edge of the canvas has no outside left on that side, so the
	 * label flips to the INSIDE rather than being clamped back on top of the line it belongs to.
	 * Clamping is the last resort, and only when neither side has room.
	 */
	const put = (base: Pt, out: Pt, text: string, size: number, dist: number) => {
		const w = textWidth(text, size);
		const spots = [out, { x: -out.x, y: -out.y }].map((way) => {
			const anchor = anchorFor(way.x);
			const x = base.x + way.x * dist;
			const y = base.y + way.y * dist + (way.y > 0.3 ? size * 0.85 : way.y < -0.3 ? -2 : size * 0.37);
			const left = anchor === "start" ? x : anchor === "end" ? x - w : x - w / 2;
			return { x, y, anchor, left };
		});
		const chosen = spots.find((s) => s.left >= 4 && s.left + w <= W - 4 && s.y >= 12 && s.y <= H - 5)
			?? spots[0] ?? { x: base.x, y: base.y, anchor: "middle" as const, left: base.x };
		const shift = Math.max(0, 4 - chosen.left) - Math.max(0, chosen.left + w - (W - 4));
		return {
			x: round(chosen.x + shift, 2),
			y: round(Math.min(Math.max(chosen.y, 12), H - 5), 2),
			anchor: chosen.anchor,
		};
	};

	const outline = `${toPath(pts)} Z`;

	// The right-angle square is built from the two edges meeting at the vertex, so it leans with
	// the shape. Drawn as a parallelogram when the vertex is not actually square, which is honest:
	// the mark says what the caller claimed, and a wrong claim is then visible.
	let rightAngle: string | null = null;
	if (spec.rightAngleAt !== undefined) {
		const k = spec.rightAngleAt;
		const p = nth(k), prev = nth(k - 1), next = nth(k + 1);
		const u = unit(p, prev), v = unit(p, next);
		const s = Math.min(13, Math.hypot(prev.x - p.x, prev.y - p.y) * 0.3, Math.hypot(next.x - p.x, next.y - p.y) * 0.3);
		rightAngle = `M ${round(p.x + u.x * s, 2)} ${round(p.y + u.y * s, 2)}`
			+ ` L ${round(p.x + (u.x + v.x) * s, 2)} ${round(p.y + (u.y + v.y) * s, 2)}`
			+ ` L ${round(p.x + v.x * s, 2)} ${round(p.y + v.y * s, 2)}`;
	}

	return (
		<DiagramFrame spec={spec} width={W} height={H}>
			{/* One closed path, so the outline draws itself corner to corner in shape order. */}
			<DrawPath d={outline} animate={moving} {...STROKE} />

			{rightAngle && (
				<DrawPath d={rightAngle} animate={moving} delay={0.9} {...EMPHASIS} />
			)}

			{spec.points.map((p, i) => {
				if (!p.label) return null;
				const at = nth(i);
				const text = clip(p.label, 8);
				const spot = put(at, unit(centroid, at), text, 11, 14);
				return (
					<Appear key={`v-${i}`} animate={moving} delay={1.0 + i * 0.08}>
						<text x={spot.x} y={spot.y} textAnchor={spot.anchor} {...LABEL}>{text}</text>
					</Appear>
				);
			})}

			{(spec.sides ?? []).map((side, i) => {
				if (i >= n) return null;
				const a = nth(i), b = nth(i + 1);
				const mid: Pt = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
				const e = unit(a, b);
				// Both normals of an edge; the outward one points away from the centroid.
				const cand: Pt = { x: e.y, y: -e.x };
				const away = (mid.x - centroid.x) * cand.x + (mid.y - centroid.y) * cand.y >= 0;
				const nrm: Pt = away ? cand : { x: -cand.x, y: -cand.y };
				const text = clip(side, 14);
				const spot = put(mid, nrm, text, 9.5, 15);
				return (
					<Appear key={`s-${i}`} animate={moving} delay={1.25 + i * 0.08}>
						<text x={spot.x} y={spot.y} textAnchor={spot.anchor} {...LABEL_SM}>{text}</text>
					</Appear>
				);
			})}
		</DiagramFrame>
	);
}
