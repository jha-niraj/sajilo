"use client";

/**
 * A labelled diagram - a silhouette with numbered parts named in a list beside it.
 *
 * The figure the design assumed a person would draw (a cell, a flower, a burner) is, in a
 * classroom, a SHAPE with LEADER LINES: the shape is schematic and the labels are the lesson. So
 * the shape is one of six stock silhouettes and every part is a numbered dot at a position on it,
 * with a leader to a numbered list that never overlaps because it is a list. Correct by
 * construction: the model chooses positions and names; nothing here can put a label on top of
 * another.
 */

import { round, type LabelledPartsSpec } from "@repo/core/diagram";
import { Appear, DrawPath, LABEL, LABEL_SM, SOFT_FILL, STROKE, useDiagramMotion, DiagramFrame } from "./canvas";

const W = 320;
const BOX = { x: 14, y: 22, w: 170, h: 150 };
const LIST_X = 200;
const ROW = 16;

function silhouette(shape: LabelledPartsSpec["shape"]): string {
	const { x, y, w, h } = BOX;
	const cx = x + w / 2, cy = y + h / 2;
	switch (shape) {
		case "circle": { const r = Math.min(w, h) / 2 - 4; return `M ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy}`; }
		case "ellipse": { const rx = w / 2 - 4, ry = h / 2 - 12; return `M ${cx - rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx - rx} ${cy}`; }
		case "rectangle": return `M ${x + 6} ${y + 10} H ${x + w - 6} V ${y + h - 10} H ${x + 6} Z`;
		case "cell": return `M ${x + 10} ${y + 24} Q ${x + 8} ${y + 6} ${x + 40} ${y + 8} Q ${cx} ${y + 2} ${x + w - 30} ${y + 10} Q ${x + w - 4} ${y + 20} ${x + w - 8} ${cy} Q ${x + w - 6} ${y + h - 14} ${x + w - 40} ${y + h - 6} Q ${cx} ${y + h} ${x + 30} ${y + h - 10} Q ${x + 6} ${y + h - 20} ${x + 10} ${y + 24} Z`;
		case "leaf": return `M ${x + 8} ${y + h - 8} Q ${x + 20} ${y + 20} ${x + w - 10} ${y + 10} Q ${x + w - 20} ${y + h - 20} ${x + 8} ${y + h - 8} Z M ${x + 8} ${y + h - 8} L ${x + w - 10} ${y + 10}`;
		case "flask": return `M ${cx - 16} ${y + 8} H ${cx + 16} V ${y + 46} L ${x + w - 20} ${y + h - 12} Q ${x + w - 18} ${y + h - 4} ${x + w - 28} ${y + h - 4} H ${x + 28} Q ${x + 18} ${y + h - 4} ${x + 20} ${y + h - 12} L ${cx - 16} ${y + 46} Z`;
	}
}

export function LabelledParts({ spec, animate }: { spec: LabelledPartsSpec; animate?: boolean }) {
	const moving = useDiagramMotion(animate);
	const listTop = BOX.y + 8;
	const H = Math.max(BOX.y + BOX.h + 16, listTop + spec.parts.length * ROW + 12) + (spec.title ? 4 : 0);

	return (
		<DiagramFrame spec={spec} width={W} height={H}>
			{spec.title && (
				<Appear animate={moving}><text x={BOX.x} y={14} {...LABEL}>{spec.title}</text></Appear>
			)}
			<Appear animate={moving} delay={0.2}><path d={silhouette(spec.shape)} {...SOFT_FILL} /></Appear>
			<DrawPath d={silhouette(spec.shape)} animate={moving} {...STROKE} />

			{spec.parts.map((p, i) => {
				const px = round(BOX.x + p.x * BOX.w, 2), py = round(BOX.y + p.y * BOX.h, 2);
				const ly = listTop + i * ROW;
				return (
					<Appear key={i} animate={moving} delay={0.5 + i * 0.12}>
						<line x1={px} y1={py} x2={LIST_X - 8} y2={ly - 4} {...STROKE} strokeWidth={0.7} opacity={0.6} />
						<circle cx={px} cy={py} r={5} fill="currentColor" />
						<text x={px} y={py + 2.5} textAnchor="middle" fontSize={7} fill="white">{i + 1}</text>
						<text x={LIST_X} y={ly} {...LABEL_SM}>{i + 1}. {p.label.length > 20 ? `${p.label.slice(0, 19)}…` : p.label}</text>
					</Appear>
				);
			})}
		</DiagramFrame>
	);
}
