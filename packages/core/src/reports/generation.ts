/**
 * Writing one student's report card with a model - the prompt, the shape, and the guard rails.
 *
 * ## Why this is in `@repo/core` and not in `apps/main`
 *
 * The Durable Object that writes a whole class runs in `apps/worker` and cannot import from an app.
 * The single-field "rewrite this bit" button runs in `apps/main`. If the two held their own prompts
 * they would drift, and a class written in bulk would read differently from the same class written
 * one student at a time - which a parent comparing two siblings' reports would notice before we did.
 *
 * ## The rule the prompt exists to enforce
 *
 * **The model writes PROSE about numbers it is given. It never produces a number.** Marks, GPA,
 * percentage, attendance and grades are read from the database and written to the row directly; the
 * model's whole job is the narrative sections a teacher would otherwise type forty times. A model
 * that is allowed to restate a figure is a model that will eventually restate it wrong, on a
 * document that goes home to a parent.
 *
 * ## Absence of data is not a zero
 *
 * A student with no marks entered and no register taken must not get a report saying they scored
 * nothing and attended nothing. `buildStudentPrompt` says "not recorded" in those cases and the
 * prompt tells the model, in as many words, not to infer performance from missing data. The caller
 * is expected to SKIP such a student rather than write a hollow report about them.
 */

export interface ReportSubjectMark {
    subject: string;
    marksObtained: number;
    maxMarks: number;
    grade: string;
}

export interface ReportAttendanceFacts {
    present: number;
    absent: number;
    late: number;
    total: number;
    /** Null when no register was taken. NOT the same as 0. */
    percentage: string | null;
}

export interface ReportStudentFacts {
    studentName: string;
    className: string | null;
    section: string | null;
    rollNumber: number | null;
    academicYear: string;
    term: string | null;
    reportTypeLabel: string;
    marks: ReportSubjectMark[];
    attendance: ReportAttendanceFacts | null;
    /** From the mark sheet, when one exists: overall percentage, GPA, rank, pass/fail. */
    overallPercentage: number | null;
    gpa: number | null;
    classRank: number | null;
    isPassed: boolean | null;
    failedSubjects: string[];
    /** Anything the teacher typed for the whole class, applied to every student in the run. */
    classContext: string | null;
}

/** Exactly the narrative fields the model is allowed to write. Nothing numeric is in here. */
export interface ReportNarrative {
    academicPerformance: string;
    behavioralNotes: string;
    attendanceData: string;
    achievements: string;
    areasOfImprovement: string;
    teacherComments: string;
    recommendations: string;
}

export const REPORT_NARRATIVE_FIELDS: readonly (keyof ReportNarrative)[] = [
    'academicPerformance',
    'behavioralNotes',
    'attendanceData',
    'achievements',
    'areasOfImprovement',
    'teacherComments',
    'recommendations',
];

/**
 * A student the model should NOT be asked to write about.
 *
 * Returns the reason, or null when there is enough to write from. Called before the model, so a
 * class where marks were never entered costs nothing and produces an honest "skipped" list instead
 * of forty reports of invented encouragement.
 */
export function reasonToSkip(facts: ReportStudentFacts): string | null {
    const hasMarks = facts.marks.length > 0;
    const hasAttendance = (facts.attendance?.total ?? 0) > 0;
    if (!hasMarks && !hasAttendance) {
        return 'No marks and no attendance recorded for this sitting';
    }
    if (!hasMarks) {
        return 'No marks recorded for this sitting';
    }
    return null;
}

export const REPORT_SYSTEM_PROMPT = `You are an experienced class teacher writing the written sections of a school report card that goes home to a parent.

RULES, in order of importance:
1. NEVER state, restate, recalculate or round a number. Not marks, not totals, not percentages, not GPA, not rank, not attendance counts. Those are printed on the card from the school's records, directly beside your words. If you write a figure it will contradict the table next to it.
2. Write about what the figures MEAN: which subjects are strong, which need work, whether the pattern is improving, what the child should do next.
3. Be specific to this child. Name their actual subjects. A sentence that would fit any student in the class is a wasted sentence, and a parent reading two siblings' reports will notice.
4. Be warm, plain and factual. No flattery, no fear. This is read by a parent who may not have studied past school themselves, so use ordinary words and short sentences.
5. Where a fact is marked "not recorded", say nothing about it. Do not infer, do not guess, and never imply the child performed badly because the school did not record something.
6. Write in third person using the student's name or "he/she" as appropriate - if you cannot tell, use the student's name and avoid pronouns entirely.
7. No bullet points, no headings, no markdown. Plain sentences only.

Return ONLY a JSON object with exactly these seven string keys:
"academicPerformance" (2-3 sentences on subject strengths and weaknesses)
"behavioralNotes" (1-2 sentences; if you have nothing but marks to go on, write about study habits the marks suggest, and do not invent conduct incidents)
"attendanceData" (1-2 sentences about the attendance pattern, WITHOUT numbers; write "Attendance was not recorded for this period." if it is not recorded)
"achievements" (1-2 sentences on what went genuinely well; if nothing stands out, say so kindly rather than inventing a prize)
"areasOfImprovement" (2-3 sentences, specific and actionable, naming real subjects)
"teacherComments" (2-3 sentences, the class teacher's overall view)
"recommendations" (2-3 sentences the parent and child can act on at home)`;

