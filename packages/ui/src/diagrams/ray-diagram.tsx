"use client";

/**
 * Ray diagrams - convex and concave lenses, concave and convex mirrors.
 *
 * ## The image is solved for, never placed by eye
 *
 * Every position comes from the thin-lens or mirror equation in the Cartesian convention the
 * syllabus uses: origin at the optical centre or pole, +x along the incident light, so the object
 * sits at `u = -d` and `f` is positive only for a convex lens and a convex mirror. The two
 * construction rays are then drawn from their own geometry, and they cross exactly where the
 * equation says because both are the same physics. A picture with the image nudged to where it
 * looks right teaches that an object at 3F gives an image at 3F, which is the error the diagram
 * exists to prevent.
 *
 * ## Virtual is dashed, and that IS the lesson
 *
 * A virtual image is where the emerging rays only APPEAR to come from, so it is drawn dashed and
 * reached by dashed backward extensions, while a real image sits on solid rays that genuinely
 * meet. A reader who cannot see that difference has learned the wrong thing about a magnifying
 * glass, so the two cases are never drawn the same way.
 *
 * ## The vertical scale is not the horizontal one
 *
 * Distances are in focal lengths and heights are in object units - two different quantities - so
 * the axes are scaled independently and the vertical one is sized so the taller of object and
 * image just fits. The mapping stays affine, so rays stay straight and their intersection is
 * still the image.
 */

import { round, scale, toPath, type RayDiagramSpec } from "@repo/core/diagram";
import {
	Appear, ArrowDefs, DASH, DrawPath, EMPHASIS, LABEL, LABEL_SM, STROKE,
	diagramId, useDiagramMotion, DiagramFrame,
} from "./canvas";

interface Pt { x: number; y: number }
interface Box { x0: number; x1: number; y0: number; y1: number }

/** A virtual image, and the extensions that reach it. Dashed, but still the subject. */
const VIRTUAL = { ...EMPHASIS, strokeDasharray: "4 3" } as const;

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** Where a ray leaving `p` along `dir` crosses the edge of the drawing box. */
function exitAt(p: Pt, dir: Pt, box: Box): Pt {
	let t = Number.POSITIVE_INFINITY;
	if (dir.x > 0) t = Math.min(t, (box.x1 - p.x) / dir.x);
	if (dir.x < 0) t = Math.min(t, (box.x0 - p.x) / dir.x);
	if (dir.y > 0) t = Math.min(t, (box.y1 - p.y) / dir.y);
	if (dir.y < 0) t = Math.min(t, (box.y0 - p.y) / dir.y);
	if (!Number.isFinite(t) || t < 0) return p;
	return { x: round(p.x + dir.x * t, 2), y: round(p.y + dir.y * t, 2) };
}

