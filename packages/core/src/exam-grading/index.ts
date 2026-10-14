/**
 * Objective (auto-scorable) grading for online exams.
 *
 * This is the SINGLE implementation of "what score does this attempt deserve for its MCQ /
 * true-false / fill-in-the-blank / numerical answers". It is shared by:
 *   - the student submit + auto-finalize path (apps/shishya-main/actions/online-exam.action.ts)
 *   - the platform cron that closes attempts abandoned mid-exam (apps/main .../online-exam-transitions)
 *
 * Both callers MUST use this, otherwise a student who submits normally and a student whose
 * browser was closed would be scored by two different graders that silently drift apart.
 *
 * Subjective answers (short/long/essay) are deliberately left unscored and flagged
 * `needsGrading` for the AI + teacher review workflow.
 */

export type ExamQuestionType =
    | 'MULTIPLE_CHOICE'
    | 'TRUE_FALSE'
    | 'FILL_IN_BLANKS'
    | 'SHORT_ANSWER'
    | 'LONG_ANSWER'
    | 'ESSAY'
    | 'NUMERICAL';

export const KNOWN_QUESTION_TYPES: ExamQuestionType[] = [
    'MULTIPLE_CHOICE', 'TRUE_FALSE', 'FILL_IN_BLANKS',
    'SHORT_ANSWER', 'LONG_ANSWER', 'ESSAY', 'NUMERICAL',
];

/**
 * Types that carry a typed free-text answer and therefore need AI + teacher grading.
 * NUMERICAL is auto-scored here (it has a comparable key), so it is NOT in this set.
 */
const SUBJECTIVE_TYPES = new Set<string>(['SHORT_ANSWER', 'LONG_ANSWER', 'ESSAY']);

export function isSubjectiveQuestionType(t: string | null | undefined): boolean {
    return SUBJECTIVE_TYPES.has((t ?? '').toUpperCase());
}

export type QuestionOption = string | { label?: string; text?: string };

export interface ParsedQuestion {
    questionNumber: number;
    questionText: string;
    questionType: ExamQuestionType;
    options: QuestionOption[];
    marks: number;
    correctAnswer?: string;
    tolerance: number;
    expectedWordCount?: number;
    /** Structured diagram spec (see packages/pdf question-figure). Passed through untouched. */
    figure?: unknown;
}

/** One student answer. Structural so each app can keep its own richer response type. */
export interface GradeableResponse {
    questionNumber: number;
    answer: string | number | boolean | null | undefined;
    isCorrect?: boolean;
}

/** The exam settings that affect scoring. Structural - a drizzle row satisfies it. */
export interface GradeableExam {
    totalMarks: number;
    passingMarks: number;
    negativeMarking: boolean;
    negativeMarkValue: number;
    showResultAfter: boolean;
}

export interface AnswerGrade {
    questionNumber: number;
    questionType: ExamQuestionType;
    isCorrect: boolean | null;
    pointsAwarded: number | null;
    needsGrading: boolean;
}

export interface ObjectiveGradeResult<R extends GradeableResponse = GradeableResponse> {
    gradedResponses: R[];
    answersGraded: AnswerGrade[];
    score: number;
    percentage: number;
    correct: number;
    wrong: number;
    skipped: number;
    isPassed: boolean;
    paperHasSubjective: boolean;
    /** Whether the score is complete enough to show the student immediately. */
    showResult: boolean;
}

// ─── Answer normalization ────────────────────────────────────────────────────

