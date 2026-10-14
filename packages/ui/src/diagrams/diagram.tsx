"use client";

/**
 * `<Diagram>` - the one entry point.
 *
 * ## Why a dispatcher rather than importing the component you want
 *
 * The caller almost never knows which diagram it has. A lesson plan holds whatever the author or
 * the generator put there, arriving as JSON, and the page renders it. So the contract is: hand it
 * an unknown value, get a diagram or get nothing.
 *
 * ## It validates first, every time
 *
 * `isDrawableDiagram` runs here, on `unknown`, before any component sees a spec. That is deliberate
 * belt-and-braces: the spec may have come from a language model, through a database, across a
 * revision, and the type says nothing about what is actually in the column. A diagram that cannot
 * be drawn renders as NOTHING rather than as a broken picture, and `fallback` lets the caller show
 * the surrounding text instead. This is the same rule `QuestionFigure` uses, and for the same
 * reason: a confidently wrong figure gets printed and handed to thirty children.
 */

import * as React from "react";
import { isDrawableDiagram, type DiagramSpec } from "@repo/core/diagram";

import { NumberLine } from "./number-line";
import { FractionBar } from "./fraction-bar";
import { ArrayDiagram } from "./array-diagram";
import { BarModel } from "./bar-model";
import { Plot } from "./plot";
import { Angle } from "./angle";
import { Polygon } from "./polygon";
import { Forces } from "./forces";
import { Projectile } from "./projectile";
import { RayDiagram } from "./ray-diagram";
import { Circuit } from "./circuit";
import { Timeline } from "./timeline";
import { Flowchart } from "./flowchart";
import { Cycle } from "./cycle";
import { Venn } from "./venn";
import { LabelledParts } from "./labelled-parts";
import { BarChart } from "./bar-chart";
import { PieChart } from "./pie-chart";
import { CoordinateGrid } from "./coordinate-grid";
import { ClockFace } from "./clock-face";
import { PlaceValue } from "./place-value";
import { TableDiagram } from "./table-diagram";
import { DivisionLadder } from "./division-ladder";
import { NestedSets } from "./nested-sets";

export interface DiagramProps {
	/** Unknown on purpose - this is usually straight out of a JSON column. */
	spec: unknown;
	/** Off by default. Whether a diagram moves is the page's choice, never the spec's. */
	animate?: boolean;
	/** Rendered when the spec cannot be drawn. Usually the caption, or nothing. */
	fallback?: React.ReactNode;
}

export function Diagram({ spec, animate, fallback = null }: DiagramProps) {
	if (!isDrawableDiagram(spec)) return <>{fallback}</>;

	// Narrowed per branch, so adding a kind to the union without adding it here is a type error
	// rather than a blank space on a printed lesson plan.
	const s: DiagramSpec = spec;
	switch (s.kind) {
		case "numberLine": return <NumberLine spec={s} animate={animate} />;
		case "fractionBar": return <FractionBar spec={s} animate={animate} />;
		case "array": return <ArrayDiagram spec={s} animate={animate} />;
		case "barModel": return <BarModel spec={s} animate={animate} />;
		case "plot": return <Plot spec={s} animate={animate} />;
		case "angle": return <Angle spec={s} animate={animate} />;
		case "polygon": return <Polygon spec={s} animate={animate} />;
		case "forces": return <Forces spec={s} animate={animate} />;
		case "projectile": return <Projectile spec={s} animate={animate} />;
		case "rayDiagram": return <RayDiagram spec={s} animate={animate} />;
		case "circuit": return <Circuit spec={s} animate={animate} />;
		case "timeline": return <Timeline spec={s} animate={animate} />;
		case "flowchart": return <Flowchart spec={s} animate={animate} />;
		case "cycle": return <Cycle spec={s} animate={animate} />;
		case "venn": return <Venn spec={s} animate={animate} />;
		case "labelledParts": return <LabelledParts spec={s} animate={animate} />;
		case "barChart": return <BarChart spec={s} animate={animate} />;
		case "pieChart": return <PieChart spec={s} animate={animate} />;
		case "coordinateGrid": return <CoordinateGrid spec={s} animate={animate} />;
		case "clockFace": return <ClockFace spec={s} animate={animate} />;
		case "placeValue": return <PlaceValue spec={s} animate={animate} />;
		case "table": return <TableDiagram spec={s} animate={animate} />;
		case "divisionLadder": return <DivisionLadder spec={s} animate={animate} />;
		case "nestedSets": return <NestedSets spec={s} animate={animate} />;
	}
}
