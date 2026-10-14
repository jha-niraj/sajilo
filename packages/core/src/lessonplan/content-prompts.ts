import { LIMITS } from '../diagram';
import type { ContentPage, ContentPageKind } from './content-page';

/**
 * How a content page is asked for. Shared by the worker (which writes) and the app (which
 * outlines), so the two never describe a page differently.
 *
 * ## The register
 *
 * Expository. "A bus topology connects every device to one shared cable, called the backbone."
 * Never "today we are going to learn", never "good morning class", never "let's". The page is read
 * by anyone; the teacher's own words go in the teacher layer, and even there they are optional.
 *
 * ## No length anywhere
 *
 * The contract names what must be present. Nothing here says how long; the validator in
 * `content-page.ts` enforces the shape and the caller rewrites with the failures named.
 */

/** How an example may be shaped. Stated once, used by two contracts. */
const EXAMPLE_SHAPES = `either plain text with one step per line, or an object: {"kind":"steps","steps":[...]} for a procedure, {"kind":"table","columns":[...],"rows":[[...]]} for a working laid out in columns such as a division ladder or a place-value table, {"kind":"equations","lines":[...]} for a derivation one line per equals`;

/** The eight question shapes, as the writer is told them. The validator in content-page.ts enforces each. */
export const QUESTION_SHAPES = `  MCQ         {"type":"MCQ","question":"...","options":[4 options],"answer": index of the right one}
  SELECT      {"type":"SELECT","question":"...","options":[3 to 6],"answer":[two or more indices]}
  SHORT       {"type":"SHORT","question":"...","answer":"the model answer"}
  FILL        {"type":"FILL","question":"a sentence with ___ where the word goes","answer":"the word","accept":["other right spellings"]}
  TRUE_FALSE  {"type":"TRUE_FALSE","question":"a statement","answer": true or false}
  NUMERIC     {"type":"NUMERIC","question":"...","answer": the number,"tolerance": 0 or a small amount,"unit":"kg"}
  MATCH       {"type":"MATCH","question":"Match the ...","pairs":[["left","right"], 3 to 6 pairs in the CORRECT pairing]}
  ORDER       {"type":"ORDER","question":"Put these in order ...","items":[3 to 6 items in the CORRECT order]}`;

export const CONTENT_PAGE_SYSTEM = 'You write ONE page of a school lesson in Nepal, as reference material anyone can learn the topic from. Return only JSON.';

/** What the outline is told each kind is for. Also the writer's contract, stated once. */
export const KIND_CONTRACT: Record<ContentPageKind, string> = {
	HOOK: `HOOK - the first page. One question or one scene from a Nepali student's life that makes the
topic matter, in "lead". Up to 2 supporting facts in "points". No definition yet. Usually wants a
picture of the scene.`,
	REVIEW: `REVIEW - the last lesson brought back before the new one. "questions": 3 to 6 short retrieval
questions on what was taught LAST TIME (given to you as PREVIOUS LESSON), mixed types, with answers and
"why". "lead" says in one line what is being recalled. Nothing new is taught on this page.`,
	GOALS: `GOALS - the objectives, as "points". Written by the outline from the objectives; the writer never
touches it.`,
	VOCABULARY: `VOCABULARY - every term the exam uses for this lesson, in the book's words: "terms" as 4 to 8
{term, meaning}, each meaning one plain sentence. "lead" says what the terms are for in one line.`,
	CONCEPT: `CONCEPT - ONE idea. "lead" is the definition in one sentence a student can copy. "points" are 3 to 6
statements that together explain it: what it is made of, how it works, why it is that way, where a
student in Nepal has seen it, what it is NOT (the thing it is confused with). "example" is one
concrete case, worked or described fully (${EXAMPLE_SHAPES}). One figure that explains, when the outline asked for one.`,
	EXAMPLE: `EXAMPLE - a worked problem. "lead" states the problem with its real numbers. "example" is the
solution with every step shown and the answer last, ${EXAMPLE_SHAPES}. "points" are the rule or the steps used, 2 to 5.`,
	GUIDED: `GUIDED - "we do": the SAME procedure as the worked example before it, with NEW numbers, and the
steps written with blanks (___) where the class supplies the number or the word. "lead" states the new
problem. "example" is the steps with the blanks, one step per line, and it is NEVER empty - for
"Convert 125 to hexadecimal" it reads "125 ÷ 16 = ___ remainder ___\n___ ÷ 16 = 0 remainder ___\nRead the
remainders upward: 125 = ___ in base 16". "teacher.ask" carries every blank as a question with its answer,
in order, so the teacher can call on the class step by step.`,
	COMPARE: `COMPARE - the variants side by side. "table" with 2 to ${LIMITS.tableCols} columns (the first names the
thing compared) and 2 to ${LIMITS.tableRows} rows, every cell a few words. "points" are 1 to 3 takeaways
the table shows. "lead" says what is being compared.`,
	PRACTICE: `PRACTICE - questions students do alone, rising in difficulty, "questions" with a model answer each.
Mostly SHORT, NUMERIC and FILL (the shapes below); a choice only where one genuinely fits. "lead" is the instruction line.`,
	CHECK: `CHECK - a check on the concept pages before it. "questions": the number asked for, of MIXED types - at
least one MCQ and at least three different types in all. The shapes:
${QUESTION_SHAPES}
Every question carries "why": why the wrong options are wrong, or what a full answer must contain.
Questions test the pages before this one and nothing later. "lead" is one instruction line.`,
	SUMMARY: `SUMMARY - the whole lesson in 5 to 10 lines a student copies into the exercise book, as
"summary". "lead" is one sentence saying what was learnt.`,
};

