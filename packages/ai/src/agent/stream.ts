/**
 * The shared agentic streaming runner.
 *
 * Every app's chat route had its own copy of this loop. It owns the parts that are
 * genuinely identical across apps - driving `streamText`, translating AI SDK parts into
 * wire frames, collecting the tool timeline, metering tokens - and owns none of the
 * parts that differ. Tools, system prompt, permissions and persistence stay in the app.
 */
import { streamText, type CoreMessage } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { DEFAULT_CHAT_MODEL } from '../models';
import { logAiUsage, type AiReferenceType, type AiUserType } from '../usage';
import {
	encodeFrame, NDJSON_HEADERS,
	type ChatFrame, type ChatFormSpec, type ChatFormPatch, type ChatLink, type ChatDeckPanel, type ChatDataChange,
	type ChatQuestionSpec, type ChatQuestion, type ChatQuestionOption,
	MAX_QUESTIONS_STEPS, MAX_QUESTIONS_ALL, MAX_PICK_OPTIONS,
	type ChatConfirmSpec, type ChatConfirmGroup, type ChatConfirmItem,
} from '../protocol';

/**
 * The tool name that asks the user a clarifying question.
 *
 * Recognised here BY NAME, which is unusual in this file and deliberate. Every other UI a tool can
 * produce travels in its RESULT (`_form`, `_formPatch`) - but this tool must not have a result at
 * all, so there is nothing to inspect except the call itself.
 *
 * ## Why it must not have a result
 *
 * `streamText` decides whether to run another step with (dist/index.mjs, the `flush` handler):
 *
 *     stepToolCalls.length > 0 && stepToolResults.length === stepToolCalls.length
 *         -> nextStepType = "tool-result"    // i.e. keep going
 *
 * The run only continues when EVERY tool call produced a result. A tool declared with parameters
 * and no `execute` therefore ends the run where it was called. That is exactly what a question
 * needs: the assistant turn stops at the question instead of the model carrying on and answering
 * its own question in the paragraph underneath, which is what happens if you return a placeholder
 * result and try to hold the model back with prompt wording.
 */
export const ASK_USER_TOOL = 'askUser';

/**
 * The tool-set shape `streamText` is generic over. Keeping the generic parameter
 * (rather than widening to this type) is load-bearing: if the tool set is widened, the
 * SDK cannot infer the `tool-call`/`tool-result` members of `fullStream` and narrows
 * them to `never`, so the timeline branches below stop type-checking.
 */
export type AgentToolSet = NonNullable<Parameters<typeof streamText>[0]['tools']>;

/** A tool step as collected for persistence (mirrors chat_messages.metadata.steps). */
export interface AgentStep {
	name: string;
	summary?: string;
	status: 'done' | 'error';
}

/**
 * Validate a tool's `_form` payload before putting it on the wire.
 *
 * A tool result is model-adjacent data, so it is checked rather than cast: a malformed spec
 * should silently not render a form, never crash the stream mid-reply.
 */
function asFormSpec(value: unknown): ChatFormSpec | null {
	if (!value || typeof value !== 'object') return null;
	const v = value as Partial<ChatFormSpec>;
	if (typeof v.action !== 'string' || typeof v.title !== 'string' || !Array.isArray(v.fields)) return null;
	const fields = v.fields.filter(
		(f): f is ChatFormSpec['fields'][number] =>
			!!f && typeof f.name === 'string' && typeof f.label === 'string' && typeof f.type === 'string',
	);
	if (fields.length === 0) return null;
	return { ...v, action: v.action, title: v.title, fields } as ChatFormSpec;
}

/**
 * Validate a tool's `_formPatch` payload before putting it on the wire.
 *
 * Same posture as `asFormSpec`: model-adjacent data is checked, never cast. Non-string
 * values are dropped rather than coerced, because a stray object reaching the client would
 * land in a controlled input's `value` and blank the field.
 */
function asFormPatch(value: unknown): ChatFormPatch | null {
	if (!value || typeof value !== 'object') return null;
	const raw = (value as { values?: unknown }).values;
	if (!raw || typeof raw !== 'object') return null;
	const values: Record<string, string> = {};
	for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
		if (typeof v === 'string') values[k] = v;
	}
	if (Object.keys(values).length === 0) return null;
	// WHICH form the patch targets. More than one can be open, and these forms publish to
	// a whole school - so an unaddressed patch is passed through unaddressed rather than
	// guessed at here, and the client decides whether it is unambiguous enough to apply.
	const formId = (value as { formId?: unknown }).formId;
	return { values, formId: typeof formId === 'string' && formId ? formId : undefined };
}

