/**
 * Data contracts for the documents this package renders.
 *
 * ## Why these live here and not in the app
 *
 * Three of these types used to live in `apps/main` - two inside server actions
 * (`qp-export.action.ts`, `report-card.action.ts`) and one in `types/examinations/`. The renderers
 * imported them from there, which was fine while the renderers were also in the app and is
 * impossible now: a package cannot depend on the app that consumes it.
 *
 * So the direction is inverted. The package owns the shape of what it renders, and `apps/main`
 * re-exports these from their original paths, so every existing import site in the app is
 * unchanged. If a renderer needs a new field, it is added here first.
 *
 * ## Everything here must survive JSON
 *
 * These payloads are serialised and sent to `gurukul-services` over the SERVICES binding, so a
 * `Date` would arrive as a string and a `undefined` would vanish. **Every date field is already a
 * pre-formatted `string`** - deliberately, because a document should render in the school's own
 * calendar (BS or AD) and that conversion belongs at the data-gathering step, not the drawing
 * step. Keep it that way: no `Date`, and prefer `T | null` over `T | undefined`.
 */

import type { SchoolCalendarSystem } from '@repo/calendar';

// ─── Question paper ─────────────────────────────────────────────────────────────────────────────

export type QPExportQuestion = {
    questionNumber: number;
    questionText: string;
    questionType: string;
    marks: number;
    options?: string[];
    correctAnswer?: string;
    sampleAnswer?: string;
    /** Structured diagram spec. Validated with `isDrawableFigure` before it is drawn; anything
     *  unrecognised is ignored and the question prints as prose. See ./question-figure.ts. */
    figure?: unknown;
};

export type QPExportSection = {
    sectionName: string;
    sectionType?: string;
    totalMarks: number;
    instructions?: string;
    questions: QPExportQuestion[];
};

export type QuestionPaperExportData = {
    title: string;
    subject: string;
    class: string;
    academicYear: string;
    term: string;
    duration: number;
    totalMarks: number;
    instructions: string[];
    school: { name: string; address: string | null; phone: string | null; logo: string | null } | null;
    sections: QPExportSection[];
    createdById: string | null;
};

// ─── Report card bundle ─────────────────────────────────────────────────────────────────────────

export type ReportCardSubject = {
    name: string;
    obtained: number;
    maxMarks: number;
    grade: string;
    isAbsent: boolean;
};

export type ReportCardStudent = {
    rollNumber: number | null;
    name: string;
    section: string | null;
    subjects: ReportCardSubject[];
    totalObtained: number;
    totalMaxMarks: number;
    percentage: number;
    grade: string;
    rank: number | null;
    resultStatus: string;
};

export type ReportCardBundle = {
    examName: string;
    /**
     * The AD session label as stored ("2026-27"). Converted at RENDER time via
     * `formatAcademicYear` - never pre-converted by the caller, or a BS string would be run
     * through the converter twice.
     */
    academicYear: string;
    className: string | null;
    school: { name: string; address: string | null; phone: string | null; logo: string | null } | null;
    students: ReportCardStudent[];
    /** Which calendar the card is printed in. Defaults to 'AD' when the caller omits it. */
    calendarSystem?: SchoolCalendarSystem;
};

// ─── Exam analytics report ──────────────────────────────────────────────────────────────────────

/** One subject row in the snapshot (mirrors getSubjectPerformanceAnalytics). */
export interface AnalyticsReportSubject {
    name: string;
    code: string;
    avgPercentage: number;
    passRate: number;
    totalStudents: number;
    difficulty: string;
    vsSchoolAvg: number;
}

/** One point of the term-over-term average trend. */
export interface AnalyticsReportTermPoint {
    term: string;
    avg: number;
}

/** One at-risk student captured in the snapshot. */
export interface AnalyticsReportAtRisk {
    name: string;
    class: string;
    section: string;
    rollNumber: string | number | null;
    riskScore: number;
    reasons: string[];
}

