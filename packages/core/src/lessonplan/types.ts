// Lesson Plan 2.0 - period-budget engine types (Phase 0).
//
// Pure, DB-agnostic. The server action (apps/main) and the pacing cron (apps/worker) adapt real
// rows into these shapes. NO AI here - this is the deterministic trust anchor (srs/lessonplan/03).
//
// Date convention: all dates are ISO 'YYYY-MM-DD' strings in AD (storage calendar). dayOfWeek is
// normalised to 0=Sunday .. 6=Saturday (JS getUTCDay). The adapter is responsible for mapping
// timetable_periods.dayOfWeek into this convention before calling the engine.

/** One recurring slot in the weekly timetable for a subject-class-section. */
export interface WeeklySlot {
    dayOfWeek: number;      // 0=Sun .. 6=Sat
    periodNumber: number;
    startTime: string;      // "HH:MM"
    endTime: string;
}

/** A date range to subtract from teaching (holiday / exam window / declared non-teaching). Inclusive. */
export interface SubtractRange {
    startISO: string;       // 'YYYY-MM-DD' AD
    endISO: string;         // inclusive; equals startISO for a single day
    label: string;          // "Dashain", "First Term exams"
    refId: string;          // the holidays.id / exam_terms.id it came from (for click-through)
    kind: 'holiday' | 'exam_term' | 'non_teaching';
}

/** A unit with whatever demand signals exist. Any signal may be absent. */
export interface UnitDemandInput {
    unitId: string;
    title: string;
    orderIndex: number;
    pages?: number | null;             // endPage - startPage
    lessonCount?: number | null;
    pastPaperMarkPct?: number | null;  // 0..1 share of past-paper marks for this unit
}

/** An exam term to check "examined before taught" collisions against. */
export interface ExamTermInput {
    termId: string;
    name: string;
    startISO: string;       // 'YYYY-MM-DD' AD
}

export interface ReservedInput {
    revisionPeriods: number;
    assessmentPeriods: number;
    slackPercent: number;   // e.g. 8
}

export interface BudgetInput {
    yearStartISO: string;
    yearEndISO: string;
    weeklySlots: WeeklySlot[];       // empty => periodsPerWeek unknown (no timetable)
    subtractRanges: SubtractRange[];
    reserved: ReservedInput;
    units: UnitDemandInput[];
    examTerms: ExamTermInput[];
    // Demand-signal medians (school/subject level). Sensible defaults if absent.
    medianPagesPerPeriod?: number;   // default 1.4
    medianPeriodsPerLesson?: number; // default 1.6
    hasSyllabus: boolean;            // false => demand side is skipped, budget still shown
    hasHolidays: boolean;            // false => a banner; the number is optimistic
}

// ── Output ──────────────────────────────────────────────────────────────────

export interface TeachableDate {
    dateISO: string;
    dayOfWeek: number;
    periodNumber: number;
}

export type DemandMethod = 'blend' | 'pages_only' | 'lessons_only' | 'exam_only' | 'even_split';

export interface UnitAllocation {
    unitId: string;
    title: string;
    orderIndex: number;
    estimatePeriods: number;
    weightBasis: {
        pages: number | null;
        lessons: number | null;
        pastPaperPct: number | null;
        method: DemandMethod;
        estimatePeriods: number;
    };
    allocatedPeriods: number;        // periods actually placed on the calendar (<= estimate if we ran out)
    targetStartISO: string | null;   // null = could not be placed (past year end) = part of the tail
    targetEndISO: string | null;
}

export interface Subtraction {
    label: string;
    periods: number;
    source: 'holiday' | 'exam_term' | 'reserved_revision' | 'reserved_assessment' | 'slack';
    refIds?: string[];
}

export interface Collision {
    unitId: string;
    unitTitle: string;
    examTermId: string;
    termName: string;
    unitEndISO: string | null;
    termStartISO: string;
    periodsShort: number;
    /** The ready-made sentence for the UI. */
    sentence: string;
}

export interface RepaceOption {
    key: 'reduce_slack' | 'flat_trim' | 'reschedule_tail' | 'self_study_tail' | 'add_period';
    label: string;
    recoversPeriods: number;
    cost: string;                    // stated in the same terms as the benefit
}

export type BudgetWarning = 'NO_TIMETABLE' | 'NO_HOLIDAYS' | 'NO_SYLLABUS' | 'NO_EXAM_TERMS';

export type Feasibility = 'FITS' | 'TIGHT' | 'DOES_NOT_FIT' | 'UNKNOWN';

export interface BudgetResult {
    periodsPerWeek: number | null;
    teachableDates: TeachableDate[];
    periodsAvailable: number | null;
    reserved: { revision: number; assessment: number; slack: number; total: number };
    periodsForNewTeaching: number | null;
    units: UnitAllocation[];
    demandTotal: number | null;
    deficit: number | null;          // demand - forNewTeaching; > 0 = short
    feasibility: Feasibility;
    tailUnitId: string | null;
    collisions: Collision[];
    options: RepaceOption[];
    subtractions: Subtraction[];
    warnings: BudgetWarning[];
}
