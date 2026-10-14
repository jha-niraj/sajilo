/**
 * The shared contract for AI question-paper generation.
 *
 * The prompt, the validation rules and the token budget live HERE rather than in the app,
 * because two places now generate questions - the worker's Durable Object does the bulk runs,
 * and apps/main still regenerates a single question inline. When the prompt lived in the app
 * only, the worker would have needed its own copy, and the copies drift: that is exactly how
 * the four hand-rolled OpenAI clients in this repo ended up disagreeing with each other.
 *
 * ## One section per call
 *
 * `buildSectionPrompt` deliberately asks for ONE section, not the whole paper. The old
 * whole-paper call shared a single `max_tokens: 4500` ceiling across every section, so a
 * paper past roughly 30 questions was silently truncated mid-JSON and surfaced to the teacher
 * as "AI returned invalid JSON. Please try again." - which never worked on retry, because the
 * ceiling was the same every time. Per-section calls size their own budget (`sectionMaxTokens`)
 * and a large paper simply takes more alarm ticks.
 */

export type BloomsLevel = 'REMEMBER' | 'UNDERSTAND' | 'APPLY' | 'ANALYZE' | 'EVALUATE' | 'CREATE';
export type SectionQuestionType = 'MCQ' | 'SHORT_ANSWER' | 'LONG_ANSWER' | 'ESSAY';
export type GeneratedQuestionType = 'MCQ' | 'SHORT_ANSWER' | 'LONG_ANSWER';
export type DifficultyLevel = 'EASY' | 'MEDIUM' | 'HARD';
export type ReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EDITED';

export interface GenerationSectionSpec {
    name: string;
    type: SectionQuestionType;
    questionCount: number;
    marksPerQuestion: number;
    bloomsDistribution?: { level: BloomsLevel; percentage: number }[];
}

/** Everything the worker needs to run a job without calling back into the app. */
export interface QuestionPaperGenerationRequest {
    subject: string;
    className: string;
    term: string;
    difficultyLevel: DifficultyLevel;
    questionFormat: string;
    sections: GenerationSectionSpec[];
    syllabusContent?: string;
    customInstructions?: string;
    /** Ground strictly on this uploaded curriculum document when set. */
    curriculumDocumentId?: string;
    /** Display labels of the chosen units / lessons - shown to the model as the scope of the paper. */
    selectedTopics?: string[];
    /**
     * Ids of the chosen TOC units / lessons (`platform_toc_units` / `platform_toc_lessons`).
     * Retrieval keeps ONLY chunks tagged with these, so ticking "Unit 3" means Unit 3 - the labels
     * above used to be folded into one embedding query with no guarantee any retrieved page was
     * from the unit at all, and unticked units were never excluded.
     */
    tocUnitIds?: string[];
    tocLessonIds?: string[];
    /**
     * BATCH runs only: the teacher's own words on what was wrong with the last batch. Passed
     * to the model verbatim - a teacher writing "too easy for grade 9, and three questions
     * were about the same theorem" is far more useful steering than any preset we could offer.
     */
    regenerationReason?: string;
    /** BATCH runs only: question texts already seen, so the model does not repeat them. */
    avoidQuestions?: string[];
}

export interface GeneratedQuestion {
    questionNumber: number;
    /** Structured diagram spec, or null. Validated at render time by `isDrawableFigure`. */
    figure?: unknown;
    questionText: string;
    questionType: GeneratedQuestionType;
    marks: number;
    options?: string[];
    correctAnswer?: string;
    markingScheme?: string;
    bloomsLevel: BloomsLevel;
    difficulty: DifficultyLevel;
    sourceRef?: string;
    reviewStatus: ReviewStatus;
    validationFlags: string[];
    /** Filled later by the answer-sheet job; cleared when the question text is edited. */
    sampleAnswer?: string;
}

export interface GeneratedSection {
    sectionName: string;
    sectionType: string;
    totalMarks: number;
    instructions?: string;
    questions: GeneratedQuestion[];
}

