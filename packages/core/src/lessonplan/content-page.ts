import type { FigureIntent } from './outline';
import { isDrawableDiagram, LIMITS, type DiagramSpec } from '../diagram';

/**
 * A lesson page in two layers.
 *
 * ## Why two layers
 *
 * The first written plans put "Ask the class: what happens if the hub fails? Expected answer: ..."
 * and "Listen for: students will say ..." on the same page as the definition and the diagram. So the
 * presenter showed the class the answers, and the page read as a script ("Good morning class, today
 * we are going to learn...") rather than as the thing being taught.
 *
 * `content` is the page: what anyone - a student, a supervisor, a teacher who has never taught this -
 * opens to learn the topic. Expository, dense, one figure that explains. `teacher` is what only the
 * person at the front needs: what to say if they want a line, what to ask and the answer, the
 * misconception to listen for, the board plan. It is rendered ONLY by the teacher tab on the plan
 * page - never by the presenter, never by the PDF, never on the content page.
 *
 * ## Why the order is the subject's and not a template's
 *
 * Review / Teach / Guided / Independent / Check, with minutes allocated first, produced four
 * "Guided practice on <the thing before>" pages that re-taught the page before. A page exists here
 * because the chapter has that idea: hook, goals, vocabulary, then the concepts in the book's order,
 * with a CHECK wherever the concepts before it support one, and a summary to copy.
 *
 * ## Storage
 *
 * `lesson_plans.activities`, as before. `activity` and `description` are kept as mirrors of the
 * title and the content so every older reader (My Day, the register, the hub) keeps working.
 */

/**
 * REVIEW and GUIDED were added on 2026-09-13 from the evidence (plan/main/lessonplan/
 * calm-page-visuals-video-review.md): retrieval of the last lesson before the new one, and a
 * second worked example with blanks between the teacher's example and the check.
 */
export type ContentPageKind =
	| 'HOOK' | 'REVIEW' | 'GOALS' | 'VOCABULARY' | 'CONCEPT' | 'EXAMPLE' | 'GUIDED' | 'COMPARE' | 'PRACTICE' | 'CHECK' | 'SUMMARY';

export const CONTENT_PAGE_KINDS: ContentPageKind[] = [
	'HOOK', 'REVIEW', 'GOALS', 'VOCABULARY', 'CONCEPT', 'EXAMPLE', 'GUIDED', 'COMPARE', 'PRACTICE', 'CHECK', 'SUMMARY',
];

export const KIND_LABEL: Record<ContentPageKind, string> = {
	HOOK: 'Hook', REVIEW: 'Review', GOALS: 'Goals', VOCABULARY: 'Vocabulary', CONCEPT: 'Concept', EXAMPLE: 'Worked example',
	GUIDED: 'We do', COMPARE: 'Compare', PRACTICE: 'Practice', CHECK: 'Check', SUMMARY: 'Summary',
};

/**
 * The eight kinds of question a page may carry.
 *
 * Three were enough for a screen. They were not enough for a printed sheet (nothing to write ON)
 * or a projector (nothing to tap), which is what the other five are for: a blank prints as a line
 * and reveals on tap, a number prints as a box with its unit, true or false tallies by hand in a
 * room, and matching and ordering are the two that make a slide worth touching.
 */
export type CheckQuestionType = 'MCQ' | 'SELECT' | 'SHORT' | 'FILL' | 'TRUE_FALSE' | 'NUMERIC' | 'MATCH' | 'ORDER';

export const CHECK_QUESTION_TYPES: CheckQuestionType[] = ['MCQ', 'SELECT', 'SHORT', 'FILL', 'TRUE_FALSE', 'NUMERIC', 'MATCH', 'ORDER'];

