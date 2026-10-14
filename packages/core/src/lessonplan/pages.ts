import type { DiagramSpec } from '../diagram';
import type { ContentPageKind, PageContent } from './content-page';

/**
 * The lesson plan as a sequence of PAGES - one model, used by the screen, the deck and the print.
 *
 * ## Why this is here and not in the slides renderer
 *
 * The sequence already existed, but only inside `packages/pdf/src/lesson-slides.ts`: a title page
 * carrying the objectives, one page per activity, the check last. Now the plan DETAIL PAGE shows
 * one page at a time too, and two independent implementations of "what is page 4" is a bug waiting
 * for its first edit - a teacher would page to slide 4 on screen, project slide 4, and see two
 * different things.
 *
 * So the sequence lives here, in a package with no React and no pdf-lib, and all three consumers
 * import it.
 *
 * ## Ids are positional and stable, on purpose
 *
 * The per-page edit box addresses an element by id (`page-2.description`), and that reference has
 * to survive a reload, a re-render and a round trip through a server action. A random id generated
 * at render time does not. So an id is derived from the element's POSITION in the plan, which is
 * the same on every load of the same plan, and changes only when the plan itself changes - which is
 * exactly when a stale reference should stop resolving.
 */

export type LessonPageKind = 'TITLE' | 'ACTIVITY' | 'PUZZLE' | 'CHECK';

/** A block of text on a page that the edit box can target. */
export interface LessonPageField {
	/** `page-2.description`. Stable across loads. */
	id: string;
	/** Shown in the edit box so nobody edits the wrong thing. */
	label: string;
	text: string;
	/** Where this lives in the plan, so a server action can write it back without guessing. */
	path: LessonFieldPath;
}

/**
 * Where a field came from, as data rather than as a parsed string.
 *
 * The edit box sends this back and the action writes exactly here. Encoding it as
 * `"activities.3.description"` and splitting on dots is the same information with a parser bolted
 * on and a whole class of mistakes attached.
 */
export type LessonFieldPath =
	| { kind: 'topic' }
	| { kind: 'objective'; index: number }
	| { kind: 'activity'; index: number; field: 'activity' | 'description' | 'lead' | 'example' }
	| { kind: 'assessment' }
	| { kind: 'homework' };

export interface LessonPage {
	/** 1-based, and what the URL carries. */
	number: number;
	/** `page-2`. */
	id: string;
	kind: LessonPageKind;
	/** The heading shown at the top of the page and in the pager. */
	title: string;
	/** Minutes for this step, and how many minutes of the period have already gone. */
	durationMinutes: number | null;
	elapsedMinutes: number | null;
	/** Rosenshine slot label, when the generator stamped one. */
	slotLabel: string | null;
	fields: LessonPageField[];
	/** Materials for this step, when it names any. */
	materials: string[];
	/** A tier-three figure: a spec OUR renderer draws. Never a generated picture. */
	diagram: DiagramSpec | null;
	/** A tier-one or tier-two figure: a generated picture, referenced by id. */
	figureId: string | null;
	/** Only on a CHECK page. */
	questionCount: number;
	/**
	 * Which activity this page draws, or null for a page that belongs to no activity (TITLE, PUZZLE,
	 * the trailing CHECK). Stated here rather than derived as `number - 2` by every consumer: a v2
	 * plan has no title page, so the arithmetic differs and one consumer doing it wrong shows page 4
	 * with page 3's teacher notes.
	 */
	activityIndex: number | null;
	/** A content page's kind (HOOK, CONCEPT, CHECK...) or null on a v1 activity. */
	pageKind: ContentPageKind | null;
	/** The content layer of a v2 page, or null. The teacher layer is deliberately NOT here. */
	content: PageContent | null;
	/** What the writer could not get right on this page, for the teacher to see. */
	warnings: string[];
	/**
	 * Only on a PUZZLE page: the validated `PuzzleSpec`.
	 *
	 * `unknown` on purpose. The value comes out of a jsonb column written by a model, so a type
	 * here would be a promise the column cannot keep - and the renderer's own gate is stronger than
	 * a type anyway, because it SOLVES the puzzle rather than checking its shape.
	 */
	puzzle: unknown;
}