/** The four AI-authored narrative sections (plain-text paragraphs). */
export interface AnalyticsReportNarrative {
    summary: string;
    strengths: string;
    concerns: string;
    recommendations: string;
}

/** The full snapshot stored in `exam_analytics_reports.data`. */
export interface ExamAnalyticsReportData {
    generatedAt: string;
    academicYear: string | null;
    termLabel: string | null;
    overall: {
        totalStudents: number;
        avgPercentage: number;
        passRate: number;
        atRiskCount: number;
    };
    subjects: AnalyticsReportSubject[];
    termSeries: AnalyticsReportTermPoint[];
    atRisk: AnalyticsReportAtRisk[];
    narrative: AnalyticsReportNarrative;
}

// ─── Brand ──────────────────────────────────────────────────────────────────────────────────────

/**
 * The two brand strings the platform-issued documents print (credit receipt, grant certificate).
 * Duplicated from `apps/main/lib/site.ts` rather than imported, because that module is a Next.js
 * app concern - it also carries site URLs and metadata helpers that have no business in a renderer.
 * Two strings is a smaller cost than the coupling.
 */
export const BRAND = {
    category: 'The School Operating System',
    tagline: 'Intelligence for every school, every student.',
} as const;

// ── Admit cards ──────────────────────────────────────────────────────────────

/** One sitting on a student's card. Dates and times are PRE-FORMATTED - see the note above. */
export interface AdmitCardSitting {
    subject: string;
    /** Already in the school's calendar, e.g. "2083 Mangsir 16". */
    date: string;
    /** Already formatted, e.g. "10:00-13:00". */
    time: string;
    venue?: string | null;
    maxMarks?: number | null;
}

export interface AdmitCardStudent {
    name: string;
    rollNumber?: string | null;
    /** e.g. "10-B". Built by the caller so the renderer never guesses the separator. */
    classLabel: string;
    boardRegistrationNumber?: string | null;
    sittings: AdmitCardSitting[];
}

/**
 * How the school's stamp appears on the card.
 *
 * `PHYSICAL` leaves the box EMPTY on purpose - the office stamps it by hand, and a printed
 * placeholder sits exactly where the real stamp needs to go. `DIGITAL` draws the uploaded image.
 * `embedded` is filled in by the renderer; callers pass `image` only.
 */
export interface AdmitCardStamp {
    mode: 'PHYSICAL' | 'DIGITAL';
    /** data: URI of the stamp image. Only read when mode is DIGITAL. */
    image?: string | null;
    /** Set internally once embedded in the document - never passed in by a caller. */
    embedded?: unknown;
}

export interface AdmitCardBatch {
    examName: string;
    academicYear: string;
    school: { name: string; address?: string | null; phone?: string | null; logo?: string | null };
    students: AdmitCardStudent[];
    stamp?: AdmitCardStamp;
}

// ── Seating plan ─────────────────────────────────────────────────────────────

export interface SeatingPlanSeat {
    studentId: string | null;
    name: string | null;
    rollNumber: number | null;
    /** e.g. "10-B". Also the key the tint is chosen by, via its index in `classes`. */
    classLabel: string | null;
}
export interface SeatingPlanBench { index: number; seats: SeatingPlanSeat[] }
export interface SeatingPlanRoom {
    roomId: string;
    roomName: string;
    seatsPerBench: number;
    benches: SeatingPlanBench[];
    seated: number;
}

/**
 * A FINISHED seating plan, as stored. The renderer never deals students - re-dealing at print time
 * would produce a different plan from the one already pinned to the door.
 */
export interface SeatingPlanDocument {
    schoolName: string;
    examName: string;
    academicYear: string;
    examMode: boolean;
    /** Class labels in legend order, so print and screen agree on which class gets which tint. */
    classes: string[];
    rooms: SeatingPlanRoom[];
    unplacedCount: number;
}

// ─── ID cards ───────────────────────────────────────────────────────────────────────────────────

/**
 * Which optional fields a school prints on a card. Mirrors `StudentFieldConfig` /
 * `StaffFieldConfig` in `apps/main/types/id-cards.ts` - the school configures these once and every
 * card in the batch obeys them.
 */
