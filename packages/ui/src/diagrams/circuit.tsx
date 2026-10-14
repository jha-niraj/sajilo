"use client";

/**
 * A circuit diagram, drawn with the standard symbols.
 *
 * This is the one diagram in the set where the reader already knows what the picture must look
 * like: a cell is a long plate and a short plate, a lamp is a circle with a cross, a switch is a
 * hinged blade with a visible gap. Anything approximate here is worse than no diagram, because a
 * student copies it into an exercise book and is marked on it. So every symbol below is the
 * textbook one, and the wire is BROKEN where a symbol sits rather than drawn under it.
 *
 * ## Layout
 *
 * A series circuit is one rectangular loop: the cell at the bottom left, the rest spread over the
 * top edge and then back along the bottom, so reading the components in order means going round
 * the loop clockwise from the cell - the direction the circuit is traced in class.
 *
 * A parallel circuit is the same rectangle used as two rails, with the cell on the bottom rail and
 * every other component on its own vertical branch between them. The right-hand edge of the
 * rectangle is the last branch rather than an extra wire, because that is how it is printed.
 */

import { round, type CircuitSpec } from "@repo/core/diagram";
import {
	Appear, DrawPath, LABEL, LABEL_SM, STROKE,
	useDiagramMotion, DiagramFrame,
} from "./canvas";

type ComponentType = CircuitSpec["components"][number]["type"];

/**
 * Half the width of each symbol along the wire. The wire stops exactly here, so it meets the plate,
 * the glass or the terminal instead of running behind it.
 */
const FOOTPRINT: Record<ComponentType, number> = {
	battery: 9, bulb: 11, resistor: 13, switch: 10, ammeter: 11, voltmeter: 11,
};

const TYPE_NAME: Record<ComponentType, string> = {
	battery: "battery", bulb: "bulb", resistor: "resistor",
	switch: "switch", ammeter: "ammeter", voltmeter: "voltmeter",
};