/**
 * One question. The answer lives here, on the object, and it is the RENDERER's job to show it only
 * in the teacher tab. Keeping it on the question rather than in a parallel list is what stops
 * answer 3 from drifting away from question 3 on the first edit.
 *
 * Per type:
 *   MCQ         options (exactly 4), answer = the index
 *   SELECT      options (3 to 6), answer = two or more indices
 *   SHORT       answer = the model answer
 *   FILL        question carries `___` where the word goes; answer = the word; accept = other spellings
 *   TRUE_FALSE  answer = true or false
 *   NUMERIC     answer = the number; tolerance (absolute, default 0); unit
 *   MATCH       pairs = [left, right][] (3 to 6) in the CORRECT pairing; the renderer shuffles the right
 *   ORDER       items in the CORRECT order (3 to 6); the renderer shuffles
 */
export interface CheckQuestion {
	type: CheckQuestionType;
	question: string;
	/** MCQ: exactly four. SELECT: three to six. Absent elsewhere. */
	options?: string[];
	/** MCQ: the index. SELECT: the indices. SHORT and FILL: the model answer. TRUE_FALSE: the truth. NUMERIC: the number. MATCH and ORDER: unused, ''. */
	answer: number | number[] | string | boolean;
	/** FILL: other spellings or forms that are also right. */
	accept?: string[];
	/** NUMERIC: how far off is still right, as an absolute amount. 0 when absent. */
	tolerance?: number;
	/** NUMERIC: the unit the answer is in, printed after the box. */
	unit?: string;
	/** MATCH: the correct pairing. */
	pairs?: [string, string][];
	/** ORDER: the items in the correct order. */
	items?: string[];
	/** Teacher-only: why the wrong options are wrong, or what a full answer must contain. */
	why?: string;
}

/**
 * A worked example with a shape.
 *
 * A division ladder squashed into lines is a division ladder squashed into lines. When the writer
 * says what the example IS - a table, a run of equations, numbered steps - every surface can draw
 * it as that. `PageContent.example` stays the plain text of it, so an older reader, the register
 * mirror and a teacher's edit all keep working on text.
 */
export type ExampleLayout =
	| { kind: 'steps'; steps: string[] }
	| { kind: 'table'; columns: string[]; rows: string[][] }
	| { kind: 'equations'; lines: string[] };

export interface VocabTerm { term: string; meaning: string }
export interface CompareTable { columns: string[]; rows: string[][] }

/** The page. Which fields are filled depends on the kind; `validateContentPage` says which. */
export interface PageContent {
	/** The one sentence at the top: a definition, a problem, a question, an instruction. */
	lead: string;
	/** Three to six on a CONCEPT page; fewer or none elsewhere. */
	points: string[];
	/** A worked example or a concrete case, as text. Empty where the kind has none. */
	example: string;
	/** The same example with a shape, when the writer gave it one. Renderers prefer this. */
	exampleLayout?: ExampleLayout;
	terms?: VocabTerm[];
	table?: CompareTable;
	questions?: CheckQuestion[];
	summary?: string[];
}

/** What only the teacher sees. */
export interface TeacherLayer {
	say: string;
	ask: { question: string; answer: string }[];
	watchFor: string;
	board: string[];
}

/**
 * A video on a page: a link, never a file, with the questions that make it a lesson rather than a
 * break. Two asked before it plays, one after, all with answers, all ordinary CheckQuestions so the
 * teacher tab, the presenter's reveal and the PDF already know how to show them.
 */
export interface PageVideo {
	kind: 'video';
	youtubeId: string;
	title: string;
	channelTitle: string | null;
	durationSeconds: number | null;
	thumbnailUrl: string | null;
	isShort: boolean;
	before: CheckQuestion[];
	after: CheckQuestion | null;
}

export type PageMedia = PageVideo;