export interface IdCardStudentFields {
    showStudentId: boolean;
    showRollNumber: boolean;
    showClass: boolean;
    showSection: boolean;
    showDOB: boolean;
    showBloodGroup: boolean;
    showFatherName: boolean;
    showParentPhone: boolean;
    showAddress: boolean;
    showAcademicYear: boolean;
}

export interface IdCardStaffFields {
    showEmployeeId: boolean;
    showDesignation: boolean;
    showDepartment: boolean;
    showPhone: boolean;
    showEmail: boolean;
    showJoiningDate: boolean;
    showQualification: boolean;
}

/**
 * One person on a card.
 *
 * `photo` is a data URI or an already-signed URL - the ROUTE resolves private storage keys with
 * `signedStorageUrl()` before sending, because services cannot read a private key.
 *
 * Every date is a pre-formatted STRING. `@repo/pdf` has no calendar dependency by design, so a
 * renderer can never disagree with the app about what day it is in Bikram Sambat.
 */
export interface IdCardPerson {
    /** Stable id, used only to key the photo cache - never drawn. */
    id: string;
    name: string;
    photo: string | null;
    /** Label/value pairs already filtered by the school's field config and pre-formatted. */
    rows: Array<{ label: string; value: string }>;
    /**
     * Back-of-card rows. Empty when the school has `showBackSide` off.
     *
     * A real second side, not a duplicate: the web templates put guardian contact, blood group and
     * address here, plus a "if found, please return" line. Dropping it would have been a silent
     * regression - the setting exists and schools use it.
     */
    backRows: Array<{ label: string; value: string }>;
}

export interface IdCardBatch {
    kind: 'student' | 'staff';
    school: { name: string; address: string | null; phone: string | null; logo: string | null };
    /** Hex like `#a87f1f`. Falls back to the brand gold when absent or unparseable. */
    primaryColor: string | null;
    validityLabel: string | null;
    customTagline: string | null;
    signatureUrl: string | null;
    signatureLabel: string | null;
    /** When true, every card is followed by its back on a second sheet. */
    showBackSide: boolean;
    people: IdCardPerson[];
}

// ─── Payslip ────────────────────────────────────────────────────────────────────────────────────

/** One earning or deduction line. Amounts are numbers; the renderer owns the currency formatting. */
export interface PayslipLine { label: string; amount: number }

/**
 * A single month's payslip for one staff member.
 *
 * `payPeriod` and `generatedOn` are pre-formatted STRINGS - `@repo/pdf` has no calendar dependency,
 * so a Bikram Sambat school and an AD school both get the right month name without this package
 * knowing either calendar exists.
 */
export interface PayslipData {
    school: { name: string; address: string | null; phone: string | null; logo: string | null };
    employee: { name: string; role: string; email: string; employeeId: string | null };
    /** e.g. "Shrawan 2082" or "August 2026" - already in the school's calendar. */
    payPeriod: string;
    status: string;
    currency: string;
    basicSalary: number;
    allowances: PayslipLine[];
    grossSalary: number;
    deductions: PayslipLine[];
    totalDeductions: number;
    netSalary: number;
    remarks: string | null;
    processedBy: string | null;
    /** Pre-formatted date this slip was produced. */
    generatedOn: string;
}

// ─── Monthly attendance report ──────────────────────────────────────────────────────────────────

/** One student's month, already aggregated by the caller. */
export interface AttendanceReportRow {
    rollNumber: string;
    name: string;
    present: number;
    absent: number;
    late: number;
    halfDay: number;
    /** Days the register was actually taken for this student, NOT calendar days in the month. */
    totalDays: number;
    /**
     * Whole number, already rounded by the caller so the sheet and the screen never disagree.
     *
     * `null` means the register was never taken for this student - NOT that they attended nothing.
     * This sheet is filed as a school's official monthly record, so printing "0%" for a child
     * nobody marked puts a false claim on paper, where it cannot be corrected by context.
     */
    percentage: number | null;
    belowThreshold: boolean;
}

