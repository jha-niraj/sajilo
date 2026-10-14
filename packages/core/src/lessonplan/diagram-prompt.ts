import { DIAGRAM_KINDS, LIMITS, type DiagramKind } from '../diagram';

/**
 * The diagram catalogue as the MODEL reads it, shared by every caller that asks for a spec.
 *
 * Lived in `apps/main/lib/lessonplan/ai-diagrams.ts` until the per-page writer on the worker needed
 * the same lines. Two copies of "what a numberLine requires" drift within a week, and a drifted copy
 * produces specs `isDrawableDiagram` refuses - silently, as a page with no figure. One copy, here.
 */
export const DIAGRAM_KIND_LINES: Record<DiagramKind, string> = {
    numberLine: `numberLine - a hop, a jump, a position. REQUIRED from, to (numbers, from < to). Optional step (the range divided by step must be at most ${LIMITS.ticks} ticks), marks (at most ${LIMITS.marks}) of {at, label?, jumpTo?} - jumpTo draws an arc from "at" to it, which is how "8 + 5" is shown before it is written.`,
    fractionBar: `fractionBar - a fraction, or two compared. REQUIRED bars: 1-${LIMITS.bars} of {parts (1-24), shaded (0 to parts), label?}.`,
    array: `array - repeated addition, or area. REQUIRED rows, cols (each 1-${LIMITS.arraySide}, and rows x cols at most ${LIMITS.arrayCells}). Optional style "dots" or "squares", highlight (ring the first N cells, 0 to rows x cols).`,
    barModel: `barModel - a part-whole word problem, Singapore style. REQUIRED bars: 1-${LIMITS.bars} of {label, value (a positive number - the bars are drawn strictly to scale), brace?}. Optional total.`,
    plot: `plot - a straight line or a parabola. REQUIRED fn: {a?, m?, c?} with at least one of a or m; a given means y = ax^2 + bx + c, otherwise y = mx + c. Optional xRange, yRange as [min, max] with min < max, points (at most ${LIMITS.points}) of {x, y, label?}.`,
    angle: `angle - one angle between two rays. REQUIRED degrees (more than 0, less than 360). Optional label, rays as exactly two names such as ["AB", "AC"].`,
    polygon: `polygon - a triangle or quadrilateral with its sides named. REQUIRED points: 3-${LIMITS.polygonPoints} of {x, y, label?} where x and y are fractions of the canvas from 0 to 1 (y grows downwards). Optional sides (labels in the same order as the edges), rightAngleAt (index of the vertex holding the right angle).`,
    forces: `forces - arrows on a body. REQUIRED arrows: 1-${LIMITS.arrows} of {direction "up"|"down"|"left"|"right", label, magnitude? (0 to 1, relative length)}. Optional body. Equal magnitudes draw equal, which is how balance is read off the picture - so give balanced forces the SAME magnitude.`,
    projectile: `projectile - something falling or thrown. Optional mode "drop"|"throw", height (positive), unit, object (what falls), showVectors, target "ground"|"head". No required field.`,
    rayDiagram: `rayDiagram - a lens or mirror. REQUIRED element "convexLens"|"concaveLens"|"concaveMirror"|"convexMirror", objectDistance (more than 0, at most 6, measured in focal lengths). Optional objectHeight (more than 0, at most 3).`,
    circuit: `circuit - a schematic in standard symbols. REQUIRED components: 1-${LIMITS.components} of {type "battery"|"bulb"|"resistor"|"switch"|"ammeter"|"voltmeter", label?}. Optional arrangement "series"|"parallel".`,
    timeline: `timeline - dated events in order. REQUIRED events: 1-${LIMITS.events} of {at (the date or year, as text), label}. Optional orientation "horizontal"|"vertical" - vertical suits long labels.`,
    flowchart: `flowchart - an algorithm or a procedure. REQUIRED nodes: 1-${LIMITS.nodes} of {type "start"|"end"|"process"|"decision"|"io", label, noTo?}. On a decision node the Yes branch falls through to the next node and noTo is the INDEX of the node the No branch rejoins - it must be an index that exists in this list.`,
    cycle: `cycle - stages that close back on themselves. REQUIRED stages: 3-${LIMITS.stages} short strings. Use it only when the last stage really does lead back to the first; otherwise use flowchart or timeline.`,
    venn: `venn - overlapping sets. REQUIRED sets: 2-${LIMITS.sets} of {label, items? (at most ${LIMITS.items})}. Optional intersection (at most ${LIMITS.items} items sitting in the overlap).`,
    labelledParts: `labelledParts - a labelled diagram of a thing with parts: a cell, a leaf, a flask, an organ. REQUIRED shape "circle"|"ellipse"|"rectangle"|"leaf"|"flask"|"cell", parts: 1-${LIMITS.parts} of {label, x, y} where x and y are 0 to 1 across the silhouette (y grows downwards). Optional title. The parts are numbered and named in a list; give real positions.`,
    barChart: `barChart - a bar chart of a small data set. REQUIRED bars: 1-${LIMITS.chartBars} of {label, value (0 or more)}, at least one value above zero. Optional unit. Bars are drawn to scale from zero.`,
    pieChart: `pieChart - shares of a whole. REQUIRED slices: 2-${LIMITS.slices} of {label, value (positive)}. The percentages are computed from the values.`,
    coordinateGrid: `coordinateGrid - integer axes with plotted points. REQUIRED xRange and yRange as [min, max] integers, each spanning at most ${LIMITS.gridSpan}. Optional points (at most ${LIMITS.points}) of {x, y, label?} inside both ranges, connect (true joins the points in order - a shape, a translation, a line).`,
    clockFace: `clockFace - an analogue clock. REQUIRED hour (1-12), minute (0-59). Optional showDigital. The hour hand is placed between the hours according to the minutes.`,
    placeValue: `placeValue - a whole number in place-value columns, and the ONLY way to draw a binary number: base 2 shows 8 4 2 1 columns with the digits and the sum. REQUIRED number (a whole number, at most ${LIMITS.placeValueMax}, or at most 1023 in base 2). Optional base 10 (default) or 2.`,
    table: `table - a small table as a figure. REQUIRED columns: 1-${LIMITS.tableCols} strings, rows: 1-${LIMITS.tableRows} arrays each with exactly one string per column. Optional highlightRow (row index to emphasise).`,
    divisionLadder: `divisionLadder - repeated division with remainders, the ONLY way to draw a base conversion (decimal to binary, octal or hexadecimal). REQUIRED number (a whole number, 1 to ${LIMITS.ladderMax}), base (2 to 16). Every row and the answer are computed and drawn; give just the two numbers.`,
    nestedSets: `nestedSets - sets inside sets, innermost first: natural numbers inside integers inside rationals, or a species inside its genus. REQUIRED rings: 2-${LIMITS.rings} of {label, items? (at most ${LIMITS.ringItems} short example members)}. Each ring is drawn inside the next.`,
};