export interface ContentPage {
	version: 2;
	kind: ContentPageKind;
	title: string;
	brief: string;
	/** Suggested minutes. Scaled to the period by the outline, never the driver. */
	duration: number;
	/** Decided for EVERY page by the outline. `null` is "no picture", never "not decided". */
	figureIntent: FigureIntent | null;
	/** CHECK and PRACTICE: how many questions this page must carry. */
	questionCount?: number;
	content: PageContent | null;
	teacher: TeacherLayer | null;
	/** Failures the rewrite could not clear. Shown to the teacher, never silently dropped. */
	warnings?: string[];
	/** The textbook pages this page was written from, kept from the excerpts at write time. */
	sourcePages?: number[];
	/** A video with its questions, when the teacher attached one. */
	media?: PageMedia | null;
	/** When the teacher ticked this page as taught. Null or absent: not yet. */
	taughtAt?: string | null;
	diagram?: unknown;
	figureId?: string | null;
	figureError?: string | null;
	/** Mirrors, for readers that predate this model. */
	activity: string;
	description: string;
}

const isStr = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

export function isContentPageKind(v: unknown): v is ContentPageKind {
	return typeof v === 'string' && (CONTENT_PAGE_KINDS as string[]).includes(v);
}

/** True for an item written by this model, whether or not its content has been filled yet. */
export function isContentPage(v: unknown): v is ContentPage {
	return isRecord(v) && v.version === 2 && isContentPageKind(v.kind) && isStr(v.title);
}

export function isPageContentWritten(page: Pick<ContentPage, 'content'> | null | undefined): boolean {
	return !!page?.content && isStr(page.content.lead);
}

/** About one and a half questions per page, spread over the check pages. Never fewer than ten. */
export function questionTarget(pageCount: number): number {
	return Math.min(25, Math.max(10, Math.round(pageCount * 1.5)));
}

/** Split a target evenly; the remainder goes to the later checks, which have more behind them. */
export function distributeQuestions(target: number, checkPages: number): number[] {
	if (checkPages <= 0) return [];
	const base = Math.floor(target / checkPages);
	const extra = target - base * checkPages;
	return Array.from({ length: checkPages }, (_, i) => base + (i >= checkPages - extra ? 1 : 0));
}

/**
 * The plain-text mirror written into `description`, so the register, My Day and every reader that
 * predates this model still shows the page's substance and not an empty string.
 */
export function mirrorDescription(content: PageContent | null): string {
	if (!content) return '';
	const parts: string[] = [];
	if (isStr(content.lead)) parts.push(content.lead.trim());
	if (content.points.length > 0) parts.push(content.points.map((p) => `- ${p}`).join('\n'));
	if (content.terms?.length) parts.push(content.terms.map((t) => `${t.term}: ${t.meaning}`).join('\n'));
	if (content.summary?.length) parts.push(content.summary.map((l) => `- ${l}`).join('\n'));
	if (content.questions?.length) parts.push(content.questions.map((q, i) => `${i + 1}. ${q.question}`).join('\n'));
	if (isStr(content.example)) parts.push(content.example.trim());
	return parts.join('\n\n');
}

/** The teacher-facing answer of a question, as one line. Used by every surface that may show it. */
export function answerText(q: Pick<CheckQuestion, 'type' | 'options' | 'answer' | 'accept' | 'tolerance' | 'unit' | 'pairs' | 'items'>): string {
	const letter = (i: number) => `${String.fromCharCode(65 + i)}. ${q.options?.[i] ?? ''}`;
	switch (q.type) {
		case 'MCQ': return typeof q.answer === 'number' ? letter(q.answer) : String(q.answer);
		case 'SELECT': return Array.isArray(q.answer) ? q.answer.map(letter).join('; ') : String(q.answer);
		case 'TRUE_FALSE': return q.answer === true ? 'True' : q.answer === false ? 'False' : String(q.answer);
		case 'NUMERIC': {
			const unit = q.unit ? ` ${q.unit}` : '';
			const tol = q.tolerance && q.tolerance > 0 ? ` (accept \u00b1${q.tolerance})` : '';
			return `${String(q.answer)}${unit}${tol}`;
		}
		case 'FILL': return `${String(q.answer)}${q.accept?.length ? ` (also: ${q.accept.join(', ')})` : ''}`;
		case 'MATCH': return (q.pairs ?? []).map(([l, r]) => `${l} - ${r}`).join('; ');
		case 'ORDER': return (q.items ?? []).map((it, i) => `${i + 1}. ${it}`).join('  ');
		default: return typeof q.answer === 'string' ? q.answer : String(q.answer);
	}
}