/**
 * The monthly attendance register for one class.
 *
 * `rows` must be the COMPLETE result set, not the page the user is looking at - the screen
 * paginates at 50 and the sheet this replaces silently printed only that page.
 *
 * `monthLabel` and `generatedOn` are pre-formatted STRINGS in the school's own calendar; this
 * package has no calendar dependency by design.
 */
export interface AttendanceReportData {
    school: { name: string; address: string | null; phone: string | null; logo: string | null };
    className: string;
    section: string | null;
    /** e.g. "Shrawan 2082" or "August 2026". */
    monthLabel: string;
    /** The pass mark the flags are computed against - printed, never assumed to be 75. */
    thresholdPercent: number;
    rows: AttendanceReportRow[];
    generatedOn: string;
}

// ─── Lesson plan ────────────────────────────────────────────────────────────────────────────────

export interface LessonPlanActivity {
    durationMinutes: number;
    activity: string;
    description: string;
    /**
     * The written page's teaching fields, when the page-by-page writer produced them. Printed under
     * the description in the same cell, each under its own label, so the sheet a teacher carries
     * has the board lines and the worked example and not only the say-aloud prose.
     */
    board?: string[] | null;
    example?: string | null;
    askTheClass?: string | null;
    listenFor?: string | null;
    /** Rosenshine slot, when the generator stamped one - printed on the rail and on the slide. */
    slot?: string | null;
    materials?: string[] | null;
    /** Already mapped to a display label ("Understand"), not the stored enum. */
    bloomsLabel: string | null;
    /**
     * An optional teaching diagram for THIS step, drawn under its description.
     *
     * `unknown` on purpose, not `DiagramSpec`. The value comes out of the `activities` jsonb
     * column, so it may predate a spec change or have been written by a model - the type would be
     * a promise the column cannot keep. The renderer runs `isDrawableDiagram` on it and draws
     * nothing when it fails, which is the same rule `<Diagram>` follows on screen.
     */
    diagram?: unknown;
}

/**
 * One lesson plan as the sheet a teacher hands in for countersignature.
 *
 * `date` and `generatedOn` are pre-formatted strings in the school's calendar.
 */
/**
 * One question as it is printed - on the teacher's plan (with its answer) and on the class set
 * (without). Built by the caller from `homework_questions`; the renderer never sees a key it is
 * not meant to print.
 */
export interface PrintQuestion {
    number: number;
    type: string;
    prompt: string;
    /** MCQ choices, in order. */
    choices: string[] | null;
    marks: number;
    /** NUMERICAL: the unit the answer is expected in, printed after the answer line. */
    unit: string | null;
    /** The teacher's copy only. Null on a student sheet. */
    answer: string | null;
}

export interface PrintQuestionSet {
    title: string;
    questions: PrintQuestion[];
}

/**
 * One CONTENT page of a v2 plan, as the sheet prints it. Only the content layer: the teacher's
 * say / ask / watch-for / board never reach paper, and a question prints with its options and
 * without its answer.
 */
export interface LessonPlanPrintPage {
    /** HOOK, CONCEPT, CHECK... - what `part` filters on. */
    kind: string;
    kindLabel: string;
    title: string;
    minutes: number;
    lead: string;
    points: string[];
    example: string;
    terms: { term: string; meaning: string }[];
    /** A shaped example (steps, a table, equations) when the writer gave one; `example` is its text. */
    exampleLayout?: PrintExampleLayout | null;
    /** `answer` and `why` are present ONLY when the route built an answers part. */
    questions: LessonPlanPrintQuestion[];
    /** A video the page shows, as a line on paper with its questions. */
    video?: { title: string; channel: string | null; duration: string | null; before: string[]; after: string | null } | null;
    summary: string[];
    /** A drawable spec (a COMPARE page's table, a constructed diagram); the renderer gates it. */
    diagram?: unknown;
    /** A generated picture, already fetched, ready to embed. Absent on a page with no figure. */
    figure?: LessonPlanPrintFigure | null;
}

