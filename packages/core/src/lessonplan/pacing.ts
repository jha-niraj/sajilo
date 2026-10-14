// Lesson Plan 2.0 - pacing / drift classification (Phase 3). Pure, deterministic, NO AI.
// srs/lessonplan/08. The one rule that cannot be broken: absence of logging is NOT behind-ness.
// If too little has been logged, the honest state is UNKNOWN (never amber/red) - the fix there is
// adoption, not academic intervention. Same principle as "no attendance rows != 0% attendance".

export type RiskLevel = 'ON_TRACK' | 'AT_RISK' | 'BEHIND' | 'SYLLABUS_AT_RISK' | 'UNKNOWN';

export interface PacingInput {
    /** Periods the plan says should have been delivered by today. */
    expected: number;
    /** Periods actually delivered (TAUGHT = 1, PARTIAL = 0.5, SUBSTITUTED = 1). */
    delivered: number;
    /** Past teachable periods with NO log row at all. */
    unlogged: number;
    /** The plan will not finish an examinable unit before its exam term. */
    collision?: boolean;
    /** The whole year's plan cannot finish (structural, not a teaching gap). */
    yearInfeasible?: boolean;
}

export interface PacingResult {
    driftPeriods: number;      // delivered - expected; negative = behind
    paceRatio: number | null;  // delivered / expected
    riskLevel: RiskLevel;
    unknown: boolean;          // too little logged to judge
}

// If more than this fraction of expected periods have no log, we cannot judge pace honestly.
const UNKNOWN_THRESHOLD = 0.3;

export function classifyPacing(input: PacingInput): PacingResult {
    // Nothing due yet, or nothing logged: UNKNOWN, never a fake zero/red.
    if (input.expected <= 0) {
        return { driftPeriods: 0, paceRatio: null, riskLevel: 'UNKNOWN', unknown: true };
    }
    if (input.unlogged / input.expected > UNKNOWN_THRESHOLD) {
        return { driftPeriods: 0, paceRatio: null, riskLevel: 'UNKNOWN', unknown: true };
    }

    const driftPeriods = Math.round((input.delivered - input.expected) * 10) / 10;
    const paceRatio = input.delivered / input.expected;

    let riskLevel: RiskLevel;
    if (input.yearInfeasible) {
        riskLevel = 'SYLLABUS_AT_RISK';
    } else if (driftPeriods >= -2) {
        riskLevel = 'ON_TRACK';
    } else if (driftPeriods >= -6) {
        riskLevel = 'AT_RISK';
    } else {
        riskLevel = 'BEHIND';
    }
    // A known "examined before taught" collision bumps an otherwise-fine class to at-risk.
    if (input.collision && riskLevel === 'ON_TRACK') riskLevel = 'AT_RISK';

    return { driftPeriods, paceRatio, riskLevel, unknown: false };
}