export interface LessonPageInput {
	topic: string;
	objectives: string[];
	activities: Array<{
		activity: string;
		description: string;
		durationMinutes: number;
		slot?: string | null;
		materials?: string[] | null;
		diagram?: unknown;
		figureId?: string | null;
		/** v2 only. */
		kind?: ContentPageKind | null;
		content?: PageContent | null;
		warnings?: string[] | null;
	}>;
	/** 2 for a content-page plan: no title page, HOOK first, checks inline, summary last. */
	version?: 1 | 2;
	assessment?: string | null;
	homework?: string | null;
	checkQuestionCount?: number;
	/** At most one, and usually none. Placed on its own page just before the check. */
	puzzle?: unknown;
	/** The title page's scene, once the writer has made it. Lives in `lesson_plans.generation`. */
	titleFigureId?: string | null;
}

export const SLOT_LABEL: Record<string, string> = {
	REVIEW: 'Review',
	TEACH: 'Teach',
	GUIDED: 'Guided practice',
	INDEPENDENT: 'Practice',
	CHECK: 'Check',
};

/**
 * The one place that decides what page N of a plan is.
 *
 * `isDrawable` is injected rather than imported so this module stays free of the diagram validator's
 * own dependencies; every caller passes `isDrawableDiagram`. A spec that fails validation becomes
 * `null` here, exactly as it does in `<Diagram>` and in the PDF renderers, so a page never renders
 * a half-drawn figure.
 */