/** The one line under a question that tells the class how to answer it. Null for an MCQ. */
export function questionNote(q: Pick<CheckQuestion, 'type' | 'unit'>): string | null {
	switch (q.type) {
		case 'SELECT': return 'More than one is right.';
		case 'SHORT': return 'Write the answer in the exercise book.';
		case 'FILL': return 'Fill in the blank.';
		case 'TRUE_FALSE': return 'True or false?';
		case 'NUMERIC': return q.unit ? `Write the number, in ${q.unit}.` : 'Write the number.';
		case 'MATCH': return 'Match each on the left with one on the right.';
		case 'ORDER': return 'Put these in the correct order.';
		default: return null;
	}
}

/**
 * A stable shuffle, seeded by the text, so the same question is shuffled the same way on the
 * screen, the projector and the printed sheet. A random shuffle would print one order and project
 * another, and the answer key would match neither.
 */
export function stableShuffle<T>(items: T[], seed: string): T[] {
	let h = 2166136261;
	for (const ch of seed) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
	const out = items.slice();
	for (let i = out.length - 1; i > 0; i -= 1) {
		h = (Math.imul(h, 1103515245) + 12345) >>> 0;
		const j = h % (i + 1);
		[out[i], out[j]] = [out[j]!, out[i]!];
	}
	return out;
}

/** The right-hand column of a MATCH question as the class sees it: shuffled, with its true index. */
export function matchDisplay(q: Pick<CheckQuestion, 'question' | 'pairs'>): { left: string[]; right: { text: string; pairIndex: number }[] } {
	const pairs = q.pairs ?? [];
	const right = stableShuffle(pairs.map(([, r], i) => ({ text: r, pairIndex: i })), q.question);
	// A shuffle that leaves everything in place is a give-away; rotate once when that happens.
	const same = right.every((r, i) => r.pairIndex === i);
	return { left: pairs.map(([l]) => l), right: same && right.length > 1 ? [...right.slice(1), right[0]!] : right };
}

/** The items of an ORDER question as the class sees them: shuffled, each with its true position. */
export function orderDisplay(q: Pick<CheckQuestion, 'question' | 'items'>): { text: string; position: number }[] {
	const items = (q.items ?? []).map((text, position) => ({ text, position }));
	const out = stableShuffle(items, q.question);
	const same = out.every((it, i) => it.position === i);
	return same && out.length > 1 ? [...out.slice(1), out[0]!] : out;
}

/** The plain text of a shaped example, for the mirror and for any reader that only takes text. */
export function exampleLayoutText(layout: ExampleLayout): string {
	switch (layout.kind) {
		case 'steps': return layout.steps.map((st, i) => `${i + 1}. ${st}`).join('\n');
		case 'equations': return layout.lines.join('\n');
		case 'table': return [layout.columns.join(' | '), ...layout.rows.map((r) => r.join(' | '))].join('\n');
	}
}

/**
 * A COMPARE page's table as a figure THIS app draws. Built in code from the content, never asked
 * of the model a second time, so the drawn table and the printed table cannot disagree.
 */