function clip(text: string, max: number): string {
	return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

/**
 * One symbol, drawn horizontally about the origin. Vertical placement rotates the whole group, so
 * nothing here may contain text - the letters in a meter are added upright by the caller.
 */
function CircuitSymbol({ type }: { type: ComponentType }) {
	switch (type) {
		case "battery":
			// Two cells: long plate, short plate, long plate, short plate.
			return (
				<g {...STROKE}>
					<line x1={-9} y1={-11} x2={-9} y2={11} />
					<line x1={-4} y1={-6} x2={-4} y2={6} />
					<line x1={4} y1={-11} x2={4} y2={11} />
					<line x1={9} y1={-6} x2={9} y2={6} />
				</g>
			);
		case "bulb":
			return (
				<g {...STROKE}>
					<circle cx={0} cy={0} r={11} />
					<line x1={-7.8} y1={-7.8} x2={7.8} y2={7.8} />
					<line x1={-7.8} y1={7.8} x2={7.8} y2={-7.8} />
				</g>
			);
		case "resistor":
			return <rect x={-13} y={-6.5} width={26} height={13} {...STROKE} />;
		case "switch":
			// Open on purpose: a closed switch is indistinguishable from a plain wire, and the gap
			// is the thing being taught.
			return (
				<g {...STROKE}>
					<line x1={-10} y1={0} x2={7} y2={-11} />
					<circle cx={-10} cy={0} r={1.8} fill="currentColor" />
					<circle cx={10} cy={0} r={1.8} fill="currentColor" />
				</g>
			);
		case "ammeter":
		case "voltmeter":
			return <circle cx={0} cy={0} r={11} {...STROKE} />;
	}
}

interface Placed {
	key: number;
	type: ComponentType;
	label: string;
	x: number;
	y: number;
	vertical: boolean;
	/** Where the label goes, already anchored and budgeted. */
	tx: number;
	ty: number;
	anchor: "start" | "middle" | "end";
}

/** A straight run of wire with the symbols' footprints cut out of it. */
function run(axis: "h" | "v", fixed: number, from: number, to: number, holes: Array<[number, number]>): string {
	const pt = (v: number): string => (axis === "h" ? `${round(v, 2)} ${round(fixed, 2)}` : `${round(fixed, 2)} ${round(v, 2)}`);
	let cur = from;
	let d = "";
	for (const [a, b] of [...holes].sort((p, q) => p[0] - q[0])) {
		if (a > cur) d += `M ${pt(cur)} L ${pt(a)} `;
		cur = Math.max(cur, b);
	}
	if (to > cur) d += `M ${pt(cur)} L ${pt(to)} `;
	return d;
}

export function Circuit({ spec, animate }: { spec: CircuitSpec; animate?: boolean }) {
	const moving = useDiagramMotion(animate);

	const W = 320, H = 190;
	const x0 = 26, x1 = 294, y0 = 52, y1 = 140;
	const midY = (y0 + y1) / 2;
	const parallel = spec.arrangement === "parallel";

	const all = spec.components.map((c, i) => ({
		key: i,
		type: c.type,
		label: c.label ?? TYPE_NAME[c.type],
	}));
	// Only the first battery takes the supply position; a second one is treated as an ordinary
	// component on the loop, which is what the spec is actually describing.
	const supplyIndex = all.findIndex((c) => c.type === "battery");
	const supply = supplyIndex >= 0 ? all[supplyIndex] : undefined;
	const rest = all.filter((_, i) => i !== supplyIndex);

	const placed: Placed[] = [];
	const wire: string[] = [];

	if (parallel) {
		const supplyX = x0 + 46;
		if (supply) {
			placed.push({
				key: supply.key, type: "battery", label: clip(supply.label, 14),
				x: supplyX, y: y1, vertical: false,
				tx: supplyX, ty: y1 + 25, anchor: "middle",
			});
		}
		// Branches run from just right of the cell to the right-hand edge, the last one landing ON
		// that edge so the rectangle closes without an extra bare wire.
		const first = supply ? x0 + 92 : x0 + 40;
		const step = rest.length > 1 ? (x1 - first) / (rest.length - 1) : 0;
		const budget = rest.length > 1
			? Math.max(4, Math.min(14, Math.floor((step - 18) / 5.6)))
			: 14;

		wire.push(run("h", y0, x0, x1, []));
		// The right-hand edge is only drawn when nothing branches onto it - otherwise the last
		// branch IS that edge, and drawing both would put a second wire on top of the first.
		if (rest.length === 0) wire.push(run("v", x1, y0, y1, []));
		wire.push(run("h", y1, x0, x1, supply ? [[supplyX - 9, supplyX + 9]] : []));
		wire.push(run("v", x0, y0, y1, []));

		rest.forEach((c, j) => {
			const bx = rest.length > 1 ? round(first + step * j, 2) : x1;
			const last = j === rest.length - 1;
			placed.push({
				key: c.key, type: c.type, label: clip(c.label, budget),
				x: bx, y: midY, vertical: true,
				// The rightmost branch labels to its left; everything else to its right. Either way
				// the text sits in the gap between two branches and never leaves the canvas.
				tx: last ? bx - FOOTPRINT[c.type] - 5 : bx + FOOTPRINT[c.type] + 5,
				ty: midY + 4,
				anchor: last ? "end" : "start",
			});
			wire.push(run("v", bx, y0, y1, [[midY - FOOTPRINT[c.type], midY + FOOTPRINT[c.type]]]));
		});
	} else {
		const onTop = rest.slice(0, Math.ceil(rest.length / 2));
		// The leftovers come back along the bottom, right to left, so component order reads as one
		// clockwise trip round the loop starting at the cell.
		const onBottom = [...rest.slice(onTop.length)].reverse();
		const budget = (count: number) =>
			Math.max(5, Math.min(15, Math.floor((x1 - x0 - 24) / Math.max(count, 1) / 5.6)));

		const spread = (items: typeof rest, y: number, above: boolean, offset: number) => {
			const total = items.length + offset;
			const from = x0 + 22, to = x1 - 22;
			const chars = budget(total);
			items.forEach((c, j) => {
				const at = round(from + ((to - from) * (j + offset + 0.5)) / total, 2);
				placed.push({
					key: c.key, type: c.type, label: clip(c.label, chars),
					x: at, y, vertical: false,
					tx: at, ty: above ? y - 19 : y + 25, anchor: "middle",
				});
			});
		};

		spread(onTop, y0, true, 0);
		// The cell holds the first slot on the bottom edge; the returning components follow it.
		if (supply) {
			const total = onBottom.length + 1;
			const from = x0 + 22, to = x1 - 22;
			const at = round(from + ((to - from) * 0.5) / total, 2);
			placed.push({
				key: supply.key, type: "battery", label: clip(supply.label, budget(total)),
				x: at, y: y1, vertical: false,
				tx: at, ty: y1 + 25, anchor: "middle",
			});
			spread(onBottom, y1, false, 1);
		} else {
			spread(onBottom, y1, false, 0);
		}

		const holes = (y: number): Array<[number, number]> =>
			placed.filter((p) => p.y === y).map((p) => [p.x - FOOTPRINT[p.type], p.x + FOOTPRINT[p.type]]);
		wire.push(run("h", y0, x0, x1, holes(y0)));
		wire.push(run("h", y1, x0, x1, holes(y1)));
		wire.push(run("v", x0, y0, y1, []));
		wire.push(run("v", x1, y0, y1, []));
	}

	return (
		<DiagramFrame spec={spec} width={W} height={H}>
			{/* The loop, in one path, so it draws itself as a single circuit being traced. */}
			<DrawPath d={wire.join("")} animate={moving} {...STROKE} />

			{placed.map((p, i) => (
				<Appear key={`c-${p.key}`} animate={moving} delay={0.8 + i * 0.12}>
					<g transform={`translate(${p.x} ${p.y})${p.vertical ? " rotate(-90)" : ""}`}>
						<CircuitSymbol type={p.type} />
					</g>
					{(p.type === "ammeter" || p.type === "voltmeter") && (
						<text x={p.x} y={p.y + 4} textAnchor="middle" {...LABEL}>
							{p.type === "ammeter" ? "A" : "V"}
						</text>
					)}
				</Appear>
			))}

			{placed.map((p, i) => (
				<Appear key={`l-${p.key}`} animate={moving} delay={1.2 + i * 0.12}>
					<text x={p.tx} y={p.ty} textAnchor={p.anchor} {...LABEL_SM}>{p.label}</text>
				</Appear>
			))}
		</DiagramFrame>
	);
}