/**
 * A generated raster figure on its way to paper.
 *
 * ## Why the bytes travel rather than a URL
 *
 * This carried a short-lived signed R2 URL and the renderer fetched it. That worked, but it put
 * the network inside the renderer, where a failure is swallowed silently, a figure used on two
 * pages is fetched twice, and the signed URL can expire between the payload being built and the
 * render running. The fetch now happens in `apps/main/lib/lessonplan/print-data.ts`, beside the
 * `lesson_figures` row it comes from, so all three go away. See `embedRaster` in `layout.ts` for
 * what that costs on the wire.
 *
 * Base64 because this crosses the services boundary as JSON, and a `Uint8Array` through
 * `JSON.stringify` is an object of numbered keys - twenty times the size and not an array coming
 * back. Keep it a string.
 */
export interface LessonPlanPrintFigure {
    /** The image file, base64. PNG or JPEG; the renderer sniffs the magic bytes and ignores anything else. */
    data: string;
    /** What the row claimed the bytes are. Advisory only - see above. */
    mime: string;
    /**
     * A line printed under the picture, or null for none.
     *
     * This is where the review flag lands. A tier-two figure that no human has ticked yet prints
     * with the same warning the screen shows, because a plan handed round on paper is exactly
     * where an unchecked generated label stops being questioned.
     */
    caption?: string | null;
}

/**
 * One question on paper, in every shape the page model allows. The class copy draws what the
 * student writes ON: lines for words, a box for a number, a gap for a blank, two circles for true or
 * false, two columns to match, numbered boxes to order. The `-answers` copy adds the key.
 */
export interface LessonPlanPrintQuestion {
    type: string;
    question: string;
    options: string[];
    note: string | null;
    /** NUMERIC: printed after the box. */
    unit: string | null;
    /** MATCH: the left column and the right column as the class sees them (already shuffled). */
    match: { left: string[]; right: string[] } | null;
    /** ORDER: the items as the class sees them (already shuffled). */
    items: string[] | null;
    /** SHORT: how many ruled lines the model answer needs. */
    lines: number;
    answer?: string | null;
    why?: string | null;
}

export type PrintExampleLayout =
    | { kind: 'steps'; steps: string[] }
    | { kind: 'table'; columns: string[]; rows: string[][] }
    | { kind: 'equations'; lines: string[] };

/**
 * The eleven-section पाठ योजना, filled from the plan. Everything a head teacher signs and an
 * inspector reads, in the order the form has it. Built by the route from the plan AND its teacher
 * layer, which is why it is a separate payload: the content pages deliberately carry no teacher
 * layer, and this form is the one print that needs it.
 */
export interface LessonPlanFormData {
    teacherName: string | null;
    headName: string | null;
    /** Pre-formatted in the school's calendar. */
    date: string;
    periodLabel: string | null;
    section: string | null;
    aims: string[];
    specificObjectives: string[];
    materials: string[];
    previousKnowledge: string;
    introduction: string;
    /** One row per page: the step, what is taught, minutes. */
    presentation: { step: string; what: string; minutes: number }[];
    comprehension: { question: string; answer: string }[];
    boardSummary: string[];
    evaluation: string[];
    homework: string;
}

/**
 * Which part of a v2 plan to print. Students have the book and an exercise book; the teacher
 * decides what goes on paper. `lesson` is the content pages; `check` / `practice` are the class
 * copies of those pages' questions; the `-answers` variants are the teacher's copies.
 */
export type LessonPlanPrintPart = 'lesson' | 'check' | 'check-answers' | 'practice' | 'practice-answers' | 'form';