export function compareTableDiagram(table: CompareTable | undefined, caption?: string): DiagramSpec | null {
	if (!table) return null;
	const clip = (s: string) => s.trim().slice(0, LIMITS.labelChars);
	const columns = table.columns.slice(0, LIMITS.tableCols).map(clip);
	const rows = table.rows.slice(0, LIMITS.tableRows).map((r) => columns.map((_, i) => clip(r[i] ?? '-')));
	const spec: unknown = { kind: 'table', columns, rows, ...(caption ? { caption: clip(caption) } : {}) };
	return isDrawableDiagram(spec) ? spec : null;
}

// ── The contract, checked in code ────────────────────────────────────────────────────────────

function validQuestion(q: unknown, i: number, out: string[]): q is CheckQuestion {
	const n = i + 1;
	if (!isRecord(q) || !isStr(q.question)) { out.push(`question ${n} has no text`); return false; }
	if (q.type === 'MCQ') {
		if (!Array.isArray(q.options) || q.options.length !== 4 || !q.options.every(isStr)) { out.push(`question ${n} (MCQ) must have exactly 4 options`); return false; }
		if (typeof q.answer !== 'number' || q.answer < 0 || q.answer > 3) { out.push(`question ${n} (MCQ) needs "answer" as the index 0-3 of the correct option`); return false; }
		return true;
	}
	if (q.type === 'SELECT') {
		if (!Array.isArray(q.options) || q.options.length < 3 || q.options.length > 6 || !q.options.every(isStr)) { out.push(`question ${n} (SELECT) must have 3 to 6 options`); return false; }
		if (!Array.isArray(q.answer) || q.answer.length < 2 || !q.answer.every((a) => typeof a === 'number' && a >= 0 && a < (q.options as string[]).length)) { out.push(`question ${n} (SELECT) needs "answer" as two or more option indices`); return false; }
		return true;
	}
	if (q.type === 'SHORT') {
		if (!isStr(q.answer)) { out.push(`question ${n} (SHORT) needs a model answer`); return false; }
		return true;
	}
	if (q.type === 'FILL') {
		if (!/_{3,}/.test(q.question)) { out.push(`question ${n} (FILL) must carry ___ where the missing word goes`); return false; }
		if (!isStr(q.answer)) { out.push(`question ${n} (FILL) needs "answer" as the missing word or phrase`); return false; }
		if (q.accept !== undefined && (!Array.isArray(q.accept) || !q.accept.every(isStr))) { out.push(`question ${n} (FILL) "accept" must be a list of other right answers`); return false; }
		return true;
	}
	if (q.type === 'TRUE_FALSE') {
		if (typeof q.answer !== 'boolean') { out.push(`question ${n} (TRUE_FALSE) needs "answer" as true or false`); return false; }
		return true;
	}
	if (q.type === 'NUMERIC') {
		if (typeof q.answer !== 'number' || !Number.isFinite(q.answer)) { out.push(`question ${n} (NUMERIC) needs "answer" as a number`); return false; }
		if (q.tolerance !== undefined && (typeof q.tolerance !== 'number' || q.tolerance < 0 || q.tolerance > Math.abs(q.answer) + 1)) { out.push(`question ${n} (NUMERIC) "tolerance" must be a small non-negative number, not wider than the answer`); return false; }
		if (q.unit !== undefined && typeof q.unit !== 'string') { out.push(`question ${n} (NUMERIC) "unit" must be text`); return false; }
		return true;
	}
	if (q.type === 'MATCH') {
		const pairs = q.pairs;
		if (!Array.isArray(pairs) || pairs.length < 3 || pairs.length > 6 || !pairs.every((p) => Array.isArray(p) && p.length === 2 && isStr(p[0]) && isStr(p[1]))) { out.push(`question ${n} (MATCH) needs "pairs" as 3 to 6 [left, right] pairs`); return false; }
		if (new Set(pairs.map((p) => (p as string[])[1]!.trim().toLowerCase())).size !== pairs.length) { out.push(`question ${n} (MATCH) has two pairs with the same right-hand side, so the matching is not unique`); return false; }
		return true;
	}
	if (q.type === 'ORDER') {
		const items = q.items;
		if (!Array.isArray(items) || items.length < 3 || items.length > 6 || !items.every(isStr)) { out.push(`question ${n} (ORDER) needs "items" as 3 to 6 items in the correct order`); return false; }
		if (new Set(items.map((it) => (it as string).trim().toLowerCase())).size !== items.length) { out.push(`question ${n} (ORDER) repeats an item`); return false; }
		return true;
	}
	out.push(`question ${n} has an unknown type; use MCQ, SELECT, SHORT, FILL, TRUE_FALSE, NUMERIC, MATCH or ORDER`);
	return false;
}

