"use client";

/**
 * A Venn diagram - two or three overlapping sets.
 *
 * ## The regions are measured, and what will not fit is cut
 *
 * The lens where two circles overlap is the narrowest part of the picture, and the validator
 * allows six eighty-character items in it. So each row's width is computed from the circle
 * geometry at that row's height and the item is truncated to it, and a region that cannot take
 * every item ends with "+n more". A word that runs out of its circle does not read as belonging
 * to the other set, it reads as a broken figure.
 *
 * ## The fill IS the overlap
 *
 * Each circle carries the same soft fill, so where two overlap the fill doubles and where three
 * overlap it trebles. Nothing is clipped or masked to achieve it, and it survives a one-colour
 * print, which a second hue would not.
 *
 * Three sets use the standard symmetric arrangement - three equal circles on a ring - so the only
 * regions the spec can address are the three "only" lobes and the centre where all three meet.
 * That is exactly what `VennSpec` carries: per-set `items`, and one `intersection`.
 */

import { polar, ringAngles, round, type VennSpec } from "@repo/core/diagram";
import {
	Appear, DrawPath, LABEL, LABEL_SM, SOFT_FILL, STROKE,
	useDiagramMotion, DiagramFrame,
} from "./canvas";

const W = 320, CX = W / 2;
const CHAR = 6.0, CHAR_SM = 5.3;
const LINE = 12, ROW = 12;

/** Wrap to a column, breaking a word longer than the column rather than letting it overflow. */
function wrap(text: string, per: number): string[] {
	const cap = Math.max(5, Math.floor(per));
	const lines: string[] = [];
	let cur = "";
	for (const word of text.split(/\s+/).filter(Boolean)) {
		let w = word;
		while (w.length > cap) {
			if (cur) { lines.push(cur); cur = ""; }
			lines.push(`${w.slice(0, cap - 1)}-`);
			w = w.slice(cap - 1);
		}
		if (!cur) cur = w;
		else if (cur.length + 1 + w.length <= cap) cur = `${cur} ${w}`;
		else { lines.push(cur); cur = w; }
	}
	if (cur) lines.push(cur);
	return lines.length ? lines : [text];
}

