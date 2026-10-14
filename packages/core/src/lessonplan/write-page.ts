import type { LessonSlot, OutlineItem } from './outline';

/**
 * Writing ONE page of a lesson in full. The prompt, and the contract that makes a page teachable.
 *
 * ## The one rule that matters
 *
 * This prompt NEVER mentions length. Not a token count, not a word count, not "briefly". The whole
 * reason pages are written one at a time is so that each one can be as long as teaching it takes:
 * a page on twisted-pair cable that needs three thousand tokens to carry the definition, the
 * reason the pairs twist, the board lines, a worked example and the misconception gets three
 * thousand tokens. A ceiling is set by the CALLER as a runaway guard, high enough never to be hit
 * by an honest page.
 *
 * ## What a page IS
 *
 * A page is teachable when a teacher who has never taught this can read `description` aloud, copy
 * `board` up line by line, run `example`, ask `askTheClass`, and know from `listenFor` which wrong
 * answer is coming. Every slot type has its own shape below, because a review page and a practice
 * page are different jobs and a single template produces a page that is half of each.
 *
 * Runs in the worker (per page, on an alarm tick) and could run inline; it depends on nothing but
 * strings.
 */

export interface WritePageContext {
    subject: string;
    className: string;
    topic: string;
    /** The whole outline, so the page knows what came before and what follows. */
    outline: OutlineItem[];
    /** 0-based index into `outline` of the page being written. */
    index: number;
    objectives: string[];
    bloomsLevel: string;
    teachingStyle: string;
    language: 'en' | 'ne';
    /** Textbook excerpts retrieved for this plan. Empty when the book is not embedded. */
    excerpts: { content: string; sourceRef: string | null }[];
    /** Pages already written, so the model does not re-teach page 3 on page 5. */
    writtenBefore: { activity: string; description: string }[];
}

/** What each slot's page must contain. This is the contract, stated to the model as the job. */
const SLOT_CONTRACT: Record<LessonSlot, string> = {
    REVIEW: `This is the REVIEW page that opens the period. Its job is to bring the last lesson back
into the room in a few minutes. It contains: the exact questions to ask, in order, each with the
answer a correct student gives; what to write on the board as the answers come; and the one thing
from last time this lesson builds on, said in a sentence the teacher can repeat.`,
    TEACH: `This is a TEACH page. Its job is to put ONE new idea into a Class ${'{class}'} student's head so
completely that they could explain it to a friend. It contains, in this order:
  1. The definition, in one clear sentence a student can copy.
  2. The explanation, as the teacher would SAY it aloud, in full, as separate paragraphs, one per
     beat: (a) what the thing is, in the words of the definition and then in plain words; (b) how it
     works, step by step, naming every part and what each part does; (c) WHY it is the way it is -
     the reason behind the design, the number, the rule; (d) where a student in Nepal has seen it,
     using a concrete object or place from a Nepali school, town or home; (e) what it is NOT - the
     thing it is most often confused with, and the one difference that tells them apart. Each beat
     is its own paragraph and none may be a single sentence. This is the longest part of the page
     and it must be complete - a teacher who has never taught this reads it and can teach it.
  3. What goes on the board, line by line, exactly as it should be written - the definition, the
     labels, the key numbers or words.
  4. One worked example or demonstration, done in full with every step shown.
  5. One question to ask the class at the end of the explanation, and the answer expected.
  6. The misconception this class is likely to have, and what it sounds like when a student says it.`,
    GUIDED: `This is a GUIDED PRACTICE page. Its job is to have the whole class work ONE example together
while the teacher asks questions and checks. It contains: the example, stated fully; the sequence of
questions the teacher asks to move the class through it, each with the expected answer; what goes on
the board as the class works it; and, in "listenFor", the exact mistake this class is likely to make
and what it sounds like.`,
    INDEPENDENT: `This is an INDEPENDENT PRACTICE page. Students work alone in the exercise book. It
contains: three to five questions, written out in full and increasing in difficulty, with a model
answer for each; what the teacher writes on the board (the questions, and nothing else until the
end); one prompt the teacher uses with a student who is stuck; and the answer a student who has
misunderstood is most likely to write.`,
    CHECK: `This is the CHECK page that closes the period. Every student answers alone, on paper. It
contains: exactly three short questions, one per objective, each with its answer; how the papers are
collected; and what the teacher does with the result before the bell - which wrong answer to look for
first, and what to say if most of the class has it.`,
};

