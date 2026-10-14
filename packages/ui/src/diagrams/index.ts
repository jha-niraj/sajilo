/**
 * Teaching diagrams.
 *
 * Most callers want `<Diagram spec={...} />` and nothing else - it takes an unknown value,
 * validates it and picks the right component. The individual components are exported for a
 * gallery or a picker, which are the only places that know their own kind in advance.
 *
 * The SPEC lives in `@repo/core/diagram`, not here, so a print renderer can share it.
 */

export { Diagram, type DiagramProps } from "./diagram";

export { NumberLine } from "./number-line";
export { FractionBar } from "./fraction-bar";
export { ArrayDiagram } from "./array-diagram";
export { BarModel } from "./bar-model";
export { Plot } from "./plot";
export { Angle } from "./angle";
export { Polygon } from "./polygon";
export { Forces } from "./forces";
export { Projectile } from "./projectile";
export { RayDiagram } from "./ray-diagram";
export { Circuit } from "./circuit";
export { Timeline } from "./timeline";
export { Flowchart } from "./flowchart";
export { Cycle } from "./cycle";
export { Venn } from "./venn";

export {
	DiagramFrame, ArrowDefs, DrawPath, Appear,
	diagramId, useDiagramMotion,
	STROKE, DASH, EMPHASIS, SOFT_FILL, LABEL, LABEL_SM, GRAVITY, DRAW,
} from "./canvas";
export { LabelledParts } from "./labelled-parts";
export { BarChart } from "./bar-chart";
export { PieChart } from "./pie-chart";
export { CoordinateGrid } from "./coordinate-grid";
export { ClockFace } from "./clock-face";
export { PlaceValue } from "./place-value";
export { TableDiagram } from "./table-diagram";
export { DivisionLadder } from "./division-ladder";
export { NestedSets } from "./nested-sets";