export function lessonPlanPages(
	input: LessonPageInput,
	isDrawable: (spec: unknown) => spec is DiagramSpec,
	/**
	 * The puzzle gate, injected for the same reason `isDrawable` is: this module stays free of the
	 * validators' own dependencies. Omitted means no puzzle page, which is the right default for
	 * every caller that has not thought about puzzles.
	 */
	isDrawablePuzzle?: (spec: unknown) => boolean,
): LessonPage[] {
	const pages: LessonPage[] = [];
	const v2 = input.version === 2;

	// A v2 plan has no title page: its HOOK is page 1 and its GOALS page carries the objectives.
	if (!v2) pages.push({
		number: 1,
		id: 'page-1',
		kind: 'TITLE',
		title: input.topic,
		durationMinutes: null,
		elapsedMinutes: null,
		slotLabel: null,
		fields: [
			{ id: 'page-1.topic', label: 'Topic', text: input.topic, path: { kind: 'topic' } },
			...input.objectives.map((o, i) => ({
				id: `page-1.objective-${i + 1}`,
				label: `Objective ${i + 1}`,
				text: o,
				path: { kind: 'objective' as const, index: i },
			})),
		],
		materials: [],
		diagram: null,
		figureId: input.titleFigureId ?? null,
		activityIndex: null,
		pageKind: null,
		content: null,
		warnings: [],
		questionCount: 0,
		puzzle: null,
	});

	let elapsed = 0;
	const puzzlePage = (number: number): LessonPage => ({
		number, id: `page-${number}`, kind: 'PUZZLE', title: 'Puzzle',
		durationMinutes: null, elapsedMinutes: elapsed, slotLabel: null, fields: [], materials: [],
		diagram: null, figureId: null, activityIndex: null, pageKind: null, content: null, warnings: [],
		questionCount: 0, puzzle: input.puzzle,
	});
	const hasPuzzle = isDrawablePuzzle?.(input.puzzle) ?? false;

	for (const [i, a] of input.activities.entries()) {
		// v2: the puzzle sits just before the SUMMARY, after the last check - practice, not assessment.
		if (v2 && hasPuzzle && a.kind === 'SUMMARY') pages.push(puzzlePage(pages.length + 1));
		const number = pages.length + 1;
		const content = v2 ? (a.content ?? null) : null;
		const fields: LessonPageField[] = content
			? [
				{ id: `page-${number}.activity`, label: 'Title', text: a.activity, path: { kind: 'activity', index: i, field: 'activity' } },
				...(content.lead ? [{ id: `page-${number}.lead`, label: 'The first line', text: content.lead, path: { kind: 'activity' as const, index: i, field: 'lead' as const } }] : []),
				...(content.example ? [{ id: `page-${number}.example`, label: 'The example', text: content.example, path: { kind: 'activity' as const, index: i, field: 'example' as const } }] : []),
			]
			: [
				{ id: `page-${number}.activity`, label: 'Step name', text: a.activity, path: { kind: 'activity', index: i, field: 'activity' } },
				{ id: `page-${number}.description`, label: 'What the teacher does', text: a.description, path: { kind: 'activity', index: i, field: 'description' } },
			];
		pages.push({
			number,
			id: `page-${number}`,
			kind: 'ACTIVITY',
			title: a.activity,
			durationMinutes: a.durationMinutes,
			elapsedMinutes: elapsed,
			slotLabel: a.slot ? (SLOT_LABEL[a.slot] ?? null) : null,
			fields,
			materials: a.materials ?? [],
			diagram: isDrawable(a.diagram) ? a.diagram : null,
			figureId: a.figureId ?? null,
			activityIndex: i,
			pageKind: v2 ? (a.kind ?? null) : null,
			content,
			warnings: a.warnings ?? [],
			questionCount: content?.questions?.length ?? 0,
			puzzle: null,
		});
		elapsed += a.durationMinutes;
	}

	// The puzzle sits on its OWN page, just before the check.
	//
	// Not folded into an activity, deliberately: a puzzle is a thing a teacher hands out and a class
	// works on, so it needs the whole page in present mode and the whole width on paper. And putting
	// it after the activities but before the check says what it is - practice, not assessment.
	// v1: the puzzle after the activities, before the check. (v2 placed it before the summary above,
	// or here if the outline had no summary page.)
	if (hasPuzzle && !pages.some((p) => p.kind === 'PUZZLE')) pages.push(puzzlePage(pages.length + 1));

	// v2 checks are pages of their own, inline; the trailing check page belongs to v1 only.
	if (!v2 && (input.checkQuestionCount ?? 0) > 0) {
		const number = pages.length + 1;
		pages.push({
			number,
			id: `page-${number}`,
			kind: 'CHECK',
			title: 'Check for understanding',
			durationMinutes: null,
			elapsedMinutes: elapsed,
			slotLabel: SLOT_LABEL.CHECK ?? 'Check',
			fields: input.assessment
				? [{ id: `page-${number}.assessment`, label: 'How the check is run', text: input.assessment, path: { kind: 'assessment' } }]
				: [],
			materials: [],
			diagram: null,
			figureId: null,
			activityIndex: null,
			pageKind: null,
			content: null,
			warnings: [],
			questionCount: input.checkQuestionCount ?? 0,
			puzzle: null,
		});
	}

	return pages;
}

/** Find a field anywhere in the plan by the id the edit box sent back. */
export function findLessonField(pages: LessonPage[], fieldId: string): LessonPageField | null {
	for (const p of pages) {
		for (const f of p.fields) if (f.id === fieldId) return f;
	}
	return null;
}

/** Clamp a page number from a URL to something that exists. Never throws on junk. */
export function clampPageNumber(raw: string | number | null | undefined, total: number): number {
	const n = typeof raw === 'number' ? raw : Number(raw ?? 1);
	if (!Number.isFinite(n) || total < 1) return 1;
	return Math.min(Math.max(Math.trunc(n), 1), total);
}
