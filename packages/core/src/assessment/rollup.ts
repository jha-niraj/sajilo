import { type RatingScale, levelOrder, sortedLevels } from './rating-scale';
import { type RollupRules, type OverallBand } from './rules';

/**
 * # The roll-up - observations in, a PROPOSED level out
 *
 * Pure functions, no database, no dates beyond what is passed in. That is what makes this testable,
 * and this is the one part of the module that must not be got wrong: it produces a written judgement
 * about a named child, and CLAUDE.md's data-correctness rules apply directly.
 *
 * ## It proposes. It never decides.
 *
 * Nothing here writes a confirmed level. The output is a proposal a human confirms or overrides with
 * a reason, which is doc 05 §4's whole design and the rule that stops the module collapsing back into
 * the paper form.
 *
 * ## Not enough evidence is an OUTPUT
 *
 * Below the floors this returns `NOT_ENOUGH_EVIDENCE`, never a level, and it never widens the window
 * to find one. Doc 05 §4, doc 04 §9 and the `pagesVerified` comment in `curriculum.ts` all state the
 * same principle in different words, and the codebase already agrees with the plans on it:
 * a confident wrong answer is strictly worse than a refusal.
 */

/** Sources that came from a machine rather than a person. */
const MACHINE_SOURCES = new Set(['PAILA', 'STUDENT_APP']);

export type ObservationInput = {
    /** A key from the framework's rating scale. */
    level: string;
    observedAt: Date;
    isBulkDefault: boolean;
    /** `skill_observations.source`. Kept as a string so this package never imports the db schema. */
    source: string;
};

export type RollupResult =
    | {
        status: 'NOT_ENOUGH_EVIDENCE';
        /** TOO_FEW: not enough observations. TOO_CONCENTRATED: enough, but not spread over enough days. */
        reason: 'NONE' | 'TOO_FEW' | 'TOO_CONCENTRATED';
        evidenceCount: number;
        distinctDays: number;
        /** True when every observation was a pre-set default. Surfaced by the coverage screen. */
        allBulkDefault: boolean;
        /** True when the only evidence came from a machine. Can never become a confirmed judgement. */
        machineOnly: boolean;
    }
    | {
        status: 'PROPOSED';
        level: string;
        evidenceCount: number;
        distinctDays: number;
        allBulkDefault: boolean;
        machineOnly: boolean;
        /** Total weight landing on each level key. Shown in the "why" panel on the term review. */
        weightByLevel: Record<string, number>;
    };