/** One item, one row: cut to the width of the region it has to sit inside. */
function fit(text: string, px: number): string {
	const max = Math.max(3, Math.floor(px / CHAR_SM));
	return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

/** The rows a region will actually show, with "+n more" when it cannot show them all. */
function rowsFor(items: string[] | undefined, cap: number): string[] {
	const list = items ?? [];
	if (list.length <= cap) return list;
	return [...list.slice(0, cap - 1), `+${list.length - cap + 1} more`];
}

/** A full circle as a path, so it can draw itself. */
function ring(cx: number, cy: number, r: number): string {
	return `M ${round(cx - r, 2)} ${cy} A ${r} ${r} 0 1 0 ${round(cx + r, 2)} ${cy}`
		+ ` A ${r} ${r} 0 1 0 ${round(cx - r, 2)} ${cy}`;
}

export function Venn({ spec, animate }: { spec: VennSpec; animate?: boolean }) {
	return spec.sets.length >= 3
		? <Three spec={spec} animate={animate} />
		: <Two spec={spec} animate={animate} />;
}

function Two({ spec, animate }: { spec: VennSpec; animate?: boolean }) {
	const moving = useDiagramMotion(animate);

	const r = 82, offset = 48;
	const c: [number, number] = [CX - offset, CX + offset];
	const labels = spec.sets.map((s) => wrap(s.label, 90 / CHAR));
	const titleLines = labels.reduce((m, l) => Math.max(m, l.length), 1);

	const cy = round(31 + r + (titleLines - 1) * LINE, 2);
	const H = round(cy + r + 20, 2);

	// At `dy` from the centre line each circle is 2*hw wide, which fixes the three regions:
	// A alone runs from A's left edge to B's, the overlap from B's left edge to A's right, and
	// B alone from A's right edge to B's. Every row is measured, so nothing leaves its region.
	const span = (dy: number, which: 0 | 1 | 2): { mid: number; width: number } => {
		const hw = Math.sqrt(Math.max(r * r - dy * dy, 1));
		const lo = which === 0 ? c[0] - hw : which === 1 ? c[0] + hw : c[1] - hw;
		const hi = which === 0 ? c[1] - hw : which === 1 ? c[1] + hw : c[0] + hw;
		return { mid: round((lo + hi) / 2, 2), width: hi - lo - 12 };
	};

	const regions: Array<{ items: string[]; which: 0 | 1 | 2 }> = [
		{ items: rowsFor(spec.sets[0]?.items, 6), which: 0 },
		{ items: rowsFor(spec.sets[1]?.items, 6), which: 1 },
		{ items: rowsFor(spec.intersection, 6), which: 2 },
	];

	return (
		<DiagramFrame spec={spec} width={W} height={H}>
			{c.map((x, i) => (
				<g key={`c-${i}`}>
					<Appear animate={moving} delay={0.35 + i * 0.2}>
						<circle cx={x} cy={cy} r={r} {...SOFT_FILL} />
					</Appear>
					<DrawPath d={ring(x, cy, r)} animate={moving} delay={i * 0.2} {...STROKE} />
				</g>
			))}

			{labels.map((lines, i) => (
				<Appear key={`t-${i}`} animate={moving} delay={0.8 + i * 0.15}>
					{lines.map((line, li) => (
						<text
							key={li}
							x={c[i]}
							y={round(cy - r - 10 - (lines.length - 1 - li) * LINE, 2)}
							textAnchor="middle"
							{...LABEL}
						>
							{line}
						</text>
					))}
				</Appear>
			))}

			{regions.map((region, ri) => (
				<Appear key={`r-${ri}`} animate={moving} delay={1.1 + ri * 0.2}>
					{region.items.map((item, j) => {
						const dy = (j - (region.items.length - 1) / 2) * ROW;
						const at = span(dy, region.which);
						return (
							<text
								key={j}
								x={at.mid}
								y={round(cy + dy + 3.5, 2)}
								textAnchor="middle"
								{...LABEL_SM}
							>
								{fit(item, at.width)}
							</text>
						);
					})}
				</Appear>
			))}
		</DiagramFrame>
	);
}

function Three({ spec, animate }: { spec: VennSpec; animate?: boolean }) {
	const moving = useDiagramMotion(animate);

	const r = 66, dd = 40;
	const angles = ringAngles(3);
	const labels = spec.sets.slice(0, 3).map((s) => wrap(s.label, 110 / CHAR));
	const topLines = labels[0]?.length ?? 1;
	const sideLines = Math.max(labels[1]?.length ?? 1, labels[2]?.length ?? 1);

	const cy = round(137 + (topLines - 1) * LINE, 2);
	const H = round(cy + 104 + (sideLines - 1) * LINE + 15, 2);

	const centres = angles.map((a) => polar(CX, cy, dd, a));
	// Widths that stay inside a lobe at every row it can occupy, worked out from the circle
	// geometry rather than by eye - the lobes are much narrower than they look.
	const lobes: Array<{ x: number; y: number; width: number }> = angles.map((a, i) => {
		const p = polar(CX, cy, dd + r * 0.45, a);
		return { x: p.x, y: p.y, width: i === 0 ? 84 : 62 };
	});

	return (
		<DiagramFrame spec={spec} width={W} height={H}>
			{centres.map((p, i) => (
				<g key={`c-${i}`}>
					<Appear animate={moving} delay={0.35 + i * 0.2}>
						<circle cx={p.x} cy={p.y} r={r} {...SOFT_FILL} />
					</Appear>
					<DrawPath d={ring(p.x, p.y, r)} animate={moving} delay={i * 0.2} {...STROKE} />
				</g>
			))}

			{labels.map((lines, i) => (
				<Appear key={`t-${i}`} animate={moving} delay={0.8 + i * 0.15}>
					{lines.map((line, li) => (
						<text
							key={li}
							x={i === 0 ? CX : i === 1 ? CX + 26 : CX - 26}
							y={round(i === 0
								? cy - 116 - (lines.length - 1 - li) * LINE
								: cy + 104 + li * LINE, 2)}
							textAnchor={i === 0 ? "middle" : i === 1 ? "start" : "end"}
							{...LABEL}
						>
							{line}
						</text>
					))}
				</Appear>
			))}

			{lobes.map((lobe, i) => {
				const items = rowsFor(spec.sets[i]?.items, 4);
				return (
					<Appear key={`l-${i}`} animate={moving} delay={1.1 + i * 0.15}>
						{items.map((item, j) => (
							<text
								key={j}
								x={lobe.x}
								y={round(lobe.y + (j - (items.length - 1) / 2) * ROW + 3.5, 2)}
								textAnchor="middle"
								{...LABEL_SM}
							>
								{fit(item, lobe.width)}
							</text>
						))}
					</Appear>
				);
			})}

			<Appear animate={moving} delay={1.6}>
				{rowsFor(spec.intersection, 4).map((item, j, all) => (
					<text
						key={j}
						x={CX}
						y={round(cy + (j - (all.length - 1) / 2) * ROW + 3.5, 2)}
						textAnchor="middle"
						{...LABEL_SM}
					>
						{fit(item, 48)}
					</text>
				))}
			</Appear>
		</DiagramFrame>
	);
}