/** One question on its own, for a question asked outside a page (a live prompt). Empty means it is sound. */
export function validateQuestion(q: unknown): string[] {
	const out: string[] = [];
	validQuestion(q, 0, out);
	return out;
}

/**
 * Every way a page can fall short of its contract, named so the rewrite can be told exactly what to
 * fix. Empty means the page is teachable. A GOALS page is written by the outline and always passes.
 */
export function validateContentPage(page: Pick<ContentPage, 'kind' | 'content' | 'teacher' | 'questionCount'>): string[] {
	const out: string[] = [];
	const c = page.content;
	if (page.kind === 'GOALS') return out;
	if (!c) return ['no content'];
	const t = page.teacher;

	switch (page.kind) {
		case 'HOOK':
			if (!isStr(c.lead)) out.push('lead must be the question or the scene that makes the topic matter');
			if (c.points.length > 3) out.push('a hook carries at most 3 points');
			if (!t || t.ask.length < 1) out.push('teacher.ask must carry the hook question and the answer to steer towards');
			break;
		case 'VOCABULARY': {
			const terms = c.terms ?? [];
			if (terms.length < 4 || terms.length > 8) out.push(`terms must be 4 to 8, got ${terms.length}`);
			for (const [i, term] of terms.entries()) {
				if (!isStr(term.term) || !isStr(term.meaning)) out.push(`term ${i + 1} needs both a term and a meaning`);
				else if (words(term.meaning) > 30) out.push(`term "${term.term}" meaning is over 30 words`);
			}
			break;
		}
		case 'REVIEW': {
			const qs = c.questions ?? [];
			if (qs.length < 3 || qs.length > 6) out.push(`a review carries 3 to 6 questions, got ${qs.length}`);
			qs.forEach((q, i) => validQuestion(q, i, out));
			if (!isStr(c.lead)) out.push('lead must say in one line what is being recalled');
			break;
		}
		case 'GUIDED':
			if (!isStr(c.lead)) out.push('lead must state the problem the class works together, with its numbers');
			if (!isStr(c.example)) out.push('example must be the steps with blanks (___) where the class fills in');
			else if (!/_{3,}/.test(c.example)) out.push('example must leave at least one blank (___) for the class to fill');
			if (!t || t.ask.length < 1) out.push('teacher.ask must carry the filled steps as its answers');
			break;
		case 'CONCEPT':
			if (!isStr(c.lead)) out.push('lead must be the definition in one sentence');
			else if (words(c.lead) > 45) out.push('lead is over 45 words; it is one sentence, not a paragraph');
			if (c.points.length < 3 || c.points.length > 6) out.push(`points must be 3 to 6, got ${c.points.length}`);
			for (const [i, p] of c.points.entries()) if (words(p) > 30) out.push(`point ${i + 1} is over 30 words`);
			if (!isStr(c.example)) out.push('example must be a concrete case or worked example');
			if (!t || t.ask.length < 1) out.push('teacher.ask needs at least one question with its answer');
			if (!t || !isStr(t.watchFor)) out.push('teacher.watchFor must name the misconception and what it sounds like');
			break;
		case 'EXAMPLE':
			if (!isStr(c.lead)) out.push('lead must state the problem');
			if (!isStr(c.example)) out.push('example must be the worked solution, every step shown');
			if (!t || t.ask.length < 1) out.push('teacher.ask needs at least one question with its answer');
			break;
		case 'COMPARE': {
			const tb = c.table;
			if (!tb || !Array.isArray(tb.columns) || tb.columns.length < 2 || tb.columns.length > LIMITS.tableCols) out.push(`table needs 2 to ${LIMITS.tableCols} columns`);
			else if (!Array.isArray(tb.rows) || tb.rows.length < 2 || tb.rows.length > LIMITS.tableRows) out.push(`table needs 2 to ${LIMITS.tableRows} rows`);
			else if (!tb.rows.every((r) => Array.isArray(r) && r.length === tb.columns.length && r.every(isStr))) out.push('every table row needs one non-empty cell per column');
			if (c.points.length < 1) out.push('points must carry at least one takeaway from the comparison');
			if (!t || t.ask.length < 1) out.push('teacher.ask needs at least one question with its answer');
			break;
		}
		case 'PRACTICE': {
			const qs = c.questions ?? [];
			const need = Math.max(3, page.questionCount ?? 3);
			if (qs.length < need) out.push(`questions must be at least ${need}, got ${qs.length}`);
			qs.forEach((q, i) => validQuestion(q, i, out));
			break;
		}
		case 'CHECK': {
			const qs = c.questions ?? [];
			const need = Math.max(3, page.questionCount ?? 3);
			if (qs.length < need) out.push(`questions must be at least ${need}, got ${qs.length}`);
			qs.forEach((q, i) => validQuestion(q, i, out));
			if (qs.length > 0 && !qs.some((q) => isRecord(q) && q.type === 'MCQ')) out.push('a check needs at least one MCQ');
			break;
		}
		case 'SUMMARY': {
			const lines = c.summary ?? [];
			if (lines.length < 5 || lines.length > 10) out.push(`summary must be 5 to 10 lines, got ${lines.length}`);
			for (const [i, l] of lines.entries()) if (!isStr(l) || words(l) > 25) out.push(`summary line ${i + 1} is empty or over 25 words`);
			break;
		}
	}
	return out;
}

