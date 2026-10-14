"use client";

/**
 * Sets inside sets: the innermost ring is drawn smallest and each ring sits inside the next, with
 * its label on its upper edge and its example members inside its own band. Natural numbers inside
 * integers inside rationals is the page this exists for; species inside genus inside family is the
 * other.
 */

import { round, type NestedSetsSpec } from "@repo/core/diagram";
import { Appear, LABEL, LABEL_SM, SOFT_FILL, STROKE, useDiagramMotion, DiagramFrame } from "./canvas";

const W = 320;
const H = 230;

export function NestedSets({ spec, animate }: { spec: NestedSetsSpec; animate?: boolean }) {
	const moving = useDiagramMotion(animate);
	const n = spec.rings.length;
	const cx = W / 2;
	const cy = H / 2 + 6;
	const outer = 96;
	const step = outer / n;
	// Outermost first so the inner rings draw on top of the outer fills.
	const order = spec.rings.map((r, i) => ({ r, i })).reverse();
	return (
		<DiagramFrame spec={spec} width={W} height={H}>
			{order.map(({ r, i }, k) => {
				const rad = round(step * (i + 1), 2);
				const ry = round(rad * 0.78, 2);
				const bandTop = cy - ry;
				const innerTop = i > 0 ? cy - round(step * i * 0.78, 2) : cy;
				const itemsY = round((bandTop + innerTop) / 2 + 4, 2);
				return (
					<Appear key={i} animate={moving} delay={0.15 + k * 0.2}>
						<ellipse cx={cx} cy={cy} rx={rad} ry={ry} {...SOFT_FILL} opacity={0.08} />
						<ellipse cx={cx} cy={cy} rx={rad} ry={ry} {...STROKE} />
						<text x={cx} y={bandTop + 13} textAnchor="middle" {...LABEL} fontWeight={600}>{r.label}</text>
						{r.items && r.items.length > 0 && (
							<text x={cx} y={i === 0 ? cy + 4 : itemsY + 10} textAnchor="middle" {...LABEL_SM}>{r.items.join("   ")}</text>
						)}
					</Appear>
				);
			})}
		</DiagramFrame>
	);
}