export interface LessonPlanData {
    /** Present on a v2 plan. When set, the activities table is not printed; these pages are. */
    pages?: LessonPlanPrintPage[] | null;
    part?: LessonPlanPrintPart | null;
    school: { name: string; address: string | null; phone: string | null; logo: string | null };
    subject: string;
    className: string;
    topic: string;
    durationMinutes: number;
    bloomsLabel: string | null;
    teacherName: string | null;
    /** Curriculum anchoring, when the plan is tagged to an adopted table of contents. */
    unitLabel: string | null;
    lessonLabel: string | null;
    objectives: string[];
    materials: string[];
    activities: LessonPlanActivity[];
    assessment: string | null;
    homework: string | null;
    differentiationSupport: string | null;
    differentiationStretch: string | null;
    notes: string | null;
    /** The plan's own date, pre-formatted. */
    date: string;
    generatedOn: string;
    /**
     * At most one puzzle. `unknown` because it comes out of a jsonb column written by a model, and
     * because the renderer's gate SOLVES it rather than type-checking it.
     */
    puzzle?: unknown;
    /** The generated check and homework, when the plan has them. Answers included: this is the teacher's sheet. */
    check?: PrintQuestionSet | null;
    homeworkQuestions?: PrintQuestionSet | null;
    /** Present only when `part` is `form`. */
    form?: LessonPlanFormData | null;
}

/** The class set: one strip per student, cut from A4, no answers. */
export interface CheckSheetData {
    school: { name: string; address: string | null; phone: string | null; logo: string | null };
    subject: string;
    className: string;
    topic: string;
    /** Pre-formatted in the school's calendar. */
    date: string;
    set: PrintQuestionSet;
    /** How many strips to print - normally the roster size. */
    copies: number;
}

// ─── Lesson-plan register ───────────────────────────────────────────────────────────────────────

export interface LessonRegisterEntry {
    /** Pre-formatted in the school's calendar. */
    date: string;
    periodNumber: number;
    /** "8 A" or "8" - section already folded in by the caller. */
    classLabel: string;
    subject: string;
    /** Unit and lesson titles already joined, or empty. */
    lesson: string;
    /** Display label ("Not taught"), not the stored enum. */
    status: string;
    reason: string | null;
}

/** One teacher's delivery register over a date range. Rendered LANDSCAPE - six columns. */
export interface LessonRegisterData {
    school: { name: string; address: string | null; phone: string | null; logo: string | null };
    teacherName: string;
    fromLabel: string;
    toLabel: string;
    entries: LessonRegisterEntry[];
    generatedOn: string;
}

// ─── Tabulation sheet ───────────────────────────────────────────────────────────────────────────

/** One student's row. Every value is a finished display STRING - the renderer formats nothing. */
export interface TabulationRow {
    rollNumber: string;
    name: string;
    /**
     * Subject name -> the cell to print. A subject the student did not sit is simply absent from
     * this map and renders as '-'; a subject sat and missed must be the string 'Ab'. Collapsing
     * the two would turn an absence into a not-enrolled, which changes what the sheet means.
     */
    marks: Record<string, string>;
    /** "412/500". */
    total: string;
    /** "82.4%". */
    percentage: string;
    grade: string;
    rank: string;
}

/**
 * Every student in one exam against every subject. Rendered LANDSCAPE, and banded across pages
 * when the subject count exceeds what one page width can hold legibly.
 */
export interface TabulationSheetData {
    school: { name: string; address: string | null; phone: string | null; logo: string | null };
    examName: string;
    classLabel: string | null;
    /** Column order. Must be the union across all rows, sorted by the caller. */
    subjects: string[];
    rows: TabulationRow[];
    generatedOn: string;
}

// ─── Fee collection summary ─────────────────────────────────────────────────────────────────────

export interface FeeCollectionClassRow {
    /** "Class 8" or "Unknown" - already labelled by the caller. */
    className: string;
    paymentCount: number;
    /** "NPR 412,000". */
    collected: string;
}

/**
 * One month's fee collection, with the per-class breakdown.
 *
 * Every money value is a finished display STRING. The caller has already netted carry-forward out
 * of `totalBilled` and excluded reversed / unverified / ADVANCE-wallet payments from the collected
 * figure; re-deriving any of it here would let the PDF and the screen disagree about the school's
 * money.
 */
