"use client";

/**
 * A falling or thrown object - the apple, and every "drop a stone from a tower" question.
 *
 * ## The easing is part of the lesson
 *
 * Free fall is quadratic in time. An object animated at constant speed does not merely look wrong,
 * it contradicts the thing the diagram is there to teach, in front of a class being told that
 * falling objects accelerate. So the fall uses a quadratic ease-in and the trajectory samples are
 * computed the same way, which means the still frame and the moving one agree.
 *
 * ## The head
 *
 * `target: 'head'` draws a head under the fall. It is the one concession to the Newton story, and
 * it is a plain outline on purpose: a cartoon face would be an illustration, and illustration is
 * not something this library can generate honestly.
 */

import { trajectory, toPath, type ProjectileSpec } from "@repo/core/diagram";
import { motion } from "framer-motion";
import {
	Appear, ArrowDefs, DASH, DrawPath, EMPHASIS, GRAVITY, LABEL, LABEL_SM, STROKE,
	diagramId, useDiagramMotion, DiagramFrame,
} from "./canvas";

export function Projectile({ spec, animate }: { spec: ProjectileSpec; animate?: boolean }) {
	const id = diagramId(spec);
	const moving = useDiagramMotion(animate);

	const W = 320, H = 240;
	const groundY = H - 34;
	const topY = 28;
	const mode = spec.mode ?? "drop";
	const startX = mode === "throw" ? 46 : W / 2;
	const endX = mode === "throw" ? W - 54 : W / 2;

	const unit = spec.unit ?? "m";

	// A person, at a size that reads as one. The first version gave the whole figure 26px, so the
	// head came out the same size as the apple and the two overlapped into a snowman with a bump
	// on the ground for shoulders. Head radius and torso height are now set independently of the
	// fall, and the apple rests ON the head rather than inside it.
	const HEAD_R = 15, BALL_R = 9;
	const headCy = groundY - 62;
	const headTop = headCy - HEAD_R;
	/** Where the falling object comes to rest: on the head, or on the ground. */
	const restY = spec.target === "head" ? headTop - BALL_R - 2 : groundY - BALL_R;

	// Normalised path from the shared geometry, mapped onto this canvas. Screen and print therefore
	// draw the same curve rather than two implementations of it.
	// The guide path ends where the object comes to rest, so a drop onto a head does not draw a
	// dashed line straight through the head to the floor.
	const pts = trajectory(mode).map((p) => ({
		x: startX + (endX - startX) * p.x,
		y: topY + (restY - topY) * p.y,
	}));
	const pathD = toPath(pts);
	const last = pts[pts.length - 1] ?? { x: endX, y: groundY };
	const first = pts[0] ?? { x: startX, y: topY };

	return (
		<DiagramFrame spec={spec} width={W} height={H}>
			<ArrowDefs id={id} />

			{/* Ground */}
			<line x1={16} y1={groundY} x2={W - 16} y2={groundY} {...STROKE} />

			{/* Drop height, measured to whatever it lands on. */}
			{spec.height !== undefined && (
				<Appear animate={moving} delay={0.2}>
					<line
						x1={mode === "throw" ? 26 : startX - 52}
						y1={topY}
						x2={mode === "throw" ? 26 : startX - 52}
						y2={restY}
						{...DASH}
						markerStart={`url(#${id})`}
						markerEnd={`url(#${id})`}
					/>
					<text
						x={(mode === "throw" ? 26 : startX - 52) - 5}
						y={(topY + groundY) / 2}
						textAnchor="end"
						{...LABEL}
					>
						{spec.height}{unit}
					</text>
				</Appear>
			)}

			{/* The path it takes. A drop is a straight line, so this reads as a guide rather than
			    an arc; a throw is the real parabola. */}
			<DrawPath d={pathD} animate={moving} delay={0.3} {...DASH} />

			{/* Newton, minimally. An outline and nothing else: a face would be illustration, and
			    illustration is not something this library can generate honestly. */}
			{spec.target === "head" && (
				<Appear animate={moving} delay={0.15}>
					<circle cx={endX} cy={headCy} r={HEAD_R} {...STROKE} />
					{/* Shoulders rise from the ground to meet the head, so the figure is one body
					    rather than a circle floating above an arc. */}
					<path
						d={`M ${endX - 30} ${groundY} Q ${endX - 26} ${headCy + HEAD_R + 4} ${endX} ${headCy + HEAD_R}`}
						{...STROKE}
					/>
					<path
						d={`M ${endX + 30} ${groundY} Q ${endX + 26} ${headCy + HEAD_R + 4} ${endX} ${headCy + HEAD_R}`}
						{...STROKE}
					/>
				</Appear>
			)}

			{/* The object. It falls under gravity, or sits where it landed when motion is off. */}
			{moving ? (
				<motion.circle
					r={BALL_R}
					fill="currentColor"
					initial={{ cx: first.x, cy: first.y }}
					animate={{ cx: last.x, cy: restY }}
					transition={{ ...GRAVITY, delay: 0.9 }}
				/>
			) : (
				<circle cx={last.x} cy={restY} r={BALL_R} fill="currentColor" />
			)}

			{spec.object && (
				<Appear animate={moving} delay={0.5}>
					<text x={first.x + 14} y={first.y + 4} {...LABEL}>{spec.object}</text>
				</Appear>
			)}

			{/* Weight always acts down; for a throw the horizontal component is constant, which is
			    the whole point of separating the two. */}
			{spec.showVectors && (
				<Appear animate={moving} delay={1.6}>
					<line
						x1={first.x} y1={first.y + 12} x2={first.x} y2={first.y + 44}
						{...EMPHASIS} markerEnd={`url(#${id})`}
					/>
					<text x={first.x + 6} y={first.y + 40} {...LABEL_SM}>weight (mg)</text>
					{mode === "throw" && (
						<>
							<line
								x1={first.x} y1={first.y} x2={first.x + 40} y2={first.y}
								{...EMPHASIS} markerEnd={`url(#${id})`}
							/>
							<text x={first.x + 8} y={first.y - 6} {...LABEL_SM}>velocity</text>
						</>
					)}
				</Appear>
			)}
		</DiagramFrame>
	);
}
