/**
 * Which pictures a model may generate, and which it may not.
 *
 * ## The evidence
 *
 * Seven prompts through OpenAI image generation, 2026-09-08, every one of them specific:
 *
 * | Prompt                                   | Result |
 * |------------------------------------------|--------|
 * | Devanagari-labelled digestive system      | script excellent, ONE label wrong (small intestine points at the descending colon) |
 * | black-and-white line-art pulley           | photocopies perfectly, MECHANISM WRONG: the rope ends at the movable pulley's yoke and never wraps its wheel, so the drawn mechanical advantage is 1 instead of 2 |
 * | concave-mirror ray diagram                | right conclusion, INVALID CONSTRUCTION: the second incident ray passes through neither C nor F, and the image is not drawn where the reflected rays cross |
 * | Newton's third law, book on a table       | correct, including the part most textbooks get wrong |
 * | labelled human heart                      | correct, including pulmonary artery blue and pulmonary vein red |
 * | series circuit with standard symbols      | correct |
 * | Nepali hill village planting rice         | outstanding |
 *
 * ## The rule
 *
 * It PASSES DEPICTION and FAILS CONSTRUCTION. A heart, a circuit and a village have a canonical
 * appearance seen ten thousand times. A ray diagram and a pulley reeving must be DERIVED from their
 * setup, a different setup gives a different correct picture, and the model cannot look at what it
 * drew to check whether it obeyed the rule.
 *
 * So SPECIFICITY BUYS FIDELITY, NOT CORRECTNESS. Both failures look right, and both would be handed
 * to thirty children. This is the same argument as the header of `../diagram/spec.ts`: a model
 * cannot draw but it CAN specify, and a wrong spec is visible and checkable while wrong pixels are
 * not.
 *
 * Tier three is therefore closed to generation permanently, and the refusal names the alternative
 * rather than dead-ending: every constructed purpose maps to a `DiagramSpec` kind our own renderer
 * already draws.
 */

export type FigureTier = 'SCENE' | 'DEPICTION' | 'CONSTRUCTED';

/** What a picture is FOR. Half of the cache key, and what decides the tier. */
export interface FigurePurpose {
	/** Stable slug, e.g. `human-heart`, `ray-diagram-concave-mirror`, `opener`. */
	slug: string;
	/** Shown to a teacher. */
	label: string;
}

/**
 * Purposes that must never be generated as pixels, each with the spec kind that replaces it.
 *
 * Matched as substrings of the slug rather than exact equality, because the slug is written by a
 * model when a plan is generated and `free-body-diagram-lift` should be refused just as firmly as
 * `free-body-diagram`. A false refusal costs a spec-drawn diagram; a false ALLOW costs a wrong
 * picture printed for a class.
 */
const CONSTRUCTED_PATTERNS: Array<{ match: RegExp; because: string; useInstead: string }> = [
	{ match: /ray[-\s]?diagram|mirror|lens|refraction|reflection/i,
		because: 'the rays must be constructed from the object position, and a generated one put the image where the reflected rays do not cross',
		useInstead: 'a `rayDiagram` spec' },
	{ match: /free[-\s]?body|force[-\s]?diagram|vector[-\s]?diagram/i,
		because: 'the arrows must follow from the setup, and which forces exist is the thing being taught',
		useInstead: 'a `forceDiagram` spec' },
	{ match: /pulley|lever|inclined[-\s]?plane|machine/i,
		because: 'a generated pulley\'s rope never wrapped the movable wheel, so its mechanical advantage was 1 instead of 2',
		useInstead: 'a `pulleySystem` spec' },
	{ match: /graph|plot|chart|histogram|axis|coordinate/i,
		because: 'the marks have to land on real values',
		useInstead: 'a `barChart`, `lineGraph` or `coordinateGrid` spec' },
	{ match: /circuit/i,
		because: 'a circuit a student computes from must be exact, and a picture cannot be checked',
		useInstead: 'a `circuit` spec' },
	{ match: /geometry|construction|triangle|angle[-\s]?bisector|locus/i,
		because: 'a construction is a sequence of steps, not an appearance',
		useInstead: 'a `geometry` spec' },
	{ match: /number[-\s]?line|fraction[-\s]?bar|place[-\s]?value|array/i,
		because: 'the quantities are the content',
		useInstead: 'the matching maths spec' },
	// A procedure on numbers: base conversion, binary arithmetic, "the steps of". The outline model
	// kept asking for "a diagram showing the steps of binary subtraction" as a DEPICTION, and an image
	// model given that draws digits that do not add up. The steps and the numbers ARE the content, so
	// this app draws them from a spec (a division ladder, a flowchart of the steps, a table) or not at all.
	{ match: /conversion|binary|octal|hexadecimal|decimal|division|multiplication|subtraction|addition|arithmetic|flow[-\s]?chart|algorithm|steps|procedure|venn|timeline|nested[-\s]?sets/i,
		because: 'the numbers and the order of the steps are the content, and a picture of them cannot be checked',
		useInstead: 'a `divisionLadder`, `placeValue`, `flowchart` or `table` spec' },
];

