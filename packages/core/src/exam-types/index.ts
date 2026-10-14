/**
 * The single shared vocabulary for assessment types across the platform.
 *
 * Both `exam_schedules.examType` (paper exams) and `online_exams.examType` (online exams)
 * store one of these CODES. Never store a display string in the database - store the code
 * and render `examTypeLabel(code, customLabel)` at the edge.
 *
 * CUSTOM is the escape hatch. When an exam is CUSTOM, the free-text name lives in the
 * accompanying `examTypeLabel` column, so a school can run an assessment we never
 * anticipated without waiting on a schema change.
 */

export const EXAM_TYPE_CODES = [
    'UNIT_TEST',
    'WEEKLY_TEST',
    'MONTHLY_TEST',
    'CLASS_TEST',
    'SURPRISE_TEST',
    'MID_TERM',
    'PRE_BOARD',
    'FINAL_TERM',
    'QUARTERLY',
    'HALF_YEARLY',
    'ANNUAL',
    'PRACTICAL',
    'SUPPLEMENTARY',
    'CUSTOM',
] as const;

export type ExamTypeCode = (typeof EXAM_TYPE_CODES)[number];

/**
 * "Short cycle" assessments are the low-stakes, high-frequency ones a teacher can spin up on
 * the spot. They default to lighter settings (shorter duration, immediate results) and are
 * excluded from term aggregates unless a school opts them in.
 */
export const SHORT_CYCLE_EXAM_TYPES = [
    'UNIT_TEST',
    'WEEKLY_TEST',
    'MONTHLY_TEST',
    'CLASS_TEST',
    'SURPRISE_TEST',
] as const satisfies readonly ExamTypeCode[];

/** "Terminal" assessments are the formal ones that feed report cards and annual results. */
export const TERMINAL_EXAM_TYPES = [
    'MID_TERM',
    'PRE_BOARD',
    'FINAL_TERM',
    'QUARTERLY',
    'HALF_YEARLY',
    'ANNUAL',
] as const satisfies readonly ExamTypeCode[];

export interface ExamTypeMeta {
    code: ExamTypeCode;
    /** Human label shown in menus, badges and PDFs. */
    label: string;
    /** One-line hint shown under the option in the create wizard. */
    hint: string;
    /** Grouping for option lists and filter menus. */
    group: 'Short cycle' | 'Terminal' | 'Other';
    /** Sensible default duration in minutes when a teacher picks this type. */
    defaultDurationMinutes: number;
    /** Whether results normally roll up into report cards / term aggregates. */
    countsTowardReportCard: boolean;
}

export const EXAM_TYPE_META: Record<ExamTypeCode, ExamTypeMeta> = {
    UNIT_TEST: {
        code: 'UNIT_TEST',
        label: 'Unit Test',
        hint: 'A short test at the end of a chapter or unit.',
        group: 'Short cycle',
        defaultDurationMinutes: 30,
        countsTowardReportCard: false,
    },
    WEEKLY_TEST: {
        code: 'WEEKLY_TEST',
        label: 'Weekly Test',
        hint: 'A recurring end-of-week check on what was covered.',
        group: 'Short cycle',
        defaultDurationMinutes: 30,
        countsTowardReportCard: false,
    },
    MONTHLY_TEST: {
        code: 'MONTHLY_TEST',
        label: 'Monthly Test',
        hint: 'A month-end assessment across recent chapters.',
        group: 'Short cycle',
        defaultDurationMinutes: 45,
        countsTowardReportCard: false,
    },
    CLASS_TEST: {
        code: 'CLASS_TEST',
        label: 'Class Test',
        hint: 'An in-class test run during a single period.',
        group: 'Short cycle',
        defaultDurationMinutes: 30,
        countsTowardReportCard: false,
    },
    SURPRISE_TEST: {
        code: 'SURPRISE_TEST',
        label: 'Surprise Test',
        hint: 'An unannounced test - create it and start it in minutes.',
        group: 'Short cycle',
        defaultDurationMinutes: 20,
        countsTowardReportCard: false,
    },
    MID_TERM: {
        code: 'MID_TERM',
        label: 'Mid-Term',
        hint: 'The formal mid-term examination.',
        group: 'Terminal',
        defaultDurationMinutes: 90,
        countsTowardReportCard: true,
    },
    PRE_BOARD: {
        code: 'PRE_BOARD',
        label: 'Pre-Board',
        hint: 'A full-length rehearsal for the SEE or NEB board exam.',
        group: 'Terminal',
        defaultDurationMinutes: 180,
        countsTowardReportCard: true,
    },
    FINAL_TERM: {
        code: 'FINAL_TERM',
        label: 'Final Term',
        hint: 'The end-of-term examination.',
        group: 'Terminal',
        defaultDurationMinutes: 120,
        countsTowardReportCard: true,
    },
    QUARTERLY: {
        code: 'QUARTERLY',
        label: 'Quarterly',
        hint: 'The quarterly examination.',
        group: 'Terminal',
        defaultDurationMinutes: 90,
        countsTowardReportCard: true,
    },
    HALF_YEARLY: {
        code: 'HALF_YEARLY',
        label: 'Half Yearly',
        hint: 'The half-yearly examination.',
        group: 'Terminal',
        defaultDurationMinutes: 120,
        countsTowardReportCard: true,
    },
    ANNUAL: {
        code: 'ANNUAL',
        label: 'Annual',
        hint: 'The final examination of the academic year.',
        group: 'Terminal',
        defaultDurationMinutes: 180,
        countsTowardReportCard: true,
    },
    PRACTICAL: {
        code: 'PRACTICAL',
        label: 'Practical',
        hint: 'A lab or practical assessment.',
        group: 'Other',
        defaultDurationMinutes: 60,
        countsTowardReportCard: true,
    },
    SUPPLEMENTARY: {
        code: 'SUPPLEMENTARY',
        label: 'Supplementary',
        hint: 'A re-sit for students who did not pass.',
        group: 'Other',
        defaultDurationMinutes: 120,
        countsTowardReportCard: true,
    },
    CUSTOM: {
        code: 'CUSTOM',
        label: 'Custom',
        hint: 'Name this assessment yourself.',
        group: 'Other',
        defaultDurationMinutes: 60,
        countsTowardReportCard: false,
    },
};