/** Local calendar day, so two observations at 09:00 and 16:00 count as one day. */
function dayKey(d: Date): string {
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/**
 * The weight one observation carries.
 *
 * A bulk default and a machine record are both weaker claims than a teacher's deliberate tap, and a
 * row can be both - Paila writing a default is not a case we have today, but multiplying rather than
 * branching means it behaves sensibly if it ever happens.
 */
function observationWeight(o: ObservationInput, rules: RollupRules, now: Date): number {
    let w = 1;
    if (o.isBulkDefault) w *= rules.bulkDefaultWeight;
    if (MACHINE_SOURCES.has(o.source)) w *= rules.machineEvidenceWeight;

    if (rules.aggregation === 'RECENT_WEIGHTED') {
        const ageDays = (now.getTime() - o.observedAt.getTime()) / 86_400_000;
        // Inside the window counts double what falls outside it. Two flat bands rather than a decay
        // curve, because "what she did lately counts double" is a sentence a principal can act on and
        // an exponential half-life is not.
        w *= ageDays <= rules.recentWindowDays ? 1 : 0.5;
    }

    return w;
}

/**
 * Propose a level for one child and one skill from their observations in a period.
 *
 * `now` is passed in rather than read, so RECENT_WEIGHTED is deterministic under test.
 */
export function rollUpSkill(
    observations: ObservationInput[],
    rules: RollupRules,
    scale: RatingScale,
    now: Date = new Date(),
): RollupResult {
    // Ignore anything whose level is not in this framework's scale. A framework revision can retire a
    // level, and a stale row must not be able to propose a level the school no longer uses.
    const valid = observations.filter((o) => levelOrder(scale, o.level) !== null);

    const evidenceCount = valid.length;
    const distinctDays = new Set(valid.map((o) => dayKey(o.observedAt))).size;
    const allBulkDefault = evidenceCount > 0 && valid.every((o) => o.isBulkDefault);
    const machineOnly = evidenceCount > 0 && valid.every((o) => MACHINE_SOURCES.has(o.source));

    const base = { evidenceCount, distinctDays, allBulkDefault, machineOnly };

    if (evidenceCount === 0) {
        return { status: 'NOT_ENOUGH_EVIDENCE', reason: 'NONE', ...base };
    }
    if (evidenceCount < rules.minObservations) {
        return { status: 'NOT_ENOUGH_EVIDENCE', reason: 'TOO_FEW', ...base };
    }
    if (distinctDays < rules.minDistinctDays) {
        return { status: 'NOT_ENOUGH_EVIDENCE', reason: 'TOO_CONCENTRATED', ...base };
    }

    const weightByLevel: Record<string, number> = {};
    for (const o of valid) {
        weightByLevel[o.level] = (weightByLevel[o.level] ?? 0) + observationWeight(o, rules, now);
    }

    const level = rules.aggregation === 'HIGHEST_SUSTAINED'
        ? highestSustained(valid, scale)
        : heaviestLevel(weightByLevel, scale);

    // HIGHEST_SUSTAINED can find nothing if no single level was reached on two different days, even
    // though the floors passed - four observations at four different levels, say. That is a real
    // "not enough evidence" answer rather than a reason to fall back to another mode.
    if (level === null) {
        return { status: 'NOT_ENOUGH_EVIDENCE', reason: 'TOO_CONCENTRATED', ...base };
    }

    return { status: 'PROPOSED', level, ...base, weightByLevel };
}

/**
 * The level carrying the most weight.
 *
 * **Ties go to the LOWER level, deliberately.** A child equally often Developing and Secure is
 * proposed Developing, and the teacher - who has actually met them - can raise it with one tap. The
 * asymmetry is on purpose: over-claiming about a child is the more expensive mistake, because it is
 * the one nobody goes back and checks.
 */
function heaviestLevel(weightByLevel: Record<string, number>, scale: RatingScale): string | null {
    let best: { key: string; weight: number; order: number } | null = null;

    for (const [key, weight] of Object.entries(weightByLevel)) {
        const order = levelOrder(scale, key);
        if (order === null) continue;

        if (
            best === null
            || weight > best.weight
            || (weight === best.weight && order < best.order)
        ) {
            best = { key, weight, order };
        }
    }

    return best?.key ?? null;
}

/** The highest level the child reached on at least two different days. */
function highestSustained(observations: ObservationInput[], scale: RatingScale): string | null {
    const daysByLevel = new Map<string, Set<string>>();
    for (const o of observations) {
        const set = daysByLevel.get(o.level) ?? new Set<string>();
        set.add(dayKey(o.observedAt));
        daysByLevel.set(o.level, set);
    }

    for (const lvl of sortedLevels(scale).reverse()) {
        if ((daysByLevel.get(lvl.key)?.size ?? 0) >= 2) return lvl.key;
    }
    return null;
}

/**
 * The school's own descriptor for a whole term, from the share of skills at or above a level.
 *
 * Bands are evaluated highest-threshold first, so a school can list them in any order and still get
 * the band it meant. Returns null when no band matches or none are configured - and a report with no
 * band is a complete report, since the per-skill levels and the teacher's sentence carry it.
 */
export function resolveOverallBand(
    judgedLevels: string[],
    bands: OverallBand[],
    scale: RatingScale,
): OverallBand | null {
    if (bands.length === 0 || judgedLevels.length === 0) return null;

    const sorted = [...bands].sort((a, b) => b.minPercentAtOrAbove - a.minPercentAtOrAbove);

    for (const band of sorted) {
        const threshold = levelOrder(scale, band.level);
        if (threshold === null) continue;

        const atOrAbove = judgedLevels.filter((k) => {
            const o = levelOrder(scale, k);
            return o !== null && o >= threshold;
        }).length;

        const percent = (atOrAbove / judgedLevels.length) * 100;
        if (percent >= band.minPercentAtOrAbove) return band;
    }

    return null;
}

/**
 * Whether a proposal may be confirmed as-is.
 *
 * **Doc 05 §8 rule 3, and it is not configurable.** A machine observation is evidence that feeds a
 * proposal a human confirms; it is never a judgement on its own. So a skill whose entire evidence
 * base is Paila cannot be confirmed without the teacher either adding their own observation or
 * overriding with a reason. The term-review screen calls this and the confirm action calls it again -
 * a check that only runs in the UI is one API call away from not running at all.
 */
export function canConfirmWithoutTeacherEvidence(result: RollupResult): boolean {
    return result.status === 'PROPOSED' && !result.machineOnly;
}
