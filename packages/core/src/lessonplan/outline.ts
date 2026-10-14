import { decideTier, type FigureTier } from './figure-tier';

/**
 * The outline of a lesson, and the written page that fills it in.
 *
 * ## Why an outline exists as a separate thing
 *
 * One model call was being asked to decide the structure, write every page and choose every
 * figure inside 2,600 output tokens. Over ten pages that is about 200 tokens a page, and a page
 * that reads "teach transmission media" with nothing under it is exactly what 200 tokens looks
 * like. Splitting the STRUCTURE (cheap, fast, worth a person's glance) from the WRITING (one page
 * per call, uncapped) is what makes the pages thick enough to teach from.
 *
 * ## Where it lives
 *
 * In `lesson_plans.activities`, not a new table. An outline item IS an activity with an empty
 * `description`; the writer fills the same row in place. The paged view, the edit box, the PDF and
 * the presenter all keep working unchanged, and the plan's status - `OUTLINED` - is what tells them
 * the words are not there yet.
 */

export type LessonSlot = 'REVIEW' | 'TEACH' | 'GUIDED' | 'INDEPENDENT' | 'CHECK';
export const LESSON_SLOTS: LessonSlot[] = ['REVIEW', 'TEACH', 'GUIDED', 'INDEPENDENT', 'CHECK'];

/**
 * What the outline says a page wants drawn, decided BEFORE anything is written or spent.
 *
 * The tier is the one from `figure-tier.ts` and it is enforced here, not trusted: a model that
 * writes `tier: 'DEPICTION'` on a ray diagram gets it corrected to `CONSTRUCTED`, which routes it
 * to our own renderer rather than to the image model.
 */
export interface FigureIntent {
	tier: FigureTier;
	/** Stable slug, half of the figure-library cache key. e.g. `star-bus-ring-mesh-topologies`. */
	purpose: string;
	/** For SCENE / DEPICTION: what to draw. For CONSTRUCTED: what the spec should show. */
	prompt: string;
}

/** One page of the outline. `description` is empty until the writer runs. */
export interface OutlineItem {
	/** The page title. What a teacher reads in the outline list and at the top of the page. */
	activity: string;
	/** One line: what this page teaches. Shown under the title until the page is written. */
	brief: string;
	slot: LessonSlot;
	/** Minutes. Ours, from the period length, never the model's. */
	duration: number;
	figureIntent: FigureIntent | null;
	description: string;
}

/**
 * What a WRITTEN page carries on top of the outline. The say-aloud prose is `description`.
 *
 * These fields are the content contract. A page is teachable when a teacher can read `description`
 * aloud, copy `board` onto the board line by line, run `example`, ask `askTheClass`, and know from
 * `listenFor` which wrong answer is coming. A page missing these is not a page.
 */
export interface WrittenPage extends OutlineItem {
	/** Lines to write on the board, in order, verbatim. */
	board: string[];
	/** One worked example or demonstration, complete. */
	example: string;
	/** One question to put to the class at this point, with the answer expected. */
	askTheClass: string;
	/** The mistake this class is likely to make here, and what it sounds like. */
	listenFor: string;
	/** Materials this step needs, if any. */
	materials?: string[] | null;
	/** A CONSTRUCTED figure, once the writer has asked for its spec. Validated by `<Diagram>`. */
	diagram?: unknown;
	/** A SCENE or DEPICTION figure, once the writer has made or found it. */
	figureId?: string | null;
}

function isStr(v: unknown): v is string { return typeof v === 'string' && v.trim().length > 0; }
function isRecord(v: unknown): v is Record<string, unknown> { return typeof v === 'object' && v !== null && !Array.isArray(v); }

export function isLessonSlot(v: unknown): v is LessonSlot {
	return typeof v === 'string' && (LESSON_SLOTS as string[]).includes(v);
}

/**
 * Normalise a figure intent the model wrote, or drop it.
 *
 * Returns `null` for "no figure" and for anything malformed - a malformed intent is not worth a
 * guess, because the guess would be spent on at generation time. The tier is RECOMPUTED from the
 * purpose rather than read from the model, so a constructed diagram can never be sent to the
 * image model however the model labelled it.
 */
export function normaliseFigureIntent(value: unknown, opts: { titlePage?: boolean } = {}): FigureIntent | null {
	if (value === null || value === undefined || value === false) return null;
	if (!isRecord(value)) return null;
	const purpose = isStr(value.purpose) ? value.purpose.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) : '';
	const prompt = isStr(value.prompt) ? value.prompt.trim().slice(0, 600) : '';
	if (!purpose || !prompt) return null;
	const wantsScene = value.tier === 'SCENE' || opts.titlePage === true;
	const decision = decideTier(purpose, { scene: wantsScene });
	// The model may say CONSTRUCTED itself (the prompt asks it to prefer one and name the kind) and
	// that is always honoured: a drawn diagram is never wrong, so choosing it can never be. The
	// reverse is not true, which is why a DEPICTION label is still recomputed from the purpose.
	const tier = value.tier === 'CONSTRUCTED' && !wantsScene ? 'CONSTRUCTED' : decision.tier;
	return { tier, purpose, prompt };
}

/** Shape check for one outline item as the model wrote it. Slot and minutes are stamped by the caller. */
export function isOutlineItemDraft(value: unknown): value is { activity: string; brief: string; figure?: unknown } {
	return isRecord(value) && isStr(value.activity) && isStr(value.brief)
		&& (value.activity as string).length <= 120 && (value.brief as string).length <= 400;
}

/** True once the writer has filled a page in. The outline view uses this to say "not written yet". */
export function isPageWritten(item: Partial<WrittenPage> | OutlineItem | null | undefined): boolean {
	return !!item && typeof item.description === 'string' && item.description.trim().length > 0;
}