export interface FeeCollectionSummaryData {
    school: { name: string; address: string | null; phone: string | null; logo: string | null };
    /** e.g. "Asar 2083" or "June 2026" - already in the school's calendar. */
    monthLabel: string;
    academicYearLabel: string;
    collectedThisMonth: string;
    paymentCount: number;
    totalBilled: string;
    totalPending: string;
    totalOverdue: string;
    classes: FeeCollectionClassRow[];
    generatedOn: string;
}

// ─── Continuous assessment report ───────────────────────────────────────────────────────────────

/** One skill on a child's descriptive report. Every value is a finished display STRING. */
export interface AssessmentReportSkill {
    strand: string;
    label: string;
    /** The level's LABEL, not its key - "Secure", never "SECURE". */
    levelLabel: string;
    /** The teacher's note about this child and this skill, when they wrote one. */
    comment: string | null;
}

/**
 * A descriptive continuous-assessment report for one child, one term.
 *
 * ## Why this is a document rather than a print stylesheet
 *
 * Doc 05 §6 requires it to satisfy an inspection, and §6 of the plan is explicit that it must be
 * "exportable as a document, not only viewable". A `window.print()` prints the visible box - the
 * same defect that clipped the Status column off the lesson register. Here the content is grouped
 * by strand inside a scroll area, so printing the box would silently drop whole strands off a
 * child's record. A fixed A4 layout cannot clip.
 *
 * ## Everything is pre-formatted
 *
 * As with every other renderer: no `Date`, no numbers to round, no level keys to map. The report is
 * PUBLISHED from a frozen snapshot, so the strings here are the ones stored at publish time - a
 * later rule change or framework revision must not be able to alter a report a parent already
 * holds, and the renderer receiving finished strings is part of what guarantees that.
 */
export interface AssessmentReportData {
    school: { name: string; address: string | null; phone: string | null; logo: string | null };
    studentName: string;
    className: string | null;
    section: string | null;
    rollNumber: string | null;
    termName: string;
    /** The school's own wording for the term overall, when it configured bands. Often absent. */
    overallLabel: string | null;
    /** The teacher's sentences. The part only a person can write. */
    narrative: string | null;
    skills: AssessmentReportSkill[];
    /** Already in the school's own calendar - Bikram Sambat for a school in Nepal. */
    publishedOn: string;
    generatedOn: string;
    /** Shown as a footnote when the framework is still a working draft. */
    isProvisional: boolean;
}

// ─── Mark sheet list ────────────────────────────────────────────────────────────────────────────

/** One student's mark sheet as a row on the list. Every value is a finished display STRING. */
export interface MarksheetListRow {
    student: string;
    studentId: string;
    className: string;
    section: string;
    /** "412 / 500" */
    obtained: string;
    /** "82.4%" */
    percentage: string;
    /** "A+", never "A_PLUS" */
    grade: string;
    /** "#3", or "-" when no rank was computed */
    rank: string;
    /** "Pass" / "Compartment" / "Fail" / "Absent" / "Pending" - the screen badge's own words. */
    result: string;
}

/**
 * The mark sheet LIST - every sheet the page's current filters select, as one printable table.
 *
 * Not a report card and not the tabulation sheet: those are the per-student and per-exam documents
 * that get filed. This is the working list a coordinator prints to check a class against, which is
 * why its scope line repeats the filters - a printout that does not say what it is a list OF is
 * useless the next morning.
 */
export interface MarksheetListData {
    school: { name: string; address: string | null; phone: string | null; logo: string | null };
    /** The exam's name when the list is filtered to one exam, otherwise null ("All exams"). */
    examLabel: string | null;
    /** The other filters, already joined: "Class 6 - Section A - Published - matching \"ram\"". */
    scope: string;
    rows: MarksheetListRow[];
    /**
     * How many sheets the filters MATCH. Larger than `rows.length` only when the print cap cut the
     * list short - and then the document says so, rather than looking complete.
     */
    totalMatching: number;
    generatedOn: string;
}