export const WRITE_PAGE_SYSTEM = 'You write ONE page of a school lesson in Nepal, for a teacher to teach from tomorrow. Return only JSON.';

export function writePagePrompt(ctx: WritePageContext): string {
    const page = ctx.outline[ctx.index];
    if (!page) throw new Error(`No outline item at ${ctx.index}`);
    const contract = SLOT_CONTRACT[page.slot].replace('{class}', ctx.className);
    const others = ctx.outline.map((o, i) => `  ${i === ctx.index ? '>>' : '  '} page ${i + 2} (${o.slot}, ${o.duration} min): ${o.activity} - ${o.brief}`).join('\n');
    const before = ctx.writtenBefore.length
        ? `\nPAGES ALREADY WRITTEN (do not re-teach these; build on them):\n${ctx.writtenBefore.map((w) => `- ${w.activity}: ${w.description.slice(0, 400)}`).join('\n')}\n`
        : '';
    const excerpts = ctx.excerpts.length
        ? `\nFROM THE TEXTBOOK the school uses. Teach what it teaches, in its terms, and cite nothing else as "the book":\n${ctx.excerpts.map((e) => `--- ${e.sourceRef ?? 'excerpt'}\n${e.content.slice(0, 1400)}`).join('\n')}\n`
        : '\nNo textbook excerpts are available. Teach from the Nepali secondary curriculum as it is generally taught.\n';

    return `THE LESSON: ${ctx.subject}, Class ${ctx.className}: ${ctx.topic}
Objectives for the whole period:
${ctx.objectives.map((o, i) => `  ${i + 1}. ${o}`).join('\n')}
Teaching style: ${ctx.teachingStyle}. Bloom's target: ${ctx.bloomsLevel}.

THE WHOLE OUTLINE, with the page you are writing marked >>:
${others}
${before}${excerpts}
YOU ARE WRITING PAGE ${ctx.index + 2}: "${page.activity}" (${page.slot}, ${page.duration} minutes)
The outline says this page must cover: ${page.brief}

${contract}

Write it COMPLETELY. Do not summarise, do not abbreviate, do not write "explain the concept" - write
the explanation. Do not leave anything for the teacher to look up. If a definition is needed, give
it. If a number is needed, give it. If an example is needed, do the whole example. There is no limit
on how much you write; the limit is that nothing may be missing.

${ctx.language === 'ne'
    ? 'Write every text value in clear Nepali (Devanagari). Keys stay in English.'
    : 'Write in plain English a Class ' + ctx.className + ' teacher in Nepal reads comfortably. Short sentences. Use hyphens, never dashes.'}

Return ONLY this JSON:
{
  "description": the explanation as the teacher says it aloud, in full - several paragraphs for a TEACH page,
  "board": [each line to write on the board, in order, verbatim],
  "example": the worked example or demonstration, every step shown, or "" if this slot has none,
  "askTheClass": the question to ask and the answer expected,
  "listenFor": the misconception and what it sounds like,
  "materials": [only what THIS page needs that a Nepali classroom does not already have; usually []]
}`;
}

/** Shape-check the model's answer and drop anything that is not a string where a string is due. */
export interface ParsedPage {
    description: string;
    board: string[];
    example: string;
    askTheClass: string;
    listenFor: string;
    materials: string[];
}

export function parseWrittenPage(raw: unknown): ParsedPage | null {
    if (typeof raw !== 'object' || raw === null) return null;
    const r = raw as Record<string, unknown>;
    // The model writes em- and en-dashes in board lines whatever the prompt says. House style is
    // a hyphen, and a board line is copied onto a board by hand, where a long dash is just a line.
    const str = (v: unknown) => (typeof v === 'string' ? v.replace(/[\u2013\u2014]/g, '-').trim() : '');
    const description = str(r.description);
    if (!description) return null;
    const board = Array.isArray(r.board) ? r.board.map(str).filter((l) => l.length > 0) : [];
    const materials = Array.isArray(r.materials) ? r.materials.map(str).filter((m) => m.length > 0) : [];
    return { description, board, example: str(r.example), askTheClass: str(r.askTheClass), listenFor: str(r.listenFor), materials };
}