/** Shape-check and clean what the model returned for one page. Missing fields become empty. */
export function parsePageReply(raw: unknown): { content: PageContent; teacher: TeacherLayer } | null {
	if (!isRecord(raw)) return null;
	const c = isRecord(raw.content) ? raw.content : raw;
	const t = isRecord(raw.teacher) ? raw.teacher : {};
	const dash = (s: string) => s.replace(/[–—]/g, '-').trim();
	const str = (v: unknown) => (typeof v === 'string' ? dash(v) : '');
	const strs = (v: unknown) => (Array.isArray(v) ? v.map(str).filter(Boolean) : []);
	const questions = Array.isArray(c.questions)
		? c.questions.filter(isRecord).map((q): CheckQuestion => {
			const type: CheckQuestionType = (CHECK_QUESTION_TYPES as string[]).includes(String(q.type)) ? q.type as CheckQuestionType : 'SHORT';
			// A model writes "true" as a string and a number as "12" often enough to matter.
			const answer = type === 'TRUE_FALSE'
				? (typeof q.answer === 'boolean' ? q.answer : /^true$/i.test(String(q.answer)) ? true : /^false$/i.test(String(q.answer)) ? false : str(q.answer))
				: type === 'NUMERIC'
					? (typeof q.answer === 'number' ? q.answer : Number.isFinite(Number(String(q.answer).replace(/,/g, ''))) && String(q.answer).trim() !== '' ? Number(String(q.answer).replace(/,/g, '')) : str(q.answer))
					: type === 'MATCH' || type === 'ORDER'
						? ''
						: typeof q.answer === 'number' ? q.answer : Array.isArray(q.answer) ? q.answer.filter((a): a is number => typeof a === 'number') : str(q.answer);
			const pairs = Array.isArray(q.pairs)
				? q.pairs.filter(Array.isArray).map((p) => [str(p[0]), str(p[1])] as [string, string]).filter((p) => p[0] && p[1])
				: undefined;
			// A SELECT with ONE right option out of four is an MCQ the model mislabelled ("Select all
			// number systems that use letters" with only hexadecimal right). The question is fine;
			// only its shape was wrong, so it becomes the MCQ it is instead of a warning on the page.
			const single = type === 'SELECT' && Array.isArray(answer) && answer.length === 1 && Array.isArray(q.options) && strs(q.options).length === 4;
			return {
				type: single ? 'MCQ' : type,
				question: str(q.question),
				...(Array.isArray(q.options) ? { options: strs(q.options) } : {}),
				answer: single ? (answer as number[])[0]! : answer,
				...(Array.isArray(q.accept) && strs(q.accept).length ? { accept: strs(q.accept) } : {}),
				...(typeof q.tolerance === 'number' && q.tolerance >= 0 ? { tolerance: q.tolerance } : {}),
				...(isStr(q.unit) ? { unit: dash(q.unit) } : {}),
				...(pairs ? { pairs } : {}),
				...(Array.isArray(q.items) ? { items: strs(q.items) } : {}),
				...(isStr(q.why) ? { why: dash(q.why) } : {}),
			};
		})
		: undefined;
	// The example: a string, or a shaped one the renderers can draw. Either way the text mirror is kept.
	const layout = parseExampleLayout(c.example);
	const example = layout ? exampleLayoutText(layout) : str(c.example);
	const terms = Array.isArray(c.terms)
		? c.terms.filter(isRecord).map((x) => ({ term: str(x.term), meaning: str(x.meaning) }))
		: undefined;
	const table = isRecord(c.table) && Array.isArray(c.table.columns) && Array.isArray(c.table.rows)
		? { columns: strs(c.table.columns), rows: c.table.rows.filter(Array.isArray).map(strs) }
		: undefined;
	const content: PageContent = {
		lead: str(c.lead),
		points: strs(c.points),
		example,
		...(layout ? { exampleLayout: layout } : {}),
		...(terms ? { terms } : {}),
		...(table ? { table } : {}),
		...(questions ? { questions } : {}),
		...(Array.isArray(c.summary) ? { summary: strs(c.summary) } : {}),
	};
	const teacher: TeacherLayer = {
		say: str(t.say),
		ask: Array.isArray(t.ask) ? t.ask.filter(isRecord).map((a) => ({ question: str(a.question), answer: str(a.answer) })).filter((a) => a.question) : [],
		watchFor: str(t.watchFor),
		board: strs(t.board),
	};
	return { content, teacher };
}

/** A shaped example out of model JSON, or null when it is plain text or malformed. */
export function parseExampleLayout(raw: unknown): ExampleLayout | null {
	if (!isRecord(raw)) return null;
	const dash = (v: unknown) => (typeof v === 'string' ? v.replace(/[\u2013\u2014]/g, '-').trim() : '');
	const strs = (v: unknown) => (Array.isArray(v) ? v.map(dash).filter(Boolean) : []);
	if (raw.kind === 'steps') {
		const steps = strs(raw.steps);
		return steps.length >= 2 ? { kind: 'steps', steps } : null;
	}
	if (raw.kind === 'equations') {
		const lines = strs(raw.lines);
		return lines.length >= 2 ? { kind: 'equations', lines } : null;
	}
	if (raw.kind === 'table') {
		const columns = strs(raw.columns).slice(0, LIMITS.tableCols);
		const rows = Array.isArray(raw.rows) ? raw.rows.filter(Array.isArray).map((r) => columns.map((_, i) => dash(r[i]) || '-')).slice(0, 12) : [];
		return columns.length >= 2 && rows.length >= 1 ? { kind: 'table', columns, rows } : null;
	}
	return null;
}