export interface TierDecision {
	tier: FigureTier;
	/** True when a picture may be generated for this purpose. */
	generatable: boolean;
	/** Present when refused: why, and what to draw instead. Written to be shown to a person. */
	refusal?: { because: string; useInstead: string };
}

/**
 * Decide the tier for a purpose slug.
 *
 * `SCENE` is anything explicitly marked as one - an opener, a context painting. It makes no factual
 * claim, so nothing can be wrong in it and it needs no review. Everything else that is not
 * constructed is `DEPICTION`: generatable, but FLAGGED until a person has looked at it, because one
 * in five comes back with a wrong label and all of them read as authoritative.
 */
export function decideTier(purposeSlug: string, opts: { scene?: boolean } = {}): TierDecision {
	if (opts.scene) return { tier: 'SCENE', generatable: true };
	for (const p of CONSTRUCTED_PATTERNS) {
		if (p.match.test(purposeSlug)) {
			return { tier: 'CONSTRUCTED', generatable: false, refusal: { because: p.because, useInstead: p.useInstead } };
		}
	}
	return { tier: 'DEPICTION', generatable: true };
}

export function isGeneratableTier(purposeSlug: string, opts: { scene?: boolean } = {}): boolean {
	return decideTier(purposeSlug, opts).generatable;
}

/** A DEPICTION is not trusted until a person has ticked it. A SCENE claims nothing, so it is. */
export function needsHumanReview(tier: FigureTier): boolean {
	return tier === 'DEPICTION';
}

// ─── The prompt contract ─────────────────────────────────────────────────────
//
// Written as code rather than as free text at the call site, so the constraints that made the good
// results good cannot be dropped by whoever writes the next caller.

export interface PromptInput {
	subject: string;
	className: string;
	topic: string;
	purpose: FigurePurpose;
	/** Language for labels drawn INSIDE the picture. Devanagari came back clean in the test. */
	labelLang: 'en' | 'ne';
	/** Extra detail from a teacher's edit box, appended rather than replacing the contract. */
	instruction?: string;
}

const LANG_CLAUSE: Record<'en' | 'ne', string> = {
	en: 'All labels in English.',
	ne: 'Every label written in Nepali (Devanagari script). No English text anywhere in the image.',
};

/**
 * A SCENE sets the room, so it must carry no text at all - baked-in words cannot be translated,
 * corrected or checked, and a scene has nothing to say in words anyway.
 */
export function scenePrompt(input: PromptInput): string {
	return [
		input.instruction?.trim(),
		`An illustration for a Class ${input.className} ${input.subject} lesson on ${input.topic}.`,
		'Set the scene. Warm documentary illustration, grounded in Nepal where the subject allows it.',
		'No text, no labels, no lettering anywhere in the image.',
	].filter(Boolean).join(' ');
}

/**
 * A DEPICTION goes into a lesson plan that is PRINTED, on a mono printer, on cheap paper. The one
 * generated image in the test that was asked for flat line art photocopied perfectly; the painterly
 * one would arrive as a grey rectangle. So the contract always asks for flat colour or line art.
 */
export function depictionPrompt(input: PromptInput): string {
	return [
		input.instruction?.trim(),
		`A labelled diagram of ${input.purpose.label} for a Class ${input.className} ${input.subject} textbook.`,
		LANG_CLAUSE[input.labelLang],
		'Flat colour or clean line art on a plain white background. No painterly rendering, no photographic shading, no gradients, no drop shadows.',
		'Every label joined to the part it names by a straight leader line.',
	].filter(Boolean).join(' ');
}

export function promptFor(input: PromptInput, tier: FigureTier): string {
	if (tier === 'SCENE') return scenePrompt(input);
	if (tier === 'DEPICTION') return depictionPrompt(input);
	throw new Error(`A CONSTRUCTED figure is a spec, not a prompt: ${input.purpose.slug}`);
}