/** Renders the facts as the model sees them. Everything unknown says so in words. */
export function buildStudentPrompt(facts: ReportStudentFacts): string {
    const lines: string[] = [];

    lines.push(`STUDENT: ${facts.studentName}`);
    if (facts.className) {
        lines.push(`CLASS: ${facts.className}${facts.section ? `-${facts.section}` : ''}${facts.rollNumber != null ? `, Roll ${facts.rollNumber}` : ''}`);
    }
    lines.push(`SITTING: ${facts.academicYear}${facts.term ? ` - ${facts.term}` : ' - whole year'}`);
    lines.push(`REPORT TYPE: ${facts.reportTypeLabel}`);

    if (facts.marks.length > 0) {
        lines.push('', 'SUBJECT MARKS (for your understanding only - do NOT repeat these numbers):');
        for (const m of facts.marks) {
            lines.push(`  ${m.subject}: ${m.marksObtained} of ${m.maxMarks} (${m.grade})`);
        }
    } else {
        lines.push('', 'SUBJECT MARKS: not recorded');
    }

    if (facts.overallPercentage != null) lines.push(`OVERALL: ${facts.overallPercentage.toFixed(1)}%`);
    if (facts.gpa != null) lines.push(`GPA: ${facts.gpa.toFixed(2)}`);
    if (facts.classRank != null) lines.push(`RANK IN CLASS: ${facts.classRank}`);
    if (facts.isPassed === false && facts.failedSubjects.length > 0) {
        lines.push(`NOT PASSED IN: ${facts.failedSubjects.join(', ')} - write about this honestly and constructively, without shaming.`);
    }

    // "Not recorded" and "0%" are different measurements, and this document goes to a parent.
    if (facts.attendance && facts.attendance.total > 0 && facts.attendance.percentage !== null) {
        lines.push(
            '',
            `ATTENDANCE: present ${facts.attendance.present} of ${facts.attendance.total} days (${facts.attendance.percentage}%), absent ${facts.attendance.absent}, late ${facts.attendance.late}. Describe the PATTERN in words; do not repeat these numbers.`,
        );
    } else {
        lines.push('', 'ATTENDANCE: not recorded for this period.');
    }

    if (facts.classContext?.trim()) {
        lines.push('', `CONTEXT THE TEACHER GAVE FOR THE WHOLE CLASS: ${facts.classContext.trim()}`);
    }

    return lines.join('\n');
}

/**
 * Parse and clean the model's JSON.
 *
 * Every field is coerced to a trimmed string and length-capped. A model that returns a number, an
 * array or null for a field yields an empty string for that field rather than writing `null` onto a
 * report card - and an empty field is something the teacher can see and fill, which a literal
 * "undefined" in the middle of a paragraph is not.
 */
export function parseNarrative(raw: string): ReportNarrative | null {
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return null;
    }
    if (!parsed || typeof parsed !== 'object') return null;
    const obj = parsed as Record<string, unknown>;

    const out = {} as ReportNarrative;
    let filled = 0;
    for (const key of REPORT_NARRATIVE_FIELDS) {
        const v = obj[key];
        const text = typeof v === 'string' ? v.trim().slice(0, 1200) : '';
        out[key] = text;
        if (text) filled += 1;
    }

    // A response where nothing came through is a failure, not an empty report. Returning null lets
    // the caller retry the student instead of saving seven blank fields over the teacher's work.
    return filled === 0 ? null : out;
}

/**
 * THE JOB KEY FOR A ONE-STUDENT RUN.
 *
 * `report_generation_jobs.batchId` is the run's unique key. A class run uses the real
 * `student_reports.batchId`. A one-student run has no batch - and must NOT be given one, because a
 * report with a batchId is listed on the Deck as a CLASS batch and links to `/reports/batch/...`
 * instead of to the report itself.
 *
 * So a single run is keyed `report:<reportId>`, the same prefix the Deck already uses for a single
 * report in its window state. Defined once here because `apps/main` writes it and `apps/worker`
 * reads it: two hand-typed copies of a string protocol are two places for it to drift.
 */
const SINGLE_REPORT_PREFIX = 'report:';

export function singleReportJobKey(reportId: string): string {
    return `${SINGLE_REPORT_PREFIX}${reportId}`;
}

/** The report id if this job key is a one-student run, otherwise null (a class batch). */
export function reportIdFromJobKey(batchId: string): string | null {
    return batchId.startsWith(SINGLE_REPORT_PREFIX) ? batchId.slice(SINGLE_REPORT_PREFIX.length) : null;
}

/**
 * THE LIVE-PROGRESS MESSAGE FOR A WRITING RUN (plan/main/ai-saathi/report-generation-flow.md).
 *
 * The ReportWriter workflow (apps/worker) sends this to the REQUESTER only, over the school
 * websocket, after each student and when the run ends; apps/main's `use-websocket.ts` hands it to
 * the job-progress store the Deck's Report panel reads. Defined once here for the same reason as
 * the job key above: the worker writes it and the browser reads it.
 *
 * `kind` is a discriminator so the same message can later carry other long jobs without a second
 * socket vocabulary. `item` is absent on the job-level pushes (the run starting or finishing).
 */
export type JobProgressItemStatus = 'WAITING' | 'WRITING' | 'DONE' | 'SKIPPED' | 'FAILED';
export type JobProgressStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';

export interface JobProgressItem {
    studentId: string;
    reportId: string;
    studentName: string;
    status: JobProgressItemStatus;
    reason: string | null;
}

export interface JobProgressJob {
    kind: 'report';
    jobId: string;
    status: JobProgressStatus;
    /** Students finished (DONE + SKIPPED + FAILED). */
    done: number;
    total: number;
}

export interface JobProgressMessage {
    type: 'JOB_PROGRESS';
    job: JobProgressJob;
    item?: JobProgressItem;
}
