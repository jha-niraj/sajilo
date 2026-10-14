import { z } from 'zod';

/**
 * # The rule set - how observations become a proposed level
 *
 * This is the "playground" a school configures. One zod schema, read by BOTH the admin app (which
 * authors a country's default rules) and the main app (which applies a school's), so there is
 * exactly one definition of how a judgement is computed. A second copy of this is the duplication
 * guaranteed to drift, and here it would drift into two schools being told different things about
 * the same child.
 *
 * ## Why there is no formula box
 *
 * A free expression a school types was considered and rejected. The test every primitive below had to
 * pass is: **can it be explained to a parent in one sentence?**
 *
 *   *"She is Secure in blending because she showed it four times across three different weeks."*
 *
 * That is defensible to a parent and to an inspector. A typed formula is not - it cannot be
 * unit-tested, cannot be explained, and cannot be reproduced a year later when the report is
 * questioned. The failure mode is a confident wrong judgement about a named six-year-old, which is
 * the one bug this module does not get to have.
 *
 * ## Four rules are NOT configurable, and live in code rather than here
 *
 * 1. Machine evidence can never be the SOLE basis of a confirmed judgement (doc 05 §8 rule 3).
 * 2. An override always requires a reason.
 * 3. Below `minObservations` the result is NOT_ENOUGH_EVIDENCE - never a level, and never widened to
 *    find one. Absence of evidence is an output, not a zero.
 * 4. The coverage screen's "all of these are defaults" warning shows regardless of
 *    `bulkDefaultWeight`. The weight is tunable; the visibility is not.
 */

/**
 * How a level is picked from the weighted observations.
 *
 * Three named choices, not an open set, because each has to be describable on the configure screen
 * in one line a principal can act on.
 */
export const AGGREGATION_MODES = ['MODE', 'RECENT_WEIGHTED', 'HIGHEST_SUSTAINED'] as const;
export type AggregationMode = (typeof AGGREGATION_MODES)[number];

/** The one-line explanation shown beside each option. Kept here so the UI cannot invent its own. */
export const AGGREGATION_LABELS: Record<AggregationMode, { label: string; hint: string }> = {
    MODE: {
        label: 'Most common',
        hint: 'The level the child showed most often this term.',
    },
    RECENT_WEIGHTED: {
        label: 'Recent counts more',
        hint: 'The same, but what the child did lately counts double what they did earlier in the term.',
    },
    HIGHEST_SUSTAINED: {
        label: 'Best, shown more than once',
        hint: 'The highest level the child reached on at least two different days.',
    },
};

export const rollupRulesSchema = z.object({
    /**
     * How many observations before a skill can be judged at all. Below this the output is
     * NOT_ENOUGH_EVIDENCE.
     *
     * Cannot be 0 or 1. One observation is an anecdote, and a module that will certify a child from
     * a single tap is the paper form with extra steps.
     */
    minObservations: z.number().int().min(2).max(50),

    /**
     * How many DIFFERENT days those observations must span.
     *
     * Doc 03 §6 rule 1: *"One good day is not mastery. A skill needs repeated demonstrations spread
     * across days, or we are certifying luck."* Five observations in one afternoon is one afternoon.
     */
    minDistinctDays: z.number().int().min(1).max(30),

    aggregation: z.enum(AGGREGATION_MODES),

    /** Only read by RECENT_WEIGHTED. Observations inside this window count double. */
    recentWindowDays: z.number().int().min(1).max(365),

    /**
     * How much a pre-set default counts against a deliberate tap. 0 to 1.
     *
     * **This is doc 05 §3's honesty guard expressed as a number.** The marking screen pre-sets every
     * child to "as expected" and the teacher taps the exceptions, so a default row is a weaker claim
     * than a tapped one: it says "I taught this and most of them met it", not "I watched this child".
     * A school that trusts its teachers can raise it; a school that wants defaults to count for very
     * little can lower it. Either way the coverage screen still reports a default-only term.
     */
    bulkDefaultWeight: z.number().min(0).max(1),

    /**
     * How much machine evidence (Paila, the student app) counts against a teacher's tap. 0 to 1.
     *
     * Defaults below 1 because a machine saw one performance in one context and a teacher has seen
     * the child all year. This weight can never promote machine evidence into a judgement on its own -
     * that rule is in code, not here.
     */
    machineEvidenceWeight: z.number().min(0).max(1),
});

