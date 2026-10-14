"use client";

/**
 * The shared frame every teaching diagram draws inside.
 *
 * ## One canvas, one set of strokes
 *
 * Each diagram is a different picture, but they appear together in one lesson plan, so they have to
 * look like one hand drew them. That means a single stroke weight, a single label size and a single
 * canvas. A per-diagram choice is how a set of figures ends up looking like a ransom note.
 *
 * ## Everything is `currentColor`
 *
 * No diagram names a colour. Structure is `currentColor`, and emphasis is the SAME colour at a
 * different weight or opacity. That themes for free in light and dark, prints correctly in black,
 * and cannot violate the palette rule, because it never picks from the palette. Where a fill is
 * genuinely the datum - the shaded part of a fraction - it is `currentColor` at low opacity, so the
 * meaning survives even in a one-colour print.
 *
 * ## Animation is opt-in, and the still frame must still teach
 *
 * `animate` is a prop here, never a field on the spec: whether a diagram moves is a presentation
 * choice, and what it shows is content. Under `prefers-reduced-motion` every animation resolves to
 * its FINAL state rather than its first, so a reader who cannot have motion still sees the apple
 * landed and the path drawn, not an empty canvas waiting for a movement that will not come.
 */

import * as React from "react";
import { motion, useReducedMotion, type Transition } from "framer-motion";
import { CANVAS, describeDiagram, type DiagramSpec } from "@repo/core/diagram";
import { cn } from "../lib/utils";

/** Structure. One weight, everywhere. */
export const STROKE = {
	stroke: "currentColor",
	fill: "none",
	strokeWidth: 1.25,
	strokeLinecap: "round",
	strokeLinejoin: "round",
} as const;

/** A construction line - an axis of symmetry, a radius, a height. Present but not the subject. */
export const DASH = { ...STROKE, strokeDasharray: "3 3", opacity: 0.55 } as const;

/** Something being pointed at, rather than merely drawn. */
export const EMPHASIS = { ...STROKE, strokeWidth: 2 } as const;

/** A fill that means something, readable even printed in one colour. */
export const SOFT_FILL = { fill: "currentColor", opacity: 0.14 } as const;

export const LABEL = { fontSize: 11, fill: "currentColor" } as const;
export const LABEL_SM = { fontSize: 9.5, fill: "currentColor", opacity: 0.75 } as const;

/**
 * Arrowheads.
 *
 * One `<defs>` per diagram, with an id derived from the instance, because two diagrams on one page
 * that both define `#arrow` would have the second silently reuse the first. That class of bug is
 * exactly why the icon exports in this codebase strip ids.
 */
export function ArrowDefs({ id }: { id: string }) {
	return (
		<defs>
			<marker
				id={id} viewBox="0 0 10 10" refX="9" refY="5"
				markerWidth="6" markerHeight="6" orient="auto-start-reverse"
			>
				<path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
			</marker>
		</defs>
	);
}

/**
 * A stable id for a diagram's `<defs>`, derived from the diagram itself.
 *
 * This was `React.useId()`, which is documented as SSR-stable and is not stable here: the diagrams
 * render inside a Radix `ScrollArea` whose tree differs between the server and the client, which
 * shifts every id after it. The result was a hydration mismatch on EVERY diagram on the page - the
 * marker was defined as one id and referenced as another, so an arrowhead could silently fail to
 * paint.
 *
 * Hashing the diagram's own description is deterministic on both sides by construction. Two
 * identical diagrams on one page do share an id, and that is harmless rather than the collision
 * bug it looks like: same spec means byte-identical `<defs>`, so either definition resolves to the
 * same marker. What must never happen - and cannot here - is two DIFFERENT definitions sharing a
 * name, which is why `suffix` exists for a diagram that needs more than one.
 */
export function diagramId(spec: DiagramSpec, suffix = ""): string {
	const seed = `${spec.kind}:${describeDiagram(spec)}:${suffix}`;
	let h = 2166136261;
	for (let i = 0; i < seed.length; i++) {
		h ^= seed.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return `gk${(h >>> 0).toString(36)}${suffix}`;
}

/**
 * Should this diagram move right now?
 *
 * Returns false when the caller did not ask, and ALSO when the reader has asked the system for
 * less motion. Callers render the final state in both cases.
 */
export function useDiagramMotion(animate: boolean | undefined): boolean {
	const reduced = useReducedMotion();
	return Boolean(animate) && !reduced;
}

/** Free fall. Quadratic ease-in, because gravity is, and a linear drop teaches the wrong thing. */
export const GRAVITY: Transition = { duration: 1.1, ease: [0.55, 0, 1, 0.45] };
/** Everything else - a line drawing itself, a label arriving. */
export const DRAW: Transition = { duration: 0.9, ease: "easeInOut" };

/**
 * A path that draws itself.
 *
 * `pathLength` is normalised by framer-motion, so this works on any path without measuring it. When
 * motion is off the path is simply rendered whole, which is the state it would have ended in.
 */
export function DrawPath({
	d, animate, delay = 0, ...rest
}: React.SVGProps<SVGPathElement> & { d: string; animate: boolean; delay?: number }) {
	if (!animate) return <path d={d} {...rest} />;
	return (
		<motion.path
			d={d}
			initial={{ pathLength: 0, opacity: 0 }}
			animate={{ pathLength: 1, opacity: 1 }}
			transition={{ ...DRAW, delay }}
			{...(rest as React.ComponentProps<typeof motion.path>)}
		/>
	);
}

/** A label or marker that arrives after the line it belongs to. */
export function Appear({
	animate, delay = 0, children,
}: { animate: boolean; delay?: number; children: React.ReactNode }) {
	if (!animate) return <>{children}</>;
	return (
		<motion.g
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			transition={{ duration: 0.35, delay }}
		>
			{children}
		</motion.g>
	);
}

export interface DiagramFrameProps {
	spec: DiagramSpec;
	width?: number;
	height?: number;
	className?: string;
	children: React.ReactNode;
}

/**
 * The `<figure>` and `<svg>` around every diagram.
 *
 * `<title>` and `<desc>` come from `describeDiagram`, so the picture is announced in words rather
 * than as "image". A diagram nobody can read is not a richer lesson plan, it is a gap in one.
 */
export function DiagramFrame({
	spec, width = CANVAS.width, height = CANVAS.height, className, children,
}: DiagramFrameProps) {
	const description = describeDiagram(spec);
	return (
		<figure className={cn("my-3 flex flex-col items-center gap-1.5", className)}>
			<svg
				viewBox={`0 0 ${width} ${height}`}
				width={width}
				height={height}
				role="img"
				aria-label={description}
				// `h-auto` belongs HERE, not on each caller. The svg carries explicit `width` and
				// `height`, and Tailwind preflight only gives `height: auto` to `img` and `video` -
				// so in any column narrower than the canvas, `max-w-full` shrank the width while the
				// height stayed put and the drawing squashed. Every consumer would otherwise have to
				// remember `[&_svg]:h-auto`, and two of them already did not.
				className="h-auto max-w-full text-neutral-800 dark:text-neutral-200"
			>
				<title>{description}</title>
				{children}
			</svg>
			{spec.caption && (
				<figcaption className="text-center text-xs text-neutral-600 dark:text-neutral-400">
					{spec.caption}
				</figcaption>
			)}
		</figure>
	);
}