/** What accumulates in the job row's `result` column, one section at a time. */
export interface QuestionPaperGenerationResult {
    sections: GeneratedSection[];
    /**
     * The retrieved curriculum text, cached on the first tick. Without this every section
     * would re-embed the same query and re-hit Vectorize - the same retrieval, paid for once
     * per section.
     */
    curriculumContext?: string;
    curriculumGrounded?: boolean;
}

export const BLOOMS_STEMS: Record<BloomsLevel, string> = {
    REMEMBER: 'Recall facts and basic concepts (Define, List, State, Name, Recall)',
    UNDERSTAND: 'Explain ideas in own words (Explain, Describe, Summarize, Discuss)',
    APPLY: 'Use information in new situations (Calculate, Solve, Use, Demonstrate)',
    ANALYZE: 'Draw connections, compare concepts (Compare, Contrast, Distinguish, Examine)',
    EVALUATE: 'Justify a decision or course of action (Assess, Critique, Justify, Evaluate)',
    CREATE: 'Produce new or original work (Design, Construct, Develop, Formulate)',
};

/**
 * Output budget for one section.
 *
 * Sized from the question type, because a 5-mark essay prompt with a marking scheme is several
 * times the size of an MCQ stem plus four options. The floor keeps a one-question section from
 * being cut off; the ceiling keeps a pathological 100-question section inside one model call.
 */
export function sectionMaxTokens(section: GenerationSectionSpec): number {
    const perQuestion = section.type === 'MCQ' ? 200
        : section.type === 'SHORT_ANSWER' ? 260
            : 460;
    return Math.min(8000, Math.max(900, Math.round(section.questionCount * perQuestion * 1.25)));
}

/** Rule-based checks. Cheap, deterministic, and no second model call. */
export function validateGeneratedQuestion(q: {
    questionText?: string;
    questionType?: string;
    options?: string[];
    correctAnswer?: string;
    marks?: number;
}): string[] {
    const flags: string[] = [];
    if (!q.questionText || q.questionText.trim().length < 10) flags.push('too_short');
    if (q.questionType === 'MCQ') {
        if (!q.options || q.options.length < 4) flags.push('mcq_missing_options');
        if (!q.correctAnswer) flags.push('mcq_missing_answer');
    }
    if (!q.marks || q.marks <= 0) flags.push('invalid_marks');
    return flags;
}

/**
 * Number questions continuously across the whole paper.
 *
 * Sections arrive one tick at a time, each numbered from 1 by the model, so numbering can only
 * be settled once every section is in. Doing it at the end also means a BATCH re-run renumbers
 * cleanly instead of inheriting the previous run's offsets.
 */
export function renumberQuestions(sections: GeneratedSection[]): GeneratedSection[] {
    let n = 0;
    return sections.map((section) => ({
        ...section,
        questions: section.questions.map((q) => {
            n += 1;
            return { ...q, questionNumber: n };
        }),
    }));
}

export function countQuestions(sections: GeneratedSection[]): number {
    return sections.reduce((sum, s) => sum + s.questions.length, 0);
}

export function sumMarks(sections: GeneratedSection[]): number {
    return sections.reduce(
        (sum, s) => sum + s.questions.reduce((qSum, q) => qSum + (q.marks || 0), 0),
        0,
    );
}

/** The query used for curriculum retrieval. Shared so grounding is identical everywhere. */
export function buildRetrievalQuery(request: QuestionPaperGenerationRequest): string {
    return request.selectedTopics && request.selectedTopics.length > 0
        ? `${request.subject} grade ${request.className}: ${request.selectedTopics.join('; ')}`
        : `${request.subject} ${request.term} exam questions`;
}

/**
 * Prompt for ONE section of the paper.
 *
 * `avoidQuestions` is truncated to the most recent 40. The whole point of a BATCH re-run is to
 * get something different, and a list long enough to crowd out the curriculum context would
 * defeat that by starving the part of the prompt that makes questions good.
 */
