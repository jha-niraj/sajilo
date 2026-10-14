import { z } from 'zod';

/**
 * The rating scale - the levels a teacher can record against a skill.
 *
 * It lives in the FRAMEWORK, not in code, because it varies by country: four levels is common and
 * reads well, but a three-level or a five-level scale is a perfectly ordinary national choice. There
 * is no level enum anywhere in this module for the same reason there is no strand enum - a new
 * country must never need a migration.
 *
 * Shared by `apps/admin` (which authors a scale) and `apps/main` (which renders and applies one), so
 * both halves agree on the shape without a second copy to drift.
 */

/**
 * The colour tokens a framework may use, from the repo's approved palette (root CLAUDE.md).
 *
 * Validated rather than accepting free hex, because a framework authored in the admin app renders
 * inside a teacher's screen in the school app. An off-palette colour chosen by a platform admin
 * would leak straight through, and nothing in the school app could reject it at that point.
 */
export const ASSESSMENT_COLOR_TOKENS = [
    'emerald', 'teal', 'amber', 'orange', 'rose', 'lime', 'neutral', 'zinc', 'gold',
] as const;

export type AssessmentColorToken = (typeof ASSESSMENT_COLOR_TOKENS)[number];

export const colorTokenSchema = z.enum(ASSESSMENT_COLOR_TOKENS);

export const ratingLevelSchema = z.object({
    /** Stable identifier. Stored on every observation, so it must never be edited after publish. */
    key: z.string().min(1).max(40),
    /** What a teacher sees. Free text, translated per framework. */
    label: z.string().min(1).max(60),
    /** What this level actually means, in words a teacher can act on. */
    description: z.string().max(400).optional(),
    /** Ascending: the lowest level is 0. Ordering is what makes HIGHEST_SUSTAINED and the bands work. */
    order: z.number().int().min(0).max(20),
    colorToken: colorTokenSchema.optional(),
});

export const ratingScaleSchema = z.object({
    levels: z.array(ratingLevelSchema).min(2).max(10),
    /**
     * The level the marking screen pre-sets every child to - the "as expected" one.
     *
     * **The entire daily flow depends on this being the common case.** Doc 05 §3: a class of
     * thirty-five where four children stood out must be four taps, not thirty-five decisions. If a
     * framework points `defaultKey` at anything other than the level most children are at, the
     * marking screen stops being fast and the module stops being used.
     */
    defaultKey: z.string().min(1),
})
    .refine(
        (s) => s.levels.some((l) => l.key === s.defaultKey),
        { message: 'defaultKey must be one of the levels', path: ['defaultKey'] },
    )
    .refine(
        (s) => new Set(s.levels.map((l) => l.key)).size === s.levels.length,
        { message: 'level keys must be unique', path: ['levels'] },
    )
    .refine(
        (s) => new Set(s.levels.map((l) => l.order)).size === s.levels.length,
        { message: 'level orders must be unique', path: ['levels'] },
    );

export type RatingLevel = z.infer<typeof ratingLevelSchema>;
export type RatingScale = z.infer<typeof ratingScaleSchema>;

/**
 * The default four-level scale.
 *
 * **These are Nepal's official names, not ours.** The CDC guidance
 * (`आधारभूत तह कक्षा ४-५ मा विद्यार्थी मूल्याङ्कन मार्गदर्शन २०८३`) defines exactly four levels and
 * prints its own English glosses beside the Nepali, so there is nothing to invent:
 *
 *   १ आधारभूतभन्दा कम (Below basic) · २ आधारभूत (Basic) · ३ दक्ष (Proficient) · ४ उच्च (Advanced)
 *
 * An earlier draft shipped Beginning / Developing / Secure / Exceeding, which read well and matched
 * no government form anywhere. A school being inspected has to hand over a record whose levels are
 * the ones the inspector is looking for, so the country's own vocabulary wins over ours.
 *
 * `BASIC` is the default key - the level the marking screen pre-sets every child to. The CDC
 * descriptor for it is "partially achieved, but remedial learning needed", which is the honest
 * pre-set for a class that has just been taught something: it claims the lesson happened, not that
 * every child mastered it. A framework may point `defaultKey` anywhere; this is only the default
 * default.
 */
export const DEFAULT_RATING_SCALE: RatingScale = {
    levels: [
        {
            key: 'BELOW_BASIC',
            label: 'Below basic',
            description: 'Has not achieved this yet. Remedial teaching needed.',
            order: 0,
            colorToken: 'rose',
        },
        {
            key: 'BASIC',
            label: 'Basic',
            description: 'Partly there, but still needs remedial teaching.',
            order: 1,
            colorToken: 'amber',
        },
        {
            key: 'PROFICIENT',
            label: 'Proficient',
            description: 'Has achieved most of this.',
            order: 2,
            colorToken: 'emerald',
        },
        {
            key: 'ADVANCED',
            label: 'Advanced',
            description: 'Has achieved this fully.',
            order: 3,
            colorToken: 'teal',
        },
    ],
    defaultKey: 'PROFICIENT',
};

/** The ascending order of a level key, or `null` if the key is not in this scale. */
export function levelOrder(scale: RatingScale, key: string): number | null {
    return scale.levels.find((l) => l.key === key)?.order ?? null;
}

/** The level with the given order, or `null`. */
export function levelByOrder(scale: RatingScale, order: number): RatingLevel | null {
    return scale.levels.find((l) => l.order === order) ?? null;
}

/** Levels lowest-first. Callers must not rely on the stored array being sorted. */
export function sortedLevels(scale: RatingScale): RatingLevel[] {
    return [...scale.levels].sort((a, b) => a.order - b.order);
}

/**
 * Parse a stored `ratingScale` jsonb column, falling back to the default.
 *
 * Falls back rather than throwing because this is read on the marking screen: a framework with a
 * malformed scale should show a teacher the default four levels, not a broken page. The admin screen
 * uses `ratingScaleSchema.parse` directly so an author sees the real error on write.
 */
export function parseRatingScale(value: unknown): RatingScale {
    const parsed = ratingScaleSchema.safeParse(value);
    return parsed.success ? parsed.data : DEFAULT_RATING_SCALE;
}
