"use client";

/**
 * A flowchart - start, process, decision, end.
 *
 * The one diagram the Computer Science syllabus asks for by name, and the one where LAYOUT is the
 * whole problem: nodes must not collide, the No branch must leave from the side and rejoin
 * somewhere real, and it has to stay readable when the labels are long.
 *
 * Laid out in a single column on purpose. A general graph layout would need a real algorithm and
 * would still produce something a teacher cannot predict; one column is always legible, always
 * fits the page, and matches how a textbook prints it.
 */

import type { FlowchartSpec } from "@repo/core/diagram";
import {
	Appear, ArrowDefs, DrawPath, LABEL, STROKE,
	diagramId, useDiagramMotion, DiagramFrame,
} from "./canvas";

/** Break a label onto at most two lines so a long step does not overflow its box. */
function wrap(text: string, per = 18): string[] {
	if (text.length <= per) return [text];
	const words = text.split(" ");
	const lines: string[] = [];
	let cur = "";
	for (const w of words) {
		if ((cur + " " + w).trim().length > per && cur) { lines.push(cur); cur = w; }
		else cur = (cur + " " + w).trim();
	}
	if (cur) lines.push(cur);
	return lines.slice(0, 2);
}

export function Flowchart({ spec, animate }: { spec: FlowchartSpec; animate?: boolean }) {
	const id = diagramId(spec);
	const moving = useDiagramMotion(animate);

	const W = 320;
	const boxW = 150, boxH = 42, gap = 30;
	const cx = W / 2 - 26; // left of centre, leaving a lane on the right for No branches
	const H = spec.nodes.length * (boxH + gap) + gap;

	const yOf = (i: number) => gap + i * (boxH + gap);

	return (
		<DiagramFrame spec={spec} width={W} height={H}>
			<ArrowDefs id={id} />

			{spec.nodes.map((node, i) => {
				const y = yOf(i);
				const next = spec.nodes[i + 1];
				const lines = wrap(node.label);
				const isDecision = node.type === "decision";
				const isTerminal = node.type === "start" || node.type === "end";
				const delay = 0.15 * i;

				return (
					<g key={i}>
						<Appear animate={moving} delay={delay}>
							{isDecision ? (
								<path
									d={`M ${cx} ${y} L ${cx + boxW / 2} ${y + boxH / 2} L ${cx} ${y + boxH} L ${cx - boxW / 2} ${y + boxH / 2} Z`}
									{...STROKE}
								/>
							) : node.type === "io" ? (
								<path
									d={`M ${cx - boxW / 2 + 10} ${y} L ${cx + boxW / 2} ${y} L ${cx + boxW / 2 - 10} ${y + boxH} L ${cx - boxW / 2} ${y + boxH} Z`}
									{...STROKE}
								/>
							) : (
								<rect
									x={cx - boxW / 2} y={y} width={boxW} height={boxH}
									rx={isTerminal ? boxH / 2 : 6}
									{...STROKE}
								/>
							)}
							{lines.map((line, li) => (
								<text
									key={li}
									x={cx}
									y={y + boxH / 2 + (lines.length === 1 ? 4 : li === 0 ? -2 : 11)}
									textAnchor="middle"
									{...LABEL}
								>
									{line}
								</text>
							))}
						</Appear>

						{/* Fall-through to the next node. On a decision this is the Yes branch. */}
						{next && (
							<>
								<DrawPath
									d={`M ${cx} ${y + boxH} L ${cx} ${yOf(i + 1)}`}
									animate={moving}
									delay={delay + 0.1}
									{...STROKE}
									markerEnd={`url(#${id})`}
								/>
								{isDecision && (
									<Appear animate={moving} delay={delay + 0.2}>
										<text x={cx + 6} y={y + boxH + 14} {...LABEL}>Yes</text>
									</Appear>
								)}
							</>
						)}

						{/* The No branch: out to the right, then back to a node that exists. The
						    validator guarantees the target index is real, so this cannot point
						    into nothing. */}
						{isDecision && node.noTo !== undefined && (
							<>
								<DrawPath
									d={
										`M ${cx + boxW / 2} ${y + boxH / 2}`
										+ ` L ${W - 14} ${y + boxH / 2}`
										+ ` L ${W - 14} ${yOf(node.noTo) + boxH / 2}`
										+ ` L ${cx + boxW / 2} ${yOf(node.noTo) + boxH / 2}`
									}
									animate={moving}
									delay={delay + 0.25}
									{...STROKE}
									markerEnd={`url(#${id})`}
								/>
								<Appear animate={moving} delay={delay + 0.35}>
									<text x={cx + boxW / 2 + 6} y={y + boxH / 2 - 6} {...LABEL}>No</text>
								</Appear>
							</>
						)}
					</g>
				);
			})}
		</DiagramFrame>
	);
}