/** Lowercase + collapse whitespace. */
function normalizeAnswer(value: string): string {
    return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Also strip surrounding punctuation, for exact-ish fill-in comparison. */
function normalizeLoose(value: string): string {
    return normalizeAnswer(value).replace(/^[\s.,;:!?'"()-]+|[\s.,;:!?'"()-]+$/g, '');
}

function leadingLabel(value: string): string | null {
    const m = value.trim().match(/^([a-z])[).:]/i);
    return m ? m[1]!.toLowerCase() : null;
}

function optionToLabel(opt: QuestionOption, idx: number): { label: string; text: string } {
    if (typeof opt === 'string') {
        const lbl = leadingLabel(opt) ?? String.fromCharCode(97 + idx);
        return { label: lbl, text: opt };
    }
    const lbl = (opt.label ?? leadingLabel(opt.text ?? '') ?? String.fromCharCode(97 + idx)).toLowerCase();
    return { label: lbl, text: opt.text ?? '' };
}

// ─── Per-type comparators ────────────────────────────────────────────────────

/** MCQ: compare the submitted option label/text to the authoritative correctAnswer. */
export function isMcqAnswerCorrect(
    submitted: string,
    correctAnswer: string | undefined,
    options: QuestionOption[],
): boolean {
    if (!correctAnswer) return false;
    const sub = normalizeAnswer(submitted);
    const subLabel = leadingLabel(submitted) ?? sub;
    const correctLabel = leadingLabel(correctAnswer);
    const correctText = normalizeAnswer(correctAnswer);

    if (correctLabel && (subLabel === correctLabel || sub === correctLabel)) return true;
    if (sub === correctText) return true;

    const normalized = options.map((opt, i) => optionToLabel(opt, i));
    const matchedOption = normalized.find((o) => o.label === subLabel || normalizeAnswer(o.text) === sub);
    if (!matchedOption) return false;
    const correctOption = normalized.find(
        (o) => (correctLabel && o.label === correctLabel) || normalizeAnswer(o.text) === correctText,
    );
    if (!correctOption) return false;
    return matchedOption.label === correctOption.label;
}

/** TRUE/FALSE: accept true/false, t/f, yes/no, 1/0 on either side. */
export function isTrueFalseCorrect(submitted: string, correctAnswer: string | undefined): boolean {
    if (!correctAnswer) return false;
    const norm = (v: string): 'true' | 'false' | null => {
        const s = normalizeLoose(v);
        if (s === 'true' || s === 't' || s === 'yes' || s === '1') return 'true';
        if (s === 'false' || s === 'f' || s === 'no' || s === '0') return 'false';
        return null;
    };
    const sub = norm(submitted);
    const correct = norm(correctAnswer);
    return sub !== null && correct !== null && sub === correct;
}

/**
 * FILL_IN_BLANKS: exact-ish. The key may list several acceptable answers separated by
 * "/", "," or "|"; a submission matching any (after loose normalization) is correct.
 */
export function isFillBlankCorrect(submitted: string, correctAnswer: string | undefined): boolean {
    if (!correctAnswer) return false;
    const sub = normalizeLoose(submitted);
    if (!sub) return false;
    const accepted = correctAnswer.split(/[/,|]/).map((a) => normalizeLoose(a)).filter(Boolean);
    return accepted.includes(sub);
}

/** NUMERICAL: parse both sides and compare within an absolute tolerance (default 0). */
export function isNumericalCorrect(
    submitted: string,
    correctAnswer: string | undefined,
    tolerance: number,
): boolean {
    if (!correctAnswer) return false;
    const parse = (v: string): number | null => {
        const cleaned = v.replace(/[^0-9eE.+-]/g, '');
        if (cleaned === '') return null;
        const n = Number(cleaned);
        return Number.isFinite(n) ? n : null;
    };
    const sub = parse(submitted);
    const correct = parse(correctAnswer);
    if (sub === null || correct === null) return false;
    return Math.abs(sub - correct) <= Math.abs(tolerance);
}

// ─── Paper parsing ───────────────────────────────────────────────────────────

/** The loose shape a paper question can arrive in from generationLog / updatedData JSON. */
interface RawQuestion {
    questionNumber?: number;
    questionText?: string;
    question?: string;
    questionType?: unknown;
    options?: unknown;
    marks?: unknown;
    correctAnswer?: string;
    tolerance?: unknown;
    expectedWordCount?: unknown;
    wordLimit?: unknown;
    figure?: unknown;
}

function coerceType(t: unknown): ExamQuestionType {
    return (KNOWN_QUESTION_TYPES as string[]).includes(t as string)
        ? (t as ExamQuestionType)
        : 'SHORT_ANSWER';
}

/**
 * Parse EVERY question (all types) from a paper in document order, assigning a stable
 * questionNumber. The client-facing question list and the server answer key are both derived
 * from this ONE function so their numbering can never drift apart.
 */
export function parseAllQuestions(
    src: string | null | undefined,
    fallbackMarksPerQ: number,
): ParsedQuestion[] {
    const out: ParsedQuestion[] = [];
    if (!src) return out;
    try {
        const parsed = JSON.parse(src) as { sections?: unknown[]; data?: { sections?: unknown[] } };
        const sections = (parsed.sections ?? parsed.data?.sections ?? []) as { questions?: unknown[] }[];
        let runningNumber = 0;
        for (const section of sections) {
            const qs = (section.questions ?? []) as RawQuestion[];
            for (const q of qs) {
                runningNumber += 1;
                const wordHint = typeof q.expectedWordCount === 'number'
                    ? q.expectedWordCount
                    : (typeof q.wordLimit === 'number' ? q.wordLimit : undefined);
                out.push({
                    questionNumber: q.questionNumber ?? runningNumber,
                    questionText: q.questionText ?? q.question ?? '',
                    questionType: coerceType(q.questionType),
                    options: (q.options ?? []) as QuestionOption[],
                    marks: typeof q.marks === 'number' ? q.marks : fallbackMarksPerQ,
                    correctAnswer: q.correctAnswer,
                    tolerance: typeof q.tolerance === 'number' ? q.tolerance : 0,
                    expectedWordCount: wordHint,
                    figure: q.figure ?? undefined,
                });
            }
        }
    } catch (err) {
        // Malformed paper: log so it is diagnosable rather than silently empty / unscorable.
        console.error('[exam-grading] failed to parse question paper:', err);
    }
    return out;
}

/**
 * Pick the freshest source for a paper's questions and parse it, sizing the per-question marks
 * fallback from the exam's total. `updatedData` (teacher-edited) wins over `generationLog` (AI).
 */
/**
 * Turn a PINNED question-paper version into the shape `parsePaperForGrading` reads.
 *
 * An online exam records `questionPaperVersionId` - the exact snapshot it was built from - because a
 * paper must never change underneath students who are writing it, and because marks recorded
 * afterwards have to describe the questions that were actually asked.
 *
 * That pin was being written and then ignored: both the exam-taking path and the grading path loaded
 * `question_papers.updatedData`, i.e. whatever the paper says TODAY. Nothing enforced the promise the
 * column exists to make. The edit/restore lock happened to cover it, so it was never exploitable -
 * but a safety property that only holds by accident is one refactor away from not holding.
 *
 * The conversion lives here, next to the parser, so the student app and the platform cron cannot
 * disagree about how a pinned snapshot is read. A version's `content` is the same StoredPaper shape
 * that gets serialised into `updatedData`, so it round-trips through the same parser unchanged.
 *
 * Returns null when there is no usable snapshot, which callers treat as "fall back to the live
 * paper" - correct for papers written before versioning existed, which have no snapshot at all.
 */
export function pinnedPaperSource(
    content: unknown,
): { updatedData: string | null; generationLog: string | null } | null {
    if (!content || typeof content !== 'object') return null;
    try {
        return { updatedData: JSON.stringify(content), generationLog: null };
    } catch {
        // Circular or otherwise unserialisable jsonb. Falling back to the live paper is better than
        // handing students an empty exam.
        return null;
    }
}

export function parsePaperForGrading(
    paper: { updatedData: string | null; generationLog: string | null } | null | undefined,
    totalMarks: number,
): ParsedQuestion[] {
    const src = paper?.updatedData ?? paper?.generationLog;
    if (!src) return [];
    // First pass counts questions so the marks fallback is per-question, not per-response.
    const provisional = parseAllQuestions(src, 1);
    const count = provisional.length || 1;
    const fallbackMarksPerQ = totalMarks > 0 ? totalMarks / count : 1;
    return parseAllQuestions(src, fallbackMarksPerQ);
}

// ─── The grader ──────────────────────────────────────────────────────────────

/**
 * Grade the OBJECTIVE portion of an attempt against the authoritative key.
 * Subjective answers are left unscored (`needsGrading: true`) for AI + teacher review.
 */
export function gradeObjective<R extends GradeableResponse>(
    exam: GradeableExam,
    responses: R[],
    questions: ParsedQuestion[],
): ObjectiveGradeResult<R> {
    const keyByNumber = new Map<number, ParsedQuestion>();
    for (const q of questions) keyByNumber.set(q.questionNumber, q);
    const paperHasSubjective = questions.some((q) => isSubjectiveQuestionType(q.questionType));

    let correct = 0;
    let wrong = 0;
    let skipped = 0;
    let score = 0;

    const answersGraded: AnswerGrade[] = [];
    const gradedResponses = responses.map((r) => {
        const q = keyByNumber.get(r.questionNumber);
        const hasAnswer = r.answer !== null && r.answer !== undefined && String(r.answer).trim() !== '';
        const qType = q?.questionType ?? 'MULTIPLE_CHOICE';

        // Subjective: never scored here; teacher/AI grades later.
        if (q && isSubjectiveQuestionType(qType)) {
            answersGraded.push({
                questionNumber: r.questionNumber,
                questionType: qType,
                isCorrect: null,
                pointsAwarded: null,
                needsGrading: true,
            });
            return { ...r, isCorrect: undefined };
        }

        if (!hasAnswer) {
            skipped += 1;
            answersGraded.push({
                questionNumber: r.questionNumber,
                questionType: qType,
                isCorrect: false,
                pointsAwarded: 0,
                needsGrading: false,
            });
            return { ...r, isCorrect: false };
        }

        const submitted = String(r.answer);
        let isCorrect = false;
        if (q) {
            switch (qType) {
                case 'MULTIPLE_CHOICE':
                    isCorrect = isMcqAnswerCorrect(submitted, q.correctAnswer, q.options);
                    break;
                case 'TRUE_FALSE':
                    isCorrect = isTrueFalseCorrect(submitted, q.correctAnswer);
                    break;
                case 'FILL_IN_BLANKS':
                    isCorrect = isFillBlankCorrect(submitted, q.correctAnswer);
                    break;
                case 'NUMERICAL':
                    isCorrect = isNumericalCorrect(submitted, q.correctAnswer, q.tolerance);
                    break;
                default:
                    isCorrect = false;
            }
        }

        const marks = q?.marks ?? 0;
        if (isCorrect) {
            correct += 1;
            score += marks;
            answersGraded.push({
                questionNumber: r.questionNumber,
                questionType: qType,
                isCorrect: true,
                pointsAwarded: marks,
                needsGrading: false,
            });
        } else {
            wrong += 1;
            if (exam.negativeMarking) score -= exam.negativeMarkValue;
            answersGraded.push({
                questionNumber: r.questionNumber,
                questionType: qType,
                isCorrect: false,
                pointsAwarded: 0,
                needsGrading: false,
            });
        }
        return { ...r, isCorrect };
    }) as R[];

    // Clamp to [0, totalMarks] and round to 2 dp to avoid float noise / negative totals.
    score = Math.max(0, Math.min(Math.round(score * 100) / 100, exam.totalMarks));
    const percentage = exam.totalMarks > 0 ? Math.round((score / exam.totalMarks) * 10000) / 100 : 0;
    const isPassed = !paperHasSubjective && score >= exam.passingMarks;
    // Only reveal a result immediately when the whole paper is objective (score is complete).
    const showResult = exam.showResultAfter && !paperHasSubjective;

    return {
        gradedResponses,
        answersGraded,
        score,
        percentage,
        correct,
        wrong,
        skipped,
        isPassed,
        paperHasSubjective,
        showResult,
    };
}
