import { z } from 'zod';
import { type RatingScale, levelOrder } from './rating-scale';

/**
 * # The grade layer - a percentage and a letter, where a country requires one
 *
 * Nepal's CDC guidance (`आधारभूत तह कक्षा ४-५ मा विद्यार्थी मूल्याङ्कन मार्गदर्शन २०८३`) mandates
 * both. For each subject area it prescribes, verbatim:
 *
 *   `उपलब्धि प्रतिशत = (सिकाइ उपलब्धिको अङ्कको जोड) / (४ × मूल्याङ्कन गरिएका सिकाइ उपलब्धिहरूको सङ्ख्या) × १००`
 *
 * then maps that percentage onto A+ / A / B+ / B / C+ / C / D / NG with grade points.
 *
 * ## Why this exists at all, given doc 05 §7
 *
 * Doc 05 is explicit that a report to a parent must never carry a score: *"A number attached to a
 * six-year-old, delivered to a parent, becomes pressure on the child that same evening."* Nepal's
 * government is equally explicit that the form needs one.
 *
 * Both hold because this is DATA, not a policy in code. The percentage and letter are computed and
 * stored so a school can produce the government form and satisfy an inspection; `showOnParentReport`
 * decides whether the number ever reaches a parent. A country that forbids it ships a scale with
 * that flag false, or ships no scale at all and nothing here runs.
 *
 * ## The formula is the country's, not ours
 *
 * This aggregates ACROSS INDICATORS to a subject percentage. That is a different axis from
 * `rollUpSkill`, which aggregates ACROSS OBSERVATIONS to one level per indicator. They compose:
 * roll up each indicator to a level, then run those levels through here. Confusing the two would
 * produce a number that looks right and means nothing.
 */

export const gradeBandSchema = z.object({
    /** Inclusive lower bound, 0-100. Bands are evaluated highest-first. */
    minPercent: z.number().min(0).max(100),
    /** "A+", "NG". Printed on the form. */
    letter: z.string().min(1).max(6),
    /** Nepal's स्तरीकृत अङ्क - 4.0 down to 1.6, absent for NG. */
    gradePoint: z.number().min(0).max(10).nullable(),
    /** The country's own wording: सर्वोत्तम (Outstanding), ग्राह्य (Acceptable). */
    label: z.string().min(1).max(60),
});

export const gradeScaleSchema = z.object({
    /**
     * Whether the percentage and letter may appear on the report a parent reads.
     *
     * False does NOT mean "do not compute" - the school still needs the number for the official
     * form. It means the parent-facing report stays on levels and words.
     */
    showOnParentReport: z.boolean(),
    /**
     * How the percentage is derived. Only one form so far, and it is named rather than assumed so a
     * country with different arithmetic is a new value here rather than a fork of the caller.
     *
     * `LEVEL_SUM_OVER_MAX`: sum of level scores / (highest level score x indicators counted) x 100.
     */
    formula: z.literal('LEVEL_SUM_OVER_MAX'),
    bands: z.array(gradeBandSchema).min(1),
});

export type GradeBand = z.infer<typeof gradeBandSchema>;
export type GradeScale = z.infer<typeof gradeScaleSchema>;

/**
 * Nepal's official mapping, transcribed from the CDC table.
 *
 * `showOnParentReport` is TRUE here because the government's own progress-report format
 * (अनुसूची ४) carries a per-subject overall achievement level. This is the one country where the
 * number is required rather than merely permitted.
 */
export const NP_GRADE_SCALE: GradeScale = {
    showOnParentReport: true,
    formula: 'LEVEL_SUM_OVER_MAX',
    bands: [
        { minPercent: 90, letter: 'A+', gradePoint: 4.0, label: 'सर्वोत्तम (Outstanding)' },
        { minPercent: 80, letter: 'A', gradePoint: 3.6, label: 'अत्युत्तम (Excellent)' },
        { minPercent: 70, letter: 'B+', gradePoint: 3.2, label: 'उत्कृष्ट (Very Good)' },
        { minPercent: 60, letter: 'B', gradePoint: 2.8, label: 'उत्तम (Good)' },
        { minPercent: 50, letter: 'C+', gradePoint: 2.4, label: 'सन्तोषजनक (Satisfactory)' },
        { minPercent: 40, letter: 'C', gradePoint: 2.0, label: 'ग्राह्य (Acceptable)' },
        { minPercent: 35, letter: 'D', gradePoint: 1.6, label: 'आधारभूत (Basic)' },
        { minPercent: 0, letter: 'NG', gradePoint: null, label: 'अवर्गीकृत (Not graded)' },
    ],
};

/**
 * The subject or subject-area percentage from a set of confirmed levels.
 *
 * Returns null for an empty set rather than 0. **Absence of evidence is not a zero measurement** -
 * a child with nothing recorded has not scored nought, and a 0% on a report about a six-year-old is
 * the single most damaging thing this module could print.
 */
export function achievementPercent(levels: string[], scale: RatingScale): number | null {
    const orders = levels
        .map(k => levelOrder(scale, k))
        .filter((o): o is number => o !== null);

    if (orders.length === 0) return null;

    // Nepal scores levels 1..4 while our `order` is 0-based, so each contributes `order + 1` and
    // the maximum is the top level's order + 1. Deriving the ceiling from the SCALE rather than
    // hardcoding 4 is what lets a three- or five-level country use the same formula.
    const max = Math.max(...scale.levels.map(l => l.order)) + 1;
    const sum = orders.reduce((a, o) => a + (o + 1), 0);

    return Math.round((sum / (max * orders.length)) * 1000) / 10;
}

/** The band a percentage falls into. Highest threshold first, so band order in the data is free. */
export function bandForPercent(percent: number, scale: GradeScale): GradeBand | null {
    return [...scale.bands]
        .sort((a, b) => b.minPercent - a.minPercent)
        .find(b => percent >= b.minPercent) ?? null;
}

export function parseGradeScale(value: unknown): GradeScale | null {
    const parsed = gradeScaleSchema.safeParse(value);
    return parsed.success ? parsed.data : null;
}

/**
 * The full result for one subject or subject area.
 *
 * `letter` is null when the framework carries no grade scale - which is the normal case for a
 * country that does not use one, not an error.
 */
export function gradeSubject(
    levels: string[],
    ratingScale: RatingScale,
    gradeScale: GradeScale | null,
): { percent: number | null; band: GradeBand | null; indicatorCount: number } {
    const percent = achievementPercent(levels, ratingScale);
    return {
        percent,
        band: percent !== null && gradeScale ? bandForPercent(percent, gradeScale) : null,
        indicatorCount: levels.length,
    };
}