export interface ContentPageContext {
	subject: string;
	className: string;
	topic: string;
	objectives: string[];
	language: 'en' | 'ne';
	/** The outline: every page's kind, title and brief, so the writer knows what came before. */
	outline: Pick<ContentPage, 'kind' | 'title' | 'brief' | 'questionCount'>[];
	index: number;
	/** The pages already written: their lead and points, so nothing is re-taught and a CHECK knows what it covers. */
	writtenBefore: { kind: ContentPageKind; title: string; lead: string; points: string[] }[];
	/** Textbook excerpts. Empty when the chapter is not embedded. */
	excerpts: { content: string; sourceRef: string | null }[];
}

export function contentPagePrompt(ctx: ContentPageContext): string {
	const page = ctx.outline[ctx.index];
	if (!page) throw new Error(`No outline item at ${ctx.index}`);
	const outline = ctx.outline.map((o, i) => `  ${i === ctx.index ? '>>' : '  '} ${i + 1}. [${o.kind}] ${o.title} - ${o.brief}`).join('\n');
	const before = ctx.writtenBefore.length
		? `\nALREADY ON EARLIER PAGES (do not repeat; a CHECK tests exactly these):\n${ctx.writtenBefore.map((w) => `- [${w.kind}] ${w.title}: ${w.lead}${w.points.length ? ' / ' + w.points.join(' / ') : ''}`).join('\n')}\n`
		: '';
	const excerpts = ctx.excerpts.length
		? `\nFROM THE TEXTBOOK the school uses. Use its terms and its order; never cite anything else as the book:\n${ctx.excerpts.map((e) => `--- ${e.sourceRef ?? 'excerpt'}\n${e.content.slice(0, 1400)}`).join('\n')}\n`
		: '\nNo textbook excerpts are available. Write from the Nepali secondary curriculum as it is generally taught.\n';
	const count = page.questionCount ? `\nThis page must carry ${page.questionCount} questions.` : '';
	const lang = ctx.language === 'ne'
		? 'Every text value in clear Nepali (Devanagari). Keys stay in English.'
		: 'Plain English a Class ' + ctx.className + ' student in Nepal reads comfortably. Short sentences. Hyphens, never dashes.';

	return `THE LESSON: ${ctx.subject}, Class ${ctx.className}: ${ctx.topic}
Objectives:
${ctx.objectives.map((o, i) => `  ${i + 1}. ${o}`).join('\n')}

THE OUTLINE, the page you are writing marked >>:
${outline}
${before}${excerpts}
YOU ARE WRITING PAGE ${ctx.index + 1}: "${page.title}"
The outline says: ${page.brief}${count}

THE CONTRACT FOR THIS KIND OF PAGE:
${KIND_CONTRACT[page.kind]}

THE REGISTER: this page is reference material. State things. "A bus topology connects every device to
one shared cable, the backbone." Never "today we will learn", never "good morning", never "let's",
never a question to the class - those belong in "teacher". Use the book's words for every term. Give
real numbers, real names, real places. Nothing is left for the reader to look up.

THE TEACHER LAYER is separate and is never shown to the class:
  "say"       two or three lines the teacher may say to open this page. Optional; "" is fine.
  "ask"       questions to put to the class on this page, each {"question", "answer"}.
  "watchFor"  the misconception this class is likely to have, and what it sounds like in a student's words.
  "board"     what to write on the board for this page, line by line, verbatim. [] if nothing.

${lang}

Return ONLY this JSON:
{
  "content": { "lead": "", "points": [], "example": "" or {shaped}, "terms": [], "table": {"columns": [], "rows": []}, "questions": [], "summary": [] },
  "teacher": { "say": "", "ask": [{"question": "", "answer": ""}], "watchFor": "", "board": [] }
}
Fill only the content fields this kind uses; leave the others empty.`;
}

/** Appended to the prompt on the one rewrite, with the validator's own words. */
export function rewriteSuffix(failures: string[]): string {
	return `\n\nYOUR PREVIOUS ANSWER WAS REJECTED FOR THESE REASONS:\n${failures.map((f) => `- ${f}`).join('\n')}\nFix exactly these and return the whole page again.`;
}

/** The kinds, described for the OUTLINE prompt. */
export function outlineKindCatalogue(): string {
	return (Object.keys(KIND_CONTRACT) as ContentPageKind[]).map((k) => `- ${KIND_CONTRACT[k]}`).join('\n');
}