/**
 * Validate a tool's `_invalidate` - the query-key prefixes its write just made stale.
 *
 * Checked rather than cast, like everything else a tool returns. Accepts a single key
 * (`["school","team"]`) or a list of them, because most writes touch one surface and some touch
 * several.
 */
function asDataChanges(value: unknown): ChatDataChange[] {
	if (!Array.isArray(value) || value.length === 0) return []
	const list = Array.isArray(value[0]) ? (value as unknown[][]) : [value as unknown[]]
	const out: ChatDataChange[] = []
	for (const key of list) {
		if (!Array.isArray(key) || key.length === 0) continue
		const parts = key.filter((k): k is string => typeof k === 'string')
		if (parts.length === key.length) out.push(parts)
	}
	return out
}

/**
 * Validate a tool's `_link`.
 *
 * Same posture as `asFormSpec`: checked, never cast. The one rule worth stating is that the href
 * MUST be app-relative. An absolute URL here would let a tool result - which is model-adjacent
 * data - render a button that navigates the user off the platform, which is a phishing primitive,
 * not a convenience. `//evil.com` is rejected for the same reason: it is protocol-relative and
 * leaves the origin despite starting with a slash.
 */
function asLink(value: unknown): ChatLink | null {
	if (!value || typeof value !== 'object') return null;
	const { href, label } = value as { href?: unknown; label?: unknown };
	if (typeof href !== 'string' || typeof label !== 'string') return null;
	if (!href.startsWith('/') || href.startsWith('//')) return null;
	const trimmedLabel = label.trim();
	if (!trimmedLabel) return null;
	return { href, label: trimmedLabel.slice(0, 60) };
}

/**
 * Validate a tool's `_deck`.
 *
 * `kind` is checked for SHAPE only - a short slug - and the client checks it against the real list
 * of panels, because this package must not know what panels `apps/main` happens to have. An
 * unknown kind renders nothing rather than opening something arbitrary.
 *
 * `select` is passed through opaquely and is never an authorisation: the panel that receives it
 * re-checks it, exactly as `/deck/attendance/<slotId>` re-checks a slot id typed into the address
 * bar.
 */
function asDeckPanel(value: unknown): ChatDeckPanel | null {
	if (!value || typeof value !== 'object') return null;
	const { kind, label, select } = value as { kind?: unknown; label?: unknown; select?: unknown };
	if (typeof kind !== 'string' || !/^[a-z][a-z0-9_-]{0,30}$/.test(kind)) return null;
	if (typeof label !== 'string') return null;
	const trimmedLabel = label.trim();
	if (!trimmedLabel) return null;
	return {
		kind,
		label: trimmedLabel.slice(0, 60),
		...(typeof select === 'string' && select.length > 0 && select.length <= 120
			? { select: select }
			: {}),
	};
}

/**
 * Validate an `askUser` call's arguments before putting them on the wire.
 *
 * Same posture as `asFormSpec`: these are model-authored, so every field is checked rather than
 * cast, and anything malformed yields `null` (no widget) instead of throwing mid-reply.
 *
 * Two rules are enforced here rather than left to the client, because they are correctness rather
 * than presentation:
 *
 *  - **A choice question always keeps its free-text escape hatch** unless the tool explicitly
 *    passes `allowOther: false`. A model that enumerates options will sometimes enumerate the
 *    wrong ones, and a widget with no way out is a dead end.
 *  - **Options are label-only.** Any extra keys the model invents are dropped, so an option can
 *    never carry a payload. Picking one is an answer, never an authorisation - otherwise a
 *    prompt-injected document could render a button that means "yes, delete it".
 */
/**
 * Validate a write tool's `_confirm` - the clickable preview card.
 *
 * Defensive in the same way `asQuestionSpec` is: a malformed group is dropped rather than rendered
 * as an empty box, and a spec with no title is dropped entirely. The consequence of being lax here
 * is a confirmation card the user cannot read properly attached to a real permission grant, so the
 * bar is "render it exactly or not at all".
 *
 * `action` and `title` are the only required fields. A card with no groups is still useful - it is
 * a Confirm button under a summary, which is the whole point for a write that has nothing to tick.
 */