/**
 * Ask for ONE diagram for one written page.
 *
 * Used by the writer after the page's words exist, so the spec can carry the real numbers of the
 * example the page actually uses rather than placeholders. The answer is validated by
 * `isDrawableDiagram`; a refusal leaves the page without a figure and never fails it.
 */
export function diagramSpecPrompt(input: {
	subject: string;
	className: string;
	topic: string;
	page: { activity: string; description: string; example: string };
	intent: { purpose: string; prompt: string };
	language: 'en' | 'ne';
}): string {
	const kinds = DIAGRAM_KINDS.map((k) => `- ${DIAGRAM_KIND_LINES[k]}`).join('\n');
	const nepali = input.language === 'ne'
		? '\nEvery human-readable string inside the diagram is Nepali (Devanagari). Keys and the fixed values ("kind", "type", "direction", "element", "mode", "target", "style", "orientation", "arrangement") stay in English, letter for letter. Numbers stay as JSON numbers in Western digits.'
		: '';
	return `A Class ${input.className} ${input.subject} lesson in Nepal on: ${input.topic}
The page "${input.page.activity}" has been written. Its worked example is:
${input.page.example || '(none)'}
And it explains:
${input.page.description.slice(0, 1500)}

The outline asked for a diagram on this page: ${input.intent.purpose} - ${input.intent.prompt}

Return ONE diagram spec that draws exactly that, using the real numbers and names from the page above.
"kind" must be EXACTLY one of: ${DIAGRAM_KINDS.join(', ')}. Every string is at most ${LIMITS.labelChars} characters
and never empty. Every list has a hard cap, given below; a diagram over a cap is thrown away. Optional "caption": one short line.
THE KINDS:
${kinds}
${nepali}
Return ONLY JSON: {"diagram": {...}} or, if none of these kinds can draw it honestly, {"diagram": null, "why": "one line"}.`;
}