export const coverageRulesSchema = z.object({
    /**
     * Below this many observations in a term, a child appears on the coverage screen as thin.
     *
     * Doc 05 §5.2 calls this the headline finding of the whole module: the quiet child who never
     * volunteers generates no observations and, under a paper system, is discovered in the last week
     * of the year. Here they surface in week three.
     */
    thinEvidenceThreshold: z.number().int().min(1).max(100),
});

export const overallBandSchema = z.object({
    /** The share of this child's judged skills at or above `level`, 0-100. */
    minPercentAtOrAbove: z.number().min(0).max(100),
    /** A key from the framework's rating scale. */
    level: z.string().min(1),
    /** The school's own wording for the band. This is what a parent reads. */
    label: z.string().min(1).max(80),
});

export const assessmentRulesSchema = z.object({
    /** Bumped when the shape changes. Stamped onto every judgement and frozen into every report. */
    version: z.number().int().min(1),
    rollup: rollupRulesSchema,
    coverage: coverageRulesSchema,
    /**
     * Per-strand overrides, keyed by `assessment_strands.code`. Partial - anything absent falls back
     * to `rollup`.
     *
     * Exists because the strands are genuinely different kinds of evidence. Writing shows up as one
     * photographed page a week; talk in a classroom shows up every day. Demanding the same
     * `minObservations` of both makes one strand impossible to judge and the other trivial.
     */
    strandOverrides: z.record(z.string(), rollupRulesSchema.partial()).default({}),
    /**
     * Optional. A school that wants no overall descriptor leaves this empty and the report carries
     * per-skill levels and the teacher's own sentence, which is a complete report on its own.
     */
    overallBands: z.array(overallBandSchema).default([]),
});

export type RollupRules = z.infer<typeof rollupRulesSchema>;
export type CoverageRules = z.infer<typeof coverageRulesSchema>;
export type OverallBand = z.infer<typeof overallBandSchema>;
export type AssessmentRules = z.infer<typeof assessmentRulesSchema>;

/**
 * The defaults every framework starts from, and the fallback when a framework has no rules stored.
 *
 * Three observations across two days, most-common wins, a default worth half a tap and machine
 * evidence worth half a tap. Deliberately unremarkable - these are the numbers a school should be
 * able to leave alone.
 */
export const DEFAULT_ASSESSMENT_RULES: AssessmentRules = {
    version: 1,
    rollup: {
        minObservations: 3,
        minDistinctDays: 2,
        aggregation: 'MODE',
        recentWindowDays: 30,
        bulkDefaultWeight: 0.5,
        machineEvidenceWeight: 0.5,
    },
    coverage: {
        thinEvidenceThreshold: 3,
    },
    strandOverrides: {},
    overallBands: [],
};

/**
 * Parse a stored `rules` / `rulesOverride` jsonb column, falling back to the defaults.
 *
 * Falls back rather than throwing for the same reason `parseRatingScale` does: this is read on the
 * term-review screen, and a malformed blob should produce proposals under the default rules rather
 * than a broken page. The configure screen calls `assessmentRulesSchema.parse` directly so a
 * principal sees the real validation error at the moment they save.
 */
export function parseAssessmentRules(value: unknown): AssessmentRules {
    const parsed = assessmentRulesSchema.safeParse(value);
    return parsed.success ? parsed.data : DEFAULT_ASSESSMENT_RULES;
}

/**
 * The effective rules for a school: its override if it has one, otherwise the framework's, otherwise
 * the defaults.
 *
 * Wholesale replacement rather than a deep merge, deliberately. A partial merge means a principal
 * reading the configure screen cannot tell which numbers are theirs and which are inherited, and
 * "why is this child Secure" becomes a question about two documents instead of one.
 */
export function resolveEffectiveRules(
    frameworkRules: unknown,
    schoolOverride: unknown,
): AssessmentRules {
    if (schoolOverride != null) {
        const parsed = assessmentRulesSchema.safeParse(schoolOverride);
        if (parsed.success) return parsed.data;
    }
    return parseAssessmentRules(frameworkRules);
}

/** The rollup rules for one strand: the base, with that strand's overrides applied on top. */
export function rulesForStrand(rules: AssessmentRules, strandCode: string | null): RollupRules {
    if (!strandCode) return rules.rollup;
    const override = rules.strandOverrides[strandCode];
    return override ? { ...rules.rollup, ...override } : rules.rollup;
}