function asConfirmSpec(value: unknown): ChatConfirmSpec | null {
	if (!value || typeof value !== 'object') return null;
	const raw = value as Record<string, unknown>;
	const action = typeof raw.action === 'string' ? raw.action.trim() : '';
	const title = typeof raw.title === 'string' ? raw.title.trim() : '';
	if (!action || !title) return null;

	const groups: ChatConfirmGroup[] = [];
	for (const g of Array.isArray(raw.groups) ? raw.groups : []) {
		if (!g || typeof g !== 'object') continue;
		const gr = g as Record<string, unknown>;
		const label = typeof gr.label === 'string' ? gr.label.trim() : '';
		if (!label) continue;

		const items: ChatConfirmItem[] = [];
		for (const [i, it] of (Array.isArray(gr.items) ? gr.items : []).entries()) {
			if (!it || typeof it !== 'object') continue;
			const item = it as Record<string, unknown>;
			const itemLabel = typeof item.label === 'string' ? item.label.trim() : '';
			if (!itemLabel) continue;
			items.push({
				id: typeof item.id === 'string' && item.id ? item.id : `i${i}`,
				label: itemLabel,
				hint: typeof item.hint === 'string' ? item.hint : undefined,
				// Ticked unless the tool says otherwise: the tool proposed this list, so the
				// default has to be "what was proposed".
				checked: item.checked === false ? false : true,
				risk: item.risk === 'high' ? 'high' : undefined,
				locked: item.locked === true,
			});
		}
		// A group with nothing in it is noise on a card the user has to read carefully.
		if (items.length === 0) continue;
		groups.push({
			label,
			tone: gr.tone === 'add' || gr.tone === 'remove' || gr.tone === 'info' ? gr.tone : 'info',
			// Only selectable when the tool says so. Defaulting to true would let a user untick
			// something the tool has no way to honour.
			selectable: gr.selectable === true,
			items,
		});
	}

	const facts: { label: string; value: string }[] = [];
	for (const f of Array.isArray(raw.facts) ? raw.facts : []) {
		if (!f || typeof f !== 'object') continue;
		const fact = f as Record<string, unknown>;
		if (typeof fact.label === 'string' && typeof fact.value === 'string' && fact.label.trim()) {
			facts.push({ label: fact.label.trim(), value: fact.value });
		}
	}

	return {
		action,
		title,
		summary: typeof raw.summary === 'string' ? raw.summary : undefined,
		facts: facts.length ? facts : undefined,
		groups: groups.length ? groups : undefined,
		confirmLabel: typeof raw.confirmLabel === 'string' ? raw.confirmLabel : undefined,
		danger: raw.danger === true,
		warning: typeof raw.warning === 'string' ? raw.warning : undefined,
	};
}

/** Model-authored options, checked one by one. Extra keys are dropped - see the note above. */
function asQuestionOptions(value: unknown, max: number): ChatQuestionOption[] {
	const options: ChatQuestionOption[] = [];
	const seen = new Set<string>();
	for (const [j, o] of (Array.isArray(value) ? value : []).entries()) {
		if (options.length >= max) break;
		if (!o || typeof o !== 'object') continue;
		const opt = o as { id?: unknown; label?: unknown; hint?: unknown };
		const label = typeof opt.label === 'string' ? opt.label.trim() : '';
		if (!label) continue;
		const id = typeof opt.id === 'string' && opt.id ? opt.id : `o${j}`;
		// A repeated id would make two rows tick together in a picker, which reads as a bug and
		// sends the same record twice. First one wins.
		if (seen.has(id)) continue;
		seen.add(id);
		options.push({ id, label, hint: typeof opt.hint === 'string' ? opt.hint : undefined });
	}
	return options;
}