/** Option list for a select, in the order schools think about assessments. */
export const EXAM_TYPE_OPTIONS: ExamTypeMeta[] = EXAM_TYPE_CODES.map((c) => EXAM_TYPE_META[c]);

export const EXAM_TYPE_GROUPS: ExamTypeMeta['group'][] = ['Short cycle', 'Terminal', 'Other'];

export function isExamTypeCode(value: unknown): value is ExamTypeCode {
    return typeof value === 'string' && (EXAM_TYPE_CODES as readonly string[]).includes(value);
}

export function isShortCycleExamType(code: ExamTypeCode): boolean {
    return (SHORT_CYCLE_EXAM_TYPES as readonly ExamTypeCode[]).includes(code);
}

/**
 * Render an exam type for display. A CUSTOM exam shows its own free-text name; anything else
 * shows the canonical label. Falls back to a readable form of an unknown code rather than
 * showing a raw enum value to a parent or student.
 */
export function examTypeLabel(
    code: string | null | undefined,
    customLabel?: string | null,
): string {
    if (code === 'CUSTOM') return customLabel?.trim() || 'Custom';
    if (isExamTypeCode(code)) return EXAM_TYPE_META[code].label;
    if (!code) return 'Exam';
    return code.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase());
}

/**
 * Map a legacy free-text value to a canonical code. `online_exams.examType` used to store
 * display strings from a hardcoded array ('Unit Test', 'Mid-Term', ...), so the migration and
 * any older client payload both run through here. Returns null when nothing matches, which
 * the caller should treat as CUSTOM (preserving the original text as the custom label).
 */
export function normalizeExamType(value: string | null | undefined): ExamTypeCode | null {
    if (!value) return null;
    const key = value.trim().toUpperCase().replace(/[\s-]+/g, '_');
    if (isExamTypeCode(key)) return key;
    const aliases: Record<string, ExamTypeCode> = {
        FINAL: 'FINAL_TERM',
        FINALS: 'FINAL_TERM',
        TERMINAL: 'FINAL_TERM',
        MIDTERM: 'MID_TERM',
        MID: 'MID_TERM',
        PREBOARD: 'PRE_BOARD',
        PRE_BOARD_EXAM: 'PRE_BOARD',
        WEEKLY: 'WEEKLY_TEST',
        MONTHLY: 'MONTHLY_TEST',
        UNIT: 'UNIT_TEST',
        CHAPTER_TEST: 'UNIT_TEST',
        CLASS_TEST_EXAM: 'CLASS_TEST',
        SURPRISE: 'SURPRISE_TEST',
        POP_QUIZ: 'SURPRISE_TEST',
        QUIZ: 'CLASS_TEST',
        HALFYEARLY: 'HALF_YEARLY',
        HALF_YEAR: 'HALF_YEARLY',
        YEARLY: 'ANNUAL',
        FINAL_EXAM: 'FINAL_TERM',
    };
    return aliases[key] ?? null;
}
