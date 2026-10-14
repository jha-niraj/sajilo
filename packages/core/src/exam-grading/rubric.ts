/**
 * The rubric a grading session carries, and the one function that turns it into prompt text.
 *
 * ## Why this lives in a shared package
 *
 * An answer sheet is graded in TWO places: synchronously in `apps/main` when a teacher presses
 * Grade, and in `apps/worker` when a batch goes through the queue. Those two paths have already
 * drifted twice - once over pass/fail (`passingMarks` compared against a percentage in one and an
 * absolute mark in the other) and once over clamping a malformed total. Both times the same sheet
 * would have been marked differently depending on which button the teacher pressed.
 *
 * The rubric is the single largest input to a mark. Two copies of "turn a rubric into a prompt"
 * would be the third and worst instance of that bug, so there is exactly one, here, and both graders
 * call it.
 *
 * ## Two stored shapes, forever
 *
 * `ai_grading_sessions.rubric` is `jsonb` with no schema, and it has held an ARRAY of per-question
 * entries since the feature shipped. It now holds an OBJECT carrying a chosen template, the ticked
 * criteria and the per-question entries.
 *
 * Both must keep working. Existing sessions hold arrays and there is no reason to rewrite them - a
 * migration that rewrites live rubric data to gain nothing is pure risk. `normalizeRubric` owns the
 * two-shape read so that no caller ever has to know there are two.
 *
 * ## The stored object is SELF-CONTAINED, on purpose
 *
 * A criterion is stored with its `instruction` text, not just its id. That means:
 *
 *  - The worker needs no access to the template catalogue, which lives in `apps/main/content`. A
 *    package cannot import from an app, and moving the catalogue here would drag UI-facing copy into
 *    shared code.
 *  - Editing a template in code NEVER retroactively changes how an existing session grades. A
 *    session that was set up in Baisakh grades in Asar exactly as it was set up. Marks that silently
 *    change because someone reworded a criterion months later would be indefensible to a parent.
 */

export type MarkingStyle = 'strict' | 'balanced' | 'generous';

/** One ticked checkbox, stored with the text the grader is given. */
export interface StoredCriterion {
    id: string;
    label: string;
    instruction: string;
}

/** A per-question entry. Optional - most sessions have a template and no per-question detail. */
export interface RubricQuestion {
    questionNumber: number;
    marks: number;
    modelAnswer: string;
    gradingCriteria: string;
}

/** The object shape written since rubric templates shipped. */
export interface StoredRubric {
    templateId: string;
    templateName: string;
    markingStyle: MarkingStyle;
    /** Resolved at save time - see the self-contained note above. */
    markingStyleInstruction: string;
    criteria: StoredCriterion[];
    questions: RubricQuestion[];
}

/** What every reader gets, whichever shape was stored. */
export interface NormalizedRubric {
    templateId: string | null;
    templateName: string | null;
    markingStyleInstruction: string | null;
    criteria: StoredCriterion[];
    questions: RubricQuestion[];
    /** True when there is nothing to grade against beyond the marks total. */
    isEmpty: boolean;
}

function isQuestion(v: unknown): v is RubricQuestion {
    if (!v || typeof v !== 'object') return false;
    const q = v as Record<string, unknown>;
    return typeof q.questionNumber === 'number' && typeof q.marks === 'number';
}

function isCriterion(v: unknown): v is StoredCriterion {
    if (!v || typeof v !== 'object') return false;
    const c = v as Record<string, unknown>;
    return typeof c.id === 'string' && typeof c.instruction === 'string';
}

/**
 * Read whatever is in the column and hand back one shape.
 *
 * Deliberately total: a null, a string, a number, a half-written object from a failed save - all
 * return an empty rubric rather than throwing. A malformed rubric must degrade to "grade on general
 * quality", which is weaker but still produces a mark a teacher can correct. Throwing here would
 * take down grading for a whole session over one bad row.
 */
export function normalizeRubric(raw: unknown): NormalizedRubric {
    const empty: NormalizedRubric = {
        templateId: null,
        templateName: null,
        markingStyleInstruction: null,
        criteria: [],
        questions: [],
        isEmpty: true,
    };

    if (!raw) return empty;

    // ── Legacy shape: a bare array of per-question entries ────────────────────
    if (Array.isArray(raw)) {
        const questions = raw.filter(isQuestion);
        return questions.length === 0 ? empty : { ...empty, questions, isEmpty: false };
    }

    if (typeof raw !== 'object') return empty;
    const o = raw as Record<string, unknown>;

    const criteria = Array.isArray(o.criteria) ? o.criteria.filter(isCriterion) : [];
    const questions = Array.isArray(o.questions) ? o.questions.filter(isQuestion) : [];

    return {
        templateId: typeof o.templateId === 'string' ? o.templateId : null,
        templateName: typeof o.templateName === 'string' ? o.templateName : null,
        markingStyleInstruction:
            typeof o.markingStyleInstruction === 'string' ? o.markingStyleInstruction : null,
        criteria,
        questions,
        isEmpty: criteria.length === 0 && questions.length === 0,
    };
}

/**
 * Turn a rubric into the block of text the grader is given.
 *
 * Ordering is not arbitrary. The marking STYLE comes first because it governs every borderline call
 * that follows; the per-question detail comes last because it is the most specific and a model
 * weights the end of a list heavily. The criteria sit between as standing rules.
 *
 * `maxMarks` is required rather than optional: with no rubric at all the only honest instruction is
 * the total the paper is out of, and a grader told nothing at all will invent a scale.
 */
export function buildRubricText(rubric: NormalizedRubric, maxMarks: number): string {
    const parts: string[] = [];

    parts.push(
        rubric.markingStyleInstruction
            ?? 'Mark as an experienced teacher would, and be consistent: two answers of the same '
             + 'quality must receive the same mark.',
    );

    if (rubric.criteria.length > 0) {
        parts.push(
            'MARKING RULES - apply every one of these:\n'
            + rubric.criteria.map((c) => `- ${c.instruction}`).join('\n'),
        );
    }

    if (rubric.questions.length > 0) {
        parts.push(
            'PER-QUESTION RUBRIC:\n'
            + rubric.questions
                .map((q) => {
                    const bits = [`Q${q.questionNumber} (${q.marks} marks):`];
                    if (q.modelAnswer?.trim()) bits.push(`Model answer: "${q.modelAnswer.trim()}".`);
                    if (q.gradingCriteria?.trim()) bits.push(`Criteria: ${q.gradingCriteria.trim()}`);
                    return bits.join(' ');
                })
                .join('\n'),
        );
    } else {
        // Said explicitly rather than left out. A grader given marking rules but no question list
        // must be told to derive the split itself, or it tends to assume a single-question paper
        // and return one total with no per-question breakdown - which is the part the teacher
        // actually reviews.
        parts.push(
            `This paper is out of ${maxMarks} marks in total. No per-question breakdown was supplied, `
            + 'so identify each question from the answer sheet itself, decide a fair mark allocation '
            + `for each, and make sure your per-question marks sum to at most ${maxMarks}.`,
        );
    }

    return parts.join('\n\n');
}