export function RayDiagram({ spec, animate }: { spec: RayDiagramSpec; animate?: boolean }) {
	const id = diagramId(spec);
	const moving = useDiagramMotion(animate);

	const W = 320, H = 210;
	const cx = W / 2, cy = 100;
	const box: Box = { x0: 12, x1: W - 12, y0: 14, y1: H - 18 };

	const element = spec.element;
	const isMirror = element === "concaveMirror" || element === "convexMirror";
	const d = spec.objectDistance;
	const h0 = spec.objectHeight ?? 1;

	const f = element === "convexLens" || element === "convexMirror" ? 1 : -1;
	const u = -d;
	// Lens: 1/v - 1/u = 1/f. Mirror: 1/v + 1/u = 1/f. Same convention, different sign on u.
	const invV = isMirror ? 1 / f - 1 / u : 1 / f + 1 / u;
	const v = invV === 0 ? Number.POSITIVE_INFINITY : 1 / invV;
	// An object AT the focus of a converging element throws the image to infinity. Say that,
	// rather than dividing by a number that is merely nearly zero and drawing a picture that runs
	// off the page.
	const atInfinity = Math.abs(invV) < 0.02;
	const beyond = atInfinity || Math.abs(v) > 6.5;
	const m = isMirror ? -v / u : v / u;
	const hi = m * h0;
	const real = isMirror ? v < 0 : v > 0;

	// Fit the axis to whichever is further out, the object or the image, with the element centred.
	const S = Math.max(2.35, d + 0.45, beyond ? 0 : Math.abs(v) + 0.5);
	const sx = scale([-S, S], [box.x0 + 4, box.x1 - 4]);
	const ppu = (box.x1 - box.x0 - 8) / (2 * S);
	const hSpan = Math.max(h0, beyond ? 0 : Math.abs(hi));
	const yUnit = Math.min(30, 64 / hSpan);
	const sy = (Y: number): number => round(cy - Y * yUnit, 2);
	const P = (X: number, Y: number): Pt => ({ x: round(sx(X), 2), y: sy(Y) });
	const pixDir = (dir: Pt): Pt => ({ x: dir.x * ppu, y: -dir.y * yUnit });

	const objTip = P(-d, h0);
	const hitA = P(0, h0);
	const pole = P(0, 0);

	// Ray 1 after the element: through the far focus (convex lens), back through the focus in
	// front (concave mirror), or diverging as if from the focus on the near side (the two
	// diverging elements). Ray 2 passes the optical centre unbent, or reflects about the axis at
	// the pole - the principal axis IS the normal there, so the angles are equal.
	const dirA: Pt = element === "convexLens" ? { x: 1, y: -h0 }
		: element === "concaveLens" ? { x: 1, y: h0 }
			: element === "concaveMirror" ? { x: -1, y: -h0 }
				: { x: -1, y: h0 };
	const dirB: Pt = isMirror ? { x: -d, y: -h0 } : { x: d, y: -h0 };
	/** The focus a diverging element's emergent ray appears to come from. */
	const apparentF = element === "concaveLens" ? -1 : element === "convexMirror" ? 1 : null;

	const rayA = toPath([objTip, hitA, exitAt(hitA, pixDir(dirA), box)]);
	const rayB = toPath([objTip, pole, exitAt(pole, pixDir(dirB), box)]);

	// Backward extensions. Only a virtual image needs them, and they run to the image tip or to
	// the focus the ray appears to come from, whichever is further from the element.
	let extA: string | null = null;
	let extB: string | null = null;
	if (!beyond && !real) {
		const end = apparentF !== null && Math.abs(apparentF) > Math.abs(v) ? apparentF : v;
		const t = end / -dirA.x;
		extA = toPath([hitA, P(end, h0 - dirA.y * t)]);
		// For a lens the extension of ray 2 lies along the incident ray itself, so it is worth
		// drawing only where the image sits further out than the object.
		extB = isMirror ? toPath([pole, P(v, hi)])
			: Math.abs(v) > d ? toPath([objTip, P(v, hi)]) : null;
	}

	// Lenses have a focus on each side; a mirror has one, on the side it actually faces.
	const focal = isMirror
		? [{ X: f, label: "F" }, { X: 2 * f, label: "2F" }]
		: [{ X: -1, label: "F" }, { X: 1, label: "F" }, { X: -2, label: "2F" }, { X: 2, label: "2F" }];

	const mh = clamp(h0 * yUnit + 12, 38, 74);
	const lensW = 9, bow = 12;
	// A mirror bows away from the object when concave and towards it when convex; either way the
	// pole stays on the axis at the centre, which is where the maths puts it.
	const face = element === "concaveMirror" ? -1 : 1;
	const mirrorArc = `M ${cx + face * bow} ${cy - mh} Q ${cx - face * bow} ${cy} ${cx + face * bow} ${cy + mh}`;
	const hatch = Array.from({ length: 7 }, (_, i) => {
		const t = (i + 0.5) / 7;
		const w0 = (1 - t) * (1 - t), w1 = 2 * (1 - t) * t, w2 = t * t;
		return {
			x: round((w0 + w2) * (cx + face * bow) + w1 * (cx - face * bow), 2),
			y: round(w0 * (cy - mh) + w1 * cy + w2 * (cy + mh), 2),
		};
	});

	const imgX = beyond ? 0 : round(sx(v), 2);
	const imgTipY = beyond ? cy : sy(hi);
	const nature = `${real ? "real" : "virtual"}, ${hi < 0 ? "inverted" : "upright"}`;
	const note = atInfinity
		? "Image at infinity - the rays emerge parallel"
		: `Image ${real ? "real" : "virtual"} at ${round(Math.abs(v), 1)}f, beyond this view`;

	return (
		<DiagramFrame spec={spec} width={W} height={H}>
			<ArrowDefs id={id} />

			{/* The principal axis. Everything else is measured from it. */}
			<DrawPath d={`M ${box.x0} ${cy} L ${box.x1} ${cy}`} animate={moving} {...STROKE} opacity={0.7} />

			<Appear animate={moving} delay={0.3}>
				{element === "convexLens" ? (
					<>
						<path d={`M ${cx} ${cy - mh} Q ${cx + lensW} ${cy} ${cx} ${cy + mh}`} {...STROKE} />
						<path d={`M ${cx} ${cy - mh} Q ${cx - lensW} ${cy} ${cx} ${cy + mh}`} {...STROKE} />
					</>
				) : element === "concaveLens" ? (
					<>
						<path d={`M ${cx - lensW} ${cy - mh} L ${cx + lensW} ${cy - mh}`} {...STROKE} />
						<path d={`M ${cx - lensW} ${cy + mh} L ${cx + lensW} ${cy + mh}`} {...STROKE} />
						<path d={`M ${cx - lensW} ${cy - mh} Q ${cx + lensW - 4} ${cy} ${cx - lensW} ${cy + mh}`} {...STROKE} />
						<path d={`M ${cx + lensW} ${cy - mh} Q ${cx - lensW + 4} ${cy} ${cx + lensW} ${cy + mh}`} {...STROKE} />
					</>
				) : (
					<>
						<path d={mirrorArc} {...STROKE} />
						{/* Hatching marks the silvered back, so the reflecting face is never ambiguous. */}
						{hatch.map((p, i) => (
							<line key={`h-${i}`} x1={p.x} y1={p.y} x2={p.x + 7} y2={p.y - 5} {...STROKE} opacity={0.6} />
						))}
					</>
				)}
			</Appear>

			{focal.map((mark, i) => {
				const fx = round(sx(mark.X), 2);
				// Nudge a focus label clear of an arrow standing on the same point - an object at
				// 2F is the commonest spec there is.
				const near = Math.abs(fx - objTip.x) < 11 || (!beyond && Math.abs(fx - imgX) < 11);
				return (
					<Appear key={`f-${i}`} animate={moving} delay={0.45 + i * 0.05}>
						<line x1={fx} y1={cy - 4} x2={fx} y2={cy + 4} {...STROKE} />
						<text
							x={near ? fx + 5 : fx}
							y={cy + 14}
							textAnchor={near ? "start" : "middle"}
							{...LABEL_SM}
						>
							{mark.label}
						</text>
					</Appear>
				);
			})}

			{/* The object: an upright arrow standing on the axis. */}
			<Appear animate={moving} delay={0.65}>
				<line x1={objTip.x} y1={cy} x2={objTip.x} y2={objTip.y} {...EMPHASIS} markerEnd={`url(#${id})`} />
				<text x={clamp(objTip.x, 20, W - 20)} y={objTip.y - 8} textAnchor="middle" {...LABEL}>
					Object
				</text>
			</Appear>

			<DrawPath d={rayA} animate={moving} delay={0.9} {...STROKE} markerEnd={`url(#${id})`} />
			<DrawPath d={rayB} animate={moving} delay={1.15} {...STROKE} markerEnd={`url(#${id})`} />

			{/* Faded in rather than drawn: animating a path's length overwrites its dash pattern,
			    and here the dashes are the difference between a real image and a virtual one. */}
			<Appear animate={moving} delay={1.45}>
				{extA && <path d={extA} {...DASH} />}
				{extB && <path d={extB} {...DASH} />}
			</Appear>

			{beyond ? (
				<Appear animate={moving} delay={1.6}>
					<text x={cx} y={H - 6} textAnchor="middle" {...LABEL_SM}>{note}</text>
				</Appear>
			) : (
				<Appear animate={moving} delay={1.75}>
					<line
						x1={imgX} y1={cy} x2={imgX} y2={imgTipY}
						{...(real ? EMPHASIS : VIRTUAL)}
						markerEnd={`url(#${id})`}
					/>
					<text
						x={clamp(imgX, 34, W - 34)}
						y={hi > 0 ? imgTipY - 19 : imgTipY + 13}
						textAnchor="middle"
						{...LABEL}
					>
						Image
					</text>
					<text
						x={clamp(imgX, 34, W - 34)}
						y={hi > 0 ? imgTipY - 8 : imgTipY + 24}
						textAnchor="middle"
						{...LABEL_SM}
					>
						{nature}
					</text>
				</Appear>
			)}
		</DiagramFrame>
	);
}