export function buildSectionPrompt(opts: {
    request: QuestionPaperGenerationRequest;
    section: GenerationSectionSpec;
    sectionIndex: number;
    sectionCount: number;
    curriculumContext: string;
    grounded: boolean;
}): string {
    const { request, section, sectionIndex, sectionCount, curriculumContext, grounded } = opts;

    const bloomsSpec = section.bloomsDistribution && section.bloomsDistribution.length > 0
        ? '\nBloom\'s distribution for this section:\n' + section.bloomsDistribution
            .map((b) => `  - ${b.level} (${BLOOMS_STEMS[b.level]}): ${b.percentage}% = about ${Math.max(1, Math.round((b.percentage / 100) * section.questionCount))} question(s)`)
            .join('\n')
        : '';

    // The scope the teacher ticked. Retrieval already narrows the CONTEXT to these units/lessons;
    // naming them here stops the model drifting to neighbouring chapters it knows from training.
    const scope = request.selectedTopics && request.selectedTopics.length > 0
        ? `\nSCOPE - set questions ONLY on these parts of the syllabus, nothing outside them:\n`
          + request.selectedTopics.slice(0, 40).map((t) => `  - ${t}`).join('\n')
        : '';

    const avoid = request.avoidQuestions && request.avoidQuestions.length > 0
        ? `\nDO NOT repeat, lightly reword, or re-test the same specific point as any of these questions the teacher has already seen:\n`
          + request.avoidQuestions.slice(-40).map((q, i) => `  ${i + 1}. ${q}`).join('\n')
        : '';

    // The reason is the teacher's actual complaint, so it is stated as a requirement to fix
    // rather than as background. It goes near the end, where instructions carry most weight.
    const reason = request.regenerationReason?.trim()
        ? `\nTHE TEACHER REJECTED THE PREVIOUS BATCH FOR THIS REASON:\n"${request.regenerationReason.trim()}"\nTreat this as the primary requirement. The new questions must visibly fix it.`
        : '';

    return `You are an expert question paper setter for school examinations.
${curriculumContext}${scope}

TASK: Generate ONLY section ${sectionIndex + 1} of ${sectionCount} for this paper.
- Subject: ${request.subject}
- Class/Grade: ${request.className}
- Term: ${request.term}
- Overall difficulty: ${request.difficultyLevel}
${request.customInstructions ? `- Special instructions: ${request.customInstructions}` : ''}

SECTION TO GENERATE:
Section "${section.name}": exactly ${section.questionCount} ${section.type} question(s), ${section.marksPerQuestion} mark(s) each, ${section.questionCount * section.marksPerQuestion} marks total.${bloomsSpec}

RULES:
1. ${grounded
        ? 'Generate questions STRICTLY from the curriculum context above. Do not introduce material it does not cover.'
        : 'Generate curriculum-appropriate questions for the given subject and grade.'}
2. MCQ: exactly 4 options, exactly one correctAnswer that matches one option verbatim.
3. SHORT_ANSWER: answerable in 2-4 sentences. Include a markingScheme naming the key points.
4. LONG_ANSWER / ESSAY: a structured answer is expected. Include a markingScheme.
5. Every question MUST carry a bloomsLevel: REMEMBER|UNDERSTAND|APPLY|ANALYZE|EVALUATE|CREATE.
6. Every question MUST carry a difficulty: EASY|MEDIUM|HARD.
7. Every question in this section is worth exactly ${section.marksPerQuestion} mark(s).
8. Nepal standard: clear, simple English pitched at the grade level.
9. Return exactly ${section.questionCount} question(s) - no more, no fewer.${avoid}${reason}

DIAGRAMS. Emit a "figure" WHENEVER the question is about one of the solids below - a mensuration or
geometry question naming a cone, cylinder, sphere, hemisphere, triangle or circle SHOULD carry one,
because that is how the printed paper sets it. Use "figure": null for everything else (arithmetic,
algebra, prose, statistics); a wrong figure is worse than none.

Rule that cannot be broken: every dimension in "figure" MUST also appear in "questionText", so a
child can answer from the words alone if the print is poor. Shapes and their required numbers:
  cone {radius,height,slant?} | cylinder {radius,height} | sphere {radius} |
  hemisphere {radius} | triangle {base,height,rightAngle?} | circle {radius} |
  rectangle {width,height} | square {side}
Use ONLY these shape names and ONLY these keys. A shape outside this list means the whole figure is
discarded and the question prints without one, so do not invent names like "cuboid" or "polygon".
"parts" holds one shape, or two to stack a composite solid (a cone on a hemisphere).

Example of a question that MUST have one:
  {"questionText":"A cone of radius 7 cm and height 24 cm ... find its volume.",
   "figure":{"parts":[{"shape":"cone","radius":7,"height":24}],"unit":"cm","caption":"Fig. 1"}}

COUNT. The "questions" array must hold EXACTLY ${section.questionCount} item(s). Not one fewer.
Count them before you answer. A section that comes back short leaves a hole in a printed exam paper
that a teacher has to fill by hand.

Return ONLY valid JSON - no markdown, no preamble:
{
  "sectionName": "${section.name}",
  "sectionType": "${section.type}",
  "instructions": "a one-line instruction for students attempting this section",
  "questions": [
    {
      "questionText": "...",
      "figure": null,
      "questionType": "${section.type === 'ESSAY' ? 'LONG_ANSWER' : section.type}",
      "marks": ${section.marksPerQuestion},
      "bloomsLevel": "REMEMBER",
      "difficulty": "EASY",
      ${section.type === 'MCQ' ? '"options": ["...", "...", "...", "..."],\n      "correctAnswer": "...",\n      ' : ''}"markingScheme": "...",
      "sourceRef": "the topic or concept this tests"
    }
  ]
}`;
}