function asQuestionSpec(value: unknown): ChatQuestionSpec | null {
	if (!value || typeof value !== 'object') return null;
	const rawSpec = value as { questions?: unknown; layout?: unknown };
	const raw = rawSpec.questions;
	if (!Array.isArray(raw)) return null;
	const layout: ChatQuestionSpec['layout'] = rawSpec.layout === 'all' ? 'all' : 'steps';
	// An 'all' card is a small form and gets room for one; a stepped card stays short, because
	// six Next presses is a questionnaire. Extra questions are dropped rather than the card.
	const max = layout === 'all' ? MAX_QUESTIONS_ALL : MAX_QUESTIONS_STEPS;

	const questions: ChatQuestion[] = [];
	for (const [i, item] of raw.entries()) {
		if (questions.length >= max) break;
		if (!item || typeof item !== 'object') continue;
		const q = item as Record<string, unknown>;
		const prompt = typeof q.prompt === 'string' ? q.prompt.trim() : '';
		if (!prompt) continue;

		const fieldRaw = (q.field ?? {}) as Record<string, unknown>;
		// Anything that is not a recognised kind falls back to 'single' - a malformed field should
		// degrade to a usable widget, never drop the question.
		const kind = fieldRaw.kind === 'text' ? 'text'
			: fieldRaw.kind === 'multi' ? 'multi'
			: fieldRaw.kind === 'pick' ? 'pick'
			: fieldRaw.kind === 'select' ? 'select'
			: 'single';

		let field: ChatQuestion['field'];
		if (kind === 'text') {
			field = {
				kind: 'text',
				placeholder: typeof fieldRaw.placeholder === 'string' ? fieldRaw.placeholder : undefined,
				multiline: fieldRaw.multiline === true,
			};
		} else {
			// A picker is a roster, so it may carry far more options than a row list can show.
			const options = asQuestionOptions(fieldRaw.options, kind === 'pick' ? MAX_PICK_OPTIONS : 40);
			// A choice question with nothing to choose from is not a question. Dropped rather than
			// rendered as an empty box the user cannot answer or dismiss.
			if (options.length === 0) continue;
			if (kind === 'pick') {
				field = {
					kind: 'pick',
					mode: fieldRaw.mode === 'multi' ? 'multi' : 'single',
					options,
					// Only meaningful for multi: a single pick with everything selected is no pick.
					preselectAll: fieldRaw.mode === 'multi' && fieldRaw.preselectAll === true,
					searchPlaceholder: typeof fieldRaw.searchPlaceholder === 'string' ? fieldRaw.searchPlaceholder : undefined,
				};
			} else if (kind === 'select') {
				field = {
					kind: 'select',
					options,
					placeholder: typeof fieldRaw.placeholder === 'string' ? fieldRaw.placeholder : undefined,
				};
			} else {
				field = { kind, options };
			}
		}

		questions.push({
			id: typeof q.id === 'string' && q.id ? q.id : `q${i}`,
			prompt,
			hint: typeof q.hint === 'string' ? q.hint : undefined,
			field,
			allowOther: q.allowOther === false ? false : true,
			otherPlaceholder: typeof q.otherPlaceholder === 'string' ? q.otherPlaceholder : undefined,
			optional: q.optional === true,
		});
	}

	if (questions.length === 0) return null;
	// One question has nothing to lay out; keep the spec as small as it was before 'all' existed.
	return questions.length > 1 && layout === 'all' ? { questions, layout } : { questions };
}

