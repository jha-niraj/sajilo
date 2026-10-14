// Lesson Plan 2.0 shared logic (@repo/core/lessonplan). Pure, DB-agnostic, no AI.
// Used by apps/main (Phase 0 budget action) and apps/worker (Phase 3 pacing cron).
export * from './types';
export {
    computeBudget, expandTeachableDates, computeReserved, estimateUnitDemand,
} from './budget';
export { classifyPacing, type PacingInput, type PacingResult, type RiskLevel } from './pacing';