/**
 * Normalise one model-produced section into the stored shape.
 *
 * Question numbering is left at 0 here on purpose - `renumberQuestions` assigns the real
 * numbers once every section has arrived.
 */
export function normaliseSection(
    raw: {
        sectionName?: string;
        sectionType?: string;
        instructions?: string;
        questions?: Partial<GeneratedQuestion>[];
    },
    section: GenerationSectionSpec,
    fallbackSourceRef?: string,
): GeneratedSection {
    const type: GeneratedQuestionType = section.type === 'ESSAY' ? 'LONG_ANSWER' : section.type;

    const questions: GeneratedQuestion[] = (raw.questions ?? []).map((q) => {
        const marks = typeof q.marks === 'number' && q.marks > 0 ? q.marks : section.marksPerQuestion;
        const flags = validateGeneratedQuestion({
            questionText: q.questionText,
            questionType: q.questionType ?? type,
            options: q.options,
            correctAnswer: q.correctAnswer,
            marks,
        });
        return {
            questionNumber: 0,
            questionText: q.questionText ?? '',
            // Carried through UNVALIDATED here on purpose: the renderer's `isDrawableFigure` is the
            // single gate, so there is exactly one definition of "a figure we can draw" and a spec
            // cannot be accepted by one layer and silently refused by another.
            figure: (q as { figure?: unknown }).figure ?? null,
            questionType: (q.questionType as GeneratedQuestionType) ?? type,
            marks,
            options: q.options,
            correctAnswer: q.correctAnswer,
            markingScheme: q.markingScheme,
            bloomsLevel: (q.bloomsLevel as BloomsLevel) ?? 'UNDERSTAND',
            difficulty: (q.difficulty as DifficultyLevel) ?? 'MEDIUM',
            sourceRef: q.sourceRef ?? fallbackSourceRef,
            reviewStatus: 'PENDING',
            validationFlags: flags,
        };
    });

    return {
        sectionName: raw.sectionName?.trim() || section.name,
        sectionType: raw.sectionType?.trim() || section.type,
        // The configured total, not a sum of what the model returned. If the model short-changed
        // the section, the marks header must still say what the paper was designed to be worth -
        // the shortfall shows up as a missing question, which is visible, rather than as a
        // quietly smaller paper, which is not.
        totalMarks: section.questionCount * section.marksPerQuestion,
        instructions: raw.instructions,
        questions,
    };
}