/** Coerce a possibly-NaN/undefined token count into a non-negative integer. */
function safeTokens(n: number | undefined | null): number {
	return typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

export interface AgentUsageContext {
	schoolId?: string | null;
	userId?: string | null;
	userType?: AiUserType | null;
	referenceId: string;
	referenceType: AiReferenceType | string;
}

export interface RunAgentStreamOptions<TOOLS extends AgentToolSet = AgentToolSet> {
	system: string;
	messages: CoreMessage[];
	tools: TOOLS;
	/** Defaults to the registry's DEFAULT_CHAT_MODEL so model choice is central. */
	model?: string;
	/** Agentic loop budget. Give tool-heavy turns more headroom. */
	maxSteps?: number;
	/** Explicit key for runtimes where process.env is not populated. */
	apiKey?: string;
	/** Id assigned to the assistant message; echoed in the `done` frame. */
	messageId: string;
	/** Metering context. Omit only for calls that genuinely must not be billed. */
	usage?: AgentUsageContext;
	/**
	 * Charge the finished turn at its real cost (`@repo/billing/ai-meter`). Called once, AFTER the turn
	 * produced an answer, with the tokens of every pass; its result is streamed as a `credit` frame. When
	 * set it REPLACES the plain usage log - the meter writes the one row that carries tokens, cost and
	 * credits together. Never called for a failed, errored or empty turn: the user got nothing.
	 * Lives here as a callback because this package cannot import billing (billing depends on it).
	 */
	meter?: (u: { inputTokens: number; outputTokens: number; model: string }) => Promise<{ credits: number; balance: number | null; status: 'CHARGED' | 'SHORT' | 'FREE'; payer: 'STAFF' | 'POOL' | 'STUDENT' | 'PARENT' | 'NONE' } | null>;
	/**
	 * Persist the finished turn. Receives the full text and the tool timeline.
	 * Called only when text was actually produced.
	 */
	onFinish?: (result: {
		text: string;
		steps: AgentStep[];
		question: ChatQuestionSpec | null;
		/** The confirmation card this turn offered, if any. Persisted so it survives a reload. */
		confirm: ChatConfirmSpec | null;
		/**
		 * The call behind that card, persisted SERVER-SIDE so a press of the card's confirm button can
		 * be committed by the server with exactly what was previewed (F2).
		 */
		confirmCall: AgentConfirmCall | null;
		links: ChatLink[];
		panels: ChatDeckPanel[];
	}) => Promise<void>;
	/** Called when the turn produced nothing, so the caller can roll back its optimistic write. */
	onEmpty?: () => Promise<void>;
	/**
	 * Called when the turn FAILED, with the message the user will see.
	 *
	 * Distinct from `onEmpty`, which means "roll this back so it can be retried". A failure is a
	 * thing that HAPPENED and the record of it has to survive a reload - so a caller that
	 * implements this persists the failure instead of deleting the question that caused it.
	 *
	 * When it is absent the old behaviour stands and `onEmpty` is called, so existing callers are
	 * unchanged.
	 */
	onFailed?: (error: string) => Promise<void>;
	/** Tag used in server-side error logs. */
	logTag?: string;
	/**
	 * The tool names sent to the model on this turn (`experimental_activeTools`). Omit to send every
	 * tool in `tools`. The full set stays registered, so a result for any of them still parses; only
	 * the list the provider SEES is cut - which keeps a principal under OpenAI's 128-tool limit
	 * (plan/main/saathi/school-memory.md, F1).
	 */
	activeTools?: string[];
	/**
	 * A tool with no `execute` the model calls to ask for more modules. Calling it ends the pass;
	 * `expandTools` widens the active set and ONE second pass continues the turn with the call
	 * already answered. Both must be set for this to happen.
	 */
	expandToolName?: string;
	expandTools?: (modules: string[]) => string[];
	/**
	 * A write the SERVER already ran before the model, because the user pressed that card's confirm
	 * button (F2). Shown on the timeline and handled exactly like a tool result (links,
	 * invalidations), then handed to the model as an answered call so the reply describes what
	 * happened instead of trying the write again.
	 */
	preExecuted?: { toolCallId: string; toolName: string; args: unknown; result: unknown };
}

/** The preview call behind a confirmation card - the tool and the arguments it was previewed with. */
export interface AgentConfirmCall {
	tool: string;
	args: unknown;
}

/**
 * Runs the agent and returns a streaming NDJSON `Response`.
 *
 * Consumes `result.fullStream`, NOT `result.textStream`: `textStream` swallows errors,
 * which is how a mid-stream provider rejection used to surface as a silent empty reply.
 */
export function runAgentStream<TOOLS extends AgentToolSet>(opts: RunAgentStreamOptions<TOOLS>): Response {
	const {
		system, messages, tools, model = DEFAULT_CHAT_MODEL, maxSteps = 8,
		apiKey, messageId, usage, meter, onFinish, onEmpty, onFailed, logTag = 'ai/agent',
		activeTools, expandToolName, expandTools, preExecuted,
	} = opts;

	// `compatibility: 'strict'` is REQUIRED for token metering, not a style choice.
	// @ai-sdk/openai only sends `stream_options: { include_usage: true }` when compatibility
	// is strict; the default ('compatible', for third-party OpenAI-ish gateways) omits it,
	// so OpenAI returns NO usage in the stream and every metered row lands as 0/0 tokens.
	// Safe here because we always talk to the real OpenAI API.
	const openai = createOpenAI({
		apiKey: apiKey ?? process.env.OPENAI_API_KEY,
		compatibility: 'strict',
	});

	const stream = new ReadableStream<Uint8Array>({
		async start(controller) {
			const emit = (frame: ChatFrame) => controller.enqueue(encodeFrame(frame));

			/**
			 * End the turn badly, in ONE place, so the two failure paths cannot drift.
			 *
			 * A caller that implements `onFailed` gets the failure PERSISTED and its user message
			 * left alone; one that does not falls back to `onEmpty`, which rolls the user message
			 * back so the turn can be retried. Either way the client is told, and neither is
			 * allowed to throw past this point - a broken rollback must not replace the error the
			 * user needs to see with a different one.
			 */
			const settleFailure = async (message: string) => {
				try {
					if (onFailed) await onFailed(message);
					else await onEmpty?.();
				} catch (e) {
					console.error(`[${logTag}] failure handler threw`, e);
				}
				emit({ type: 'error', error: message });
			};
			// A provider error mid-stream: the turn is not charged, whatever tokens it used (as vidhica).
			let streamErrored = false;
			const steps: AgentStep[] = [];
			// Links a tool offered this turn, in call order. Persisted with the message so the
			// buttons survive a reload the same way the tool timeline does.
			const links: ChatLink[] = [];
			const panels: ChatDeckPanel[] = [];
			let fullText = '';
			// The clarification asked this turn, if any. Handed to `onFinish` so the route can store
			// it on the assistant message - a widget that only ever existed as a wire frame would be
			// gone on reload, and an unanswered question is exactly the thing a user comes back to.
			let question: ChatQuestionSpec | null = null;
		// The confirmation card offered this turn. Only ONE is kept: a turn that previewed two
		// writes would put two Confirm buttons under one message with no defined order, and each
		// press sends a message that commits a different thing.
		let confirm: ChatConfirmSpec | null = null;
		let confirmCall: AgentConfirmCall | null = null;
			// Captured from the stream's own `finish` part. Do NOT rely solely on
			// `await result.usage`: with a multi-step agentic run it can settle as NaN,
			// and `NaN ?? 0` is NaN (?? only catches null/undefined), which silently wrote
			// zero-token rows - a metered call that reports no cost is worse than no row.
			let usageFromStream: { promptTokens: number; completionTokens: number } | null = null;

			/**
			 * Everything a tool result can carry, read in ONE place: the live stream calls it for each
			 * result, and a write the server replayed for a confirm press (F2) goes through it too, so the
			 * card, links and invalidations behave identically either way.
			 */
			const handleToolResult = (part: { toolCallId: string; toolName: string; args: unknown; result: unknown }) => {
				// Only the reserved conventions are read - never the raw result.
				const out = (part.result ?? {}) as Record<string, unknown>;
				const summary = typeof out['_summary'] === 'string' ? (out['_summary'] as string) : undefined;
				const errored = Boolean(out['error']);

				// A tool can ask the USER for structured input by returning `_form`. The spec
				// is streamed to the client, which renders real inputs instead of making the
				// user type a paragraph the model then has to parse back out.
				const formSpec = asFormSpec(out['_form']);
				if (formSpec) {
					emit({ type: 'form', id: part.toolCallId, name: part.toolName, spec: formSpec });
				}

				// A tool can also write INTO the form the user already has open, by
				// returning `_formPatch`. This is what makes "fill this in for me"
				// populate the real inputs rather than the model dumping the values
				// into its prose for the user to copy across by hand.
				// A write tool's preview. Emitted only for a preview - the commit path never
				// returns `_confirm`, so a successful write cannot render a second button
				// offering to do it again.
				const confirmSpec = errored ? null : asConfirmSpec(out['_confirm']);
				if (confirmSpec && !confirm) {
					confirm = confirmSpec;
					confirmCall = { tool: part.toolName, args: part.args };
					emit({ type: 'confirm', id: part.toolCallId, name: part.toolName, spec: confirmSpec });
				}

				const formPatch = asFormPatch(out['_formPatch']);
				if (formPatch) {
					emit({ type: 'form-patch', id: part.toolCallId, name: part.toolName, patch: formPatch });
				}
				// A tool can point the user at the page its work landed on, by returning
				// `_link`. Only on success: offering "View team" after a failed invite
				// sends the user to a page that will not show what was promised.
				// Query keys this write invalidated. Only on success, and BEFORE the link
				// frame so the page is already refreshing by the time the user can click
				// through to it.
				const changes = errored ? [] : asDataChanges(out['_invalidate']);
				if (changes.length) emit({ type: 'data-changed', keys: changes });

				const link = errored ? null : asLink(out['_link']);
				if (link && !links.some((l) => l.href === link.href)) {
					links.push(link);
					emit({ type: 'link', id: part.toolCallId, name: part.toolName, link });
				}

				/*
				 * A panel, for when the answer is a thing you keep open rather than a page
				 * you go to. Same success-only rule as the link above: offering to open a
				 * register after the lookup failed points somebody at an empty panel.
				 *
				 * De-duped on kind+select, not on kind alone - two different classes are
				 * two different offers and both are useful in one reply.
				 */
				const panel = errored ? null : asDeckPanel(out['_deck']);
				if (panel && !panels.some((x) => x.kind === panel.kind && x.select === panel.select)) {
					panels.push(panel);
					emit({ type: 'deck', id: part.toolCallId, name: part.toolName, panel });
				}

				if (errored) {
					console.error(`[${logTag}] tool failed`, { tool: part.toolName, error: out['error'] });
				}
				steps.push({ name: part.toolName, summary, status: errored ? 'error' : 'done' });
				emit({
					type: errored ? 'tool-error' : 'tool-result',
					id: part.toolCallId,
					name: part.toolName,
					summary,
				});
			};

			// Summed across passes. Each pass prefers its own `finish` part and falls back to the promise,
			// both coerced through `safeTokens` because either can yield NaN.
			const usageTotal = { promptTokens: 0, completionTokens: 0 };

			/** One model run. Returns the expansion the model asked for, if it called the expand tool. */
			const runPass = async (passMessages: CoreMessage[], passActive: string[] | undefined, passMaxSteps: number) => {
				const result = streamText({
					model: openai(model),
					system,
					messages: passMessages,
					tools,
					maxSteps: passMaxSteps,
					...(passActive ? { experimental_activeTools: passActive as Array<keyof TOOLS> } : {}),
					onError: ({ error }) => {
						console.error(`[${logTag}] stream error`, error);
					},
				});
				let expand: { toolCallId: string; modules: string[] } | null = null;
				usageFromStream = null;

				for await (const part of result.fullStream) {
					if (part.type === 'text-delta') {
						fullText += part.textDelta;
						emit({ type: 'text-delta', content: part.textDelta });
					} else if (part.type === 'tool-call') {
						// `askUser` is read off the CALL, not a result - it has no `execute`, which is
						// what ends the run here instead of letting the model answer its own question.
						// See the note on ASK_USER_TOOL.
						if (part.toolName === ASK_USER_TOOL) {
							const spec = asQuestionSpec(part.args);
							// At most ONE question widget per turn. A model that can ask will
							// occasionally fire the tool twice in the same step, and two widgets
							// under one message have no defined answering order - the second answer
							// would arrive after the conversation had already moved past the first.
							if (spec && !question) {
								question = spec;
								emit({ type: 'question', id: part.toolCallId, spec });
							}
							// Deliberately no `tool-call` frame: this is not work being done, and
							// showing it in the timeline as a running step leaves a spinner that
							// never resolves (there is no result to resolve it).
							continue;
						}
						// The expand tool has no `execute` either: calling it ends this pass, and the turn
						// continues on a second pass with the modules it named. Not a timeline step.
						if (expandToolName && part.toolName === expandToolName) {
							const raw = (part.args ?? {}) as { modules?: unknown };
							const modules = Array.isArray(raw.modules) ? raw.modules.filter((m): m is string => typeof m === 'string') : [];
							if (!expand) expand = { toolCallId: part.toolCallId, modules };
							continue;
						}
						emit({ type: 'tool-call', id: part.toolCallId, name: part.toolName });
					} else if (part.type === 'tool-result') {
						handleToolResult(part);
					} else if (part.type === 'finish') {
						// Total usage across every step of the agentic run.
						usageFromStream = {
							promptTokens: part.usage?.promptTokens ?? 0,
							completionTokens: part.usage?.completionTokens ?? 0,
						};
					} else if (part.type === 'error') {
						streamErrored = true;
						console.error(`[${logTag}] stream part error`, part.error);
						emit({ type: 'error', error: 'AI response failed. Please try again.' });
					}
				}

				const fallback = usageFromStream ? null : await result.usage.catch(() => null);
				usageTotal.promptTokens += safeTokens(usageFromStream?.promptTokens ?? fallback?.promptTokens);
				usageTotal.completionTokens += safeTokens(usageFromStream?.completionTokens ?? fallback?.completionTokens);

				const responseMessages = expand ? (await result.response).messages : [];
				return { expand, responseMessages };
			};

			try {
				let passMessages: CoreMessage[] = messages;

				// A write the server already committed for a confirm press: on the timeline, through the same
				// result handling, and into the transcript as an answered call.
				if (preExecuted) {
					emit({ type: 'tool-call', id: preExecuted.toolCallId, name: preExecuted.toolName });
					handleToolResult(preExecuted);
					passMessages = [
						...messages,
						{ role: 'assistant', content: [{ type: 'tool-call', toolCallId: preExecuted.toolCallId, toolName: preExecuted.toolName, args: preExecuted.args }] },
						{ role: 'tool', content: [{ type: 'tool-result', toolCallId: preExecuted.toolCallId, toolName: preExecuted.toolName, result: preExecuted.result }] },
					];
				}

				const first = await runPass(passMessages, activeTools, maxSteps);

				// The model asked for modules that were not loaded: ONE second pass, with the call answered and
				// the set widened. Never a third - a loop here would be a runaway bill.
				if (first.expand && expandToolName && expandTools) {
					console.info(`[${logTag}] expanding tools`, { modules: first.expand.modules });
					await runPass([
						...passMessages,
						...first.responseMessages,
						{ role: 'tool', content: [{ type: 'tool-result', toolCallId: first.expand.toolCallId, toolName: expandToolName, result: { loaded: first.expand.modules } }] },
					], expandTools(first.expand.modules), Math.max(3, maxSteps - 1));
				}

				// Meter the call. Awaited so a crash after this point still bills correctly,
				// and never allowed to break the response.
				if (usage && !meter) {
					try {
						// Prefer the `finish` part; fall back to the promise. Both are
						// coerced through `safeTokens` because either can yield NaN.
						const input = usageTotal.promptTokens;
						const output = usageTotal.completionTokens;
						if (input === 0 && output === 0) {
							// Loud, because a silent zero here quietly under-reports spend.
							console.warn(`[${logTag}] no token usage reported by the provider`, {
								referenceType: usage.referenceType, model,
							});
						}
						await logAiUsage({
							schoolId: usage.schoolId,
							referenceId: usage.referenceId,
							referenceType: usage.referenceType,
							inputTokens: input,
							outputTokens: output,
							modelId: model,
							userId: usage.userId,
							userType: usage.userType,
						});
					} catch (err) {
						console.error(`[${logTag}] usage logging failed`, err);
					}
				}

				// A QUESTION COUNTS AS A RESPONSE.
				//
				// The empty check exists to roll back the user's message when the model produced
				// nothing at all, so the turn can be retried. But a turn that asks a clarification
				// and says nothing else has empty `fullText` while being a perfectly good reply -
				// and without this the widget would arrive on screen at the same moment its own
				// user message was deleted underneath it, followed by "No response generated".
				if (!fullText.trim() && !question) {
					await settleFailure('No response generated. Please try again.');
				} else {
					await onFinish?.({ text: fullText, steps, question, confirm, confirmCall, links, panels });
					// Charge the turn, awaited (a charge must never be lost to the response ending), and
					// never allowed to break the answer the user already has.
					if (meter && !streamErrored) {
						try {
							const charged = await meter({ inputTokens: usageTotal.promptTokens, outputTokens: usageTotal.completionTokens, model });
							if (charged) emit({ type: 'credit', credits: charged.credits, balance: charged.balance, status: charged.status, payer: charged.payer });
						} catch (err) {
							console.error(`[${logTag}] metering failed`, err);
						}
					}
					emit({ type: 'done', messageId });
				}
			} catch (err) {
				console.error(`[${logTag}] fatal`, err);
				await settleFailure('AI response failed. Please try again.');
			} finally {
				controller.close();
			}
		},
	});

	return new Response(stream, { headers: NDJSON_HEADERS });
}
