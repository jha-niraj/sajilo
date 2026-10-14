/**
 * The wire contract between an AI chat route and its client.
 *
 * Previously every app invented its own: main emitted NDJSON `{type:'text-delta'}`,
 * student emitted SSE `{type:'delta'}` - same idea, gratuitously incompatible names -
 * and at least four independent reader loops re-solved "a frame can be split across
 * two reader chunks". One vocabulary, one encoder, one parser.
 *
 * Transport is NDJSON (one JSON object per line), not SSE: it is simpler to frame,
 * has no `data:` prefix to strip, and survives proxies that coalesce chunks.
 */

/** A tool invocation as surfaced to the UI. Never carries raw args or raw results. */
export interface ToolStepFrame {
	id: string;
	name: string;
	/** Human-readable one-liner a tool opts into by returning `_summary`. */
	summary?: string;
}

/**
 * A form the assistant asks the user to fill in.
 *
 * The model proposes values it already inferred from the conversation; the user corrects
 * them in real inputs and submits. That is strictly better than the model interrogating
 * the user field-by-field in prose and re-parsing free text - especially for a write
 * action, where the form doubles as the confirmation step.
 */
export interface ChatFormField {
	name: string;
	label: string;
	/**
	 * `richtext` renders a WYSIWYG editor whose value is sanitised HTML. Use it for prose
	 * fields whose destination column already stores HTML - never for a column rendered as
	 * plain text, which would leak tags into the UI.
	 */
	type: 'text' | 'textarea' | 'richtext' | 'select' | 'date';
	required?: boolean;
	/** Model-proposed value. The user can always change it. */
	value?: string;
	placeholder?: string;
	/** For type 'select'. */
	options?: { value: string; label: string }[];
}

export interface ChatFormSpec {
	/** Identifies which action the filled form should run. */
	action: string;
	title: string;
	description?: string;
	submitLabel?: string;
	fields: ChatFormField[];
}

/**
 * A partial update to the form that is ALREADY open, keyed by field name.
 *
 * This exists so "fill this in for me" writes into the real inputs instead of the model
 * pasting the values into its reply, where the user would have to copy them across by hand.
 * Only the named fields change; anything the user already typed into a field the model did
 * not mention is left exactly as it is.
 */
export interface ChatFormPatch {
	/**
	 * WHICH open form to write into.
	 *
	 * Required now that more than one form can be on screen at once. Without a target the
	 * model would fill whichever form the client happened to consider current - and these
	 * forms carry buttons that publish to a whole school, so guessing is not acceptable.
	 * Omitted only by callers that predate multi-form; the client falls back to the single
	 * open form and ignores the patch when there is any ambiguity.
	 */
	formId?: string;
	values: Record<string, string>;
}

/**
 * A clarification the assistant asks mid-conversation.
 *
 * ## Why this is NOT a `ChatFormSpec`
 *
 * They look alike and they are opposites at the only point that matters: what happens on submit.
 *
 * A FORM's submit runs `spec.action` as a server action - it performs the write, and the
 * conversation does not continue. The model never learns what was in it.
 *
 * A QUESTION's answer is turned into an ordinary `role: 'user'` message and sent back through the
 * normal chat endpoint, exactly as if the user had typed it. That is the whole point, and it is
 * what makes the answer real: it lands in `chat_messages`, so it survives a reload, it is inside
 * the history window the next turn reads, and the model can ask a follow-up that depends on it.
 * An answer held anywhere else is invisible to all three.
 *
 * So: same rendering layer, opposite tails. Do not merge them.
 */
export interface ChatQuestionOption {
	/** Stable id, echoed back in the answer. Never carries an action - see the note below. */
	id: string;
	label: string;
	/** One short clarifying line under the label. */
	hint?: string;
}

export type ChatQuestionField =
	/** Pick exactly one. */
	| { kind: 'single'; options: ChatQuestionOption[] }
	/**
	 * Pick any number, including none.
	 *
	 * Added for questions where the options are not alternatives but a SET to assemble - "which
	 * areas should this role cover?" is the case that forced it. Offered as `single`, the model
	 * either asks the same question five times or silently picks one area and invents the rest,
	 * which is the guessing the question existed to stop.
	 *
	 * The answer shape needed nothing: `ChatQuestionAnswer.optionIds` was always an array.
	 */
	| { kind: 'multi'; options: ChatQuestionOption[] }
	/** Free text only - no options. */
	| { kind: 'text'; placeholder?: string; multiline?: boolean }
	/**
	 * A RECORD picker: a search box over a height-capped list - students of a class, staff, bills.
	 *
	 * Added for "report for 8A" (plan/main/ai-saathi/report-generation-flow.md). `single` and `multi`
	 * render every option as a numbered row, which is right for five readings of a request and
	 * wrong for thirty-two children: the card grows taller than the panel and nobody can find Sita
	 * in it. A picker is the same answer shape (`optionIds`) with a search box and a scroll.
	 *
	 * `preselectAll` ticks everything on open, because "the whole class, minus two" is the common
	 * case for a multi pick and unticking two is faster than ticking thirty. The ids travel back in
	 * the answer AND in the readable message, because the tool that acts on the pick needs ids, not
	 * names that repeat inside a class.
	 */
	| {
		kind: 'pick';
		mode: 'single' | 'multi';
		options: ChatQuestionOption[];
		preselectAll?: boolean;
		searchPlaceholder?: string;
	}
	/**
	 * A dropdown - one value from a list that would be noise as rows (twelve report types, five
	 * academic years). Same answer shape as `single`; only the presentation is compact, which is
	 * what lets several of them sit on one 'all' card.
	 */
	| { kind: 'select'; options: ChatQuestionOption[]; placeholder?: string };

export interface ChatQuestion {
	id: string;
	/** The question itself. Shown as the widget's heading. */
	prompt: string;
	/** Optional second line - why the answer matters, what it changes. */
	hint?: string;
	field: ChatQuestionField;
	/**
	 * The free-text escape hatch under the options.
	 *
	 * Defaults to ON for choice questions and it should almost never be turned off. A model that
	 * has to enumerate the options will sometimes enumerate the wrong ones, and without a way out
	 * the widget is a dead end the user has to fight - the opposite of the point. Ignored for
	 * `kind: 'text'`, which is already free text.
	 */
	allowOther?: boolean;
	otherPlaceholder?: string;
	/** Whether a Skip control is offered. */
	optional?: boolean;
}

export interface ChatQuestionSpec {
	questions: ChatQuestion[];
	/**
	 * `steps` (the default): one question at a time with Next, as before.
	 * `all`: every question on ONE screen with one Send - a small form. Niraj: "ask everything
	 * missing in one go". Three missing details asked as three Next presses is three chances to
	 * abandon the flow, and the person cannot see what is coming; on one card they fill it top to
	 * bottom and send once.
	 */
	layout?: 'steps' | 'all';
}

/** Most questions one card may carry. `all` is a form, so it gets room for one; `steps` stays short. */
export const MAX_QUESTIONS_STEPS = 3;
export const MAX_QUESTIONS_ALL = 6;
/** A picker over a roster. Past this the list is a screen's job, not a card's. */
export const MAX_PICK_OPTIONS = 300;

/** One answered question, as stored on the user message that carried it. */
export interface ChatQuestionAnswer {
	questionId: string;
	/** Chosen option ids. Empty when the user typed instead of picking, or skipped. */
	optionIds: string[];
	/** Free text from the "something else" box, or a `text` question's value. */
	text?: string;
	skipped?: boolean;
}

/**
 * A "go and look at it" link the assistant offers after doing something.
 *
 * A write tool changes state on a page the user is usually not looking at - an invite sent from
 * the Saathi panel lands on `/administration/team`, which may be three clicks away. The tool that
 * did the work is the only thing that reliably knows where the result now lives, so it names the
 * destination itself by returning `_link`; the model is never asked to construct a URL, because a
 * plausible-looking wrong route is exactly what a language model produces.
 *
 * Rendered as a button under the reply, never as a bare URL in the prose.
 */
/**
 * A write the assistant is about to make, rendered as something the user CLICKS rather than
 * something they have to type "yes" to.
 *
 * ## Why this is a third thing, next to `ChatFormSpec` and `ChatQuestionSpec`
 *
 * It shares the question's TAIL and the form's SHAPE, and it is neither.
 *
 *  - Like a QUESTION, pressing Confirm produces an ordinary `role: 'user'` message and the
 *    conversation continues. That is what keeps the whole safety model intact: the model calls the
 *    write tool again with `confirm=true`, so `claimWriteSlot` still holds, the permission guards
 *    inside the tool and inside the server action still run, and `originPrompt` still records why.
 *  - UNLIKE a FORM, it must NOT run a server action on submit. A form's submit performs the write
 *    directly and the conversation ends - which would bypass the write slot, leave the model
 *    unaware anything happened, and lose the audit trail. That is the one thing this must never
 *    become.
 *
 * So the card is a better INPUT SURFACE for a protocol that already exists. The system prompt's
 * two-step rule is unchanged, and its worked example ("yes, but remove billing:view" -> commit the
 * reduced list immediately, do not re-preview) is exactly what a ticked-off item produces.
 *
 * ## The tool supplies the items, never the model
 *
 * `_confirm` is built inside the tool from the same values its `plan` reports, so the list on
 * screen cannot disagree with the list that will be written. A model asked to enumerate twenty
 * permission keys into a widget would occasionally enumerate nineteen.
 */
export interface ChatConfirmItem {
	/** Stable key echoed back in the message - a permission key, a student id. */
	id: string;
	label: string;
	/** One short line: what this permission allows, which class this student is in. */
	hint?: string;
	/** Ticked when the card opens. The model proposed it; the user may untick. */
	checked?: boolean;
	/** Rendered with a warning treatment - lets the holder change the school, spend its money, or change other people's access. */
	risk?: 'high';
	/**
	 * Cannot be unticked.
	 *
	 * For the two permissions force-added to every role: showing them is honest, offering to
	 * remove them is a lie, because `normalizeRolePermissions` puts them back.
	 */
	locked?: boolean;
}

export interface ChatConfirmGroup {
	/** "Permissions to grant", "Being removed", "Families to email". */
	label: string;
	/** Colouring only. `remove` is the group a user must not skim past. */
	tone?: 'add' | 'remove' | 'info';
	/** Whether items in this group can be unticked before confirming. */
	selectable?: boolean;
	items: ChatConfirmItem[];
}

export interface ChatConfirmSpec {
	/** The tool this confirms. Echoed into the message so the model knows what was approved. */
	action: string;
	title: string;
	/** One line of plain language under the title. */
	summary?: string;
	/** Untickable context - "Held by 4 people", "Class 10 B", "38 families". */
	facts?: { label: string; value: string }[];
	/**
	 * Fields the user may CHANGE before confirming.
	 *
	 * `facts` state what will happen; these let the reader correct it without retyping the whole
	 * request. "10 questions" is the commonest thing somebody wants to nudge, and making them
	 * cancel and re-ask to change one number is the kind of friction that stops a tool being used.
	 *
	 * Changed values are named in the confirmation message, so the model re-runs the tool with
	 * them rather than with what it originally proposed.
	 */
	edits?: {
		id: string;
		label: string;
		value: string;
		type?: 'text' | 'number';
		min?: number;
		max?: number;
	}[];
	groups?: ChatConfirmGroup[];
	confirmLabel?: string;
	/** Destructive styling on the confirm button, for permanent or irreversible writes. */
	danger?: boolean;
	/** A sentence shown above the buttons, in a warning tone. */
	warning?: string;
}

/** What the user decided, stored on the user message that carried it. */
export interface ChatConfirmDecision {
	action: string;
	confirmed: boolean;
	/** Items the user unticked before confirming, by group label. */
	removed?: { group: string; ids: string[] }[];
	/** Fields the user changed before confirming, by field id. */
	edited?: { id: string; value: string }[];
}

/**
 * Open a panel on the workbench (`/deck`), instead of navigating to a page.
 *
 * ## Why this exists alongside `ChatLink`
 *
 * A link takes you AWAY. For a job you do dozens of times a day - marking a register - being sent
 * to a page and having to come back is the cost the Deck was built to remove. `_deck` says "the
 * thing you asked for is a panel, and here it is", and the panel opens next to the chat that
 * suggested it.
 *
 * ## It renders as a BUTTON, and never as an action
 *
 * The rule from the Saathi section of the root CLAUDE.md applies exactly here: *"Pressing a card
 * button sends a MESSAGE. It must never perform the write itself"*, and a confirmation card *"must
 * NEVER disable the composer"*. A chat that silently rearranged somebody's workbench because of a
 * sentence they typed would break both. The person presses; the panel opens.
 *
 * ## The permission is the TOOL'S, not this frame's
 *
 * By the time a `_deck` reaches the wire the tool has already run `resolveEffectivePermissions` on
 * the server. This carries no authority - a panel it named that the person cannot use would open
 * onto a refusal, which is the dead end the CLAUDE.md forbids. Tools return `_link` with a route
 * instead when the answer is "not you".
 */
export interface ChatDeckPanel {
	/** Matches `WorkbenchWindow['kind']`. Validated against a list on the client, never trusted. */
	kind: string;
	/** Button text. Short and concrete: "Open the register", not "Click here". */
	label: string;
	/**
	 * Pre-select something inside the panel - a slot id, a class id. Opaque to the protocol and
	 * meaningful only to the panel that receives it, which re-authorises it anyway.
	 */
	select?: string;
}

export interface ChatLink {
	/** App-relative path, always starting with `/`. Absolute URLs are rejected by the reader. */
	href: string;
	/** Button text. Short and concrete: "View team", not "Click here". */
	label: string;
}

/**
 * Query keys a tool's write has just invalidated.
 *
 * ## Why the agent has to say this out loud
 *
 * The chat panel floats over every page in the app. A tool that creates a school role calls a
 * server action that calls `revalidatePath` - which invalidates the SERVER cache and says nothing
 * to a client component that is already mounted. So the user watched Saathi report "role created"
 * while the list beside it still showed the old five, and the only fix was a hard refresh.
 *
 * The tool is the only thing that knows what it changed, so it names the keys and the client
 * invalidates them. Prefixes, matched the way TanStack Query matches them: `["school"]` clears
 * every school-scoped query, `["school","team"]` only the team page's.
 */
export type ChatDataChange = string[]

export type ChatFrame =
	| { type: 'text-delta'; content: string }
	| { type: 'tool-call'; id: string; name: string }
	| { type: 'tool-result'; id: string; name: string; summary?: string }
	| { type: 'tool-error'; id: string; name: string; summary?: string }
	/** Emitted when a tool needs the user to fill something in before it can run. */
	| { type: 'form'; id: string; name: string; spec: ChatFormSpec }
	/** Emitted when a tool writes values INTO the form the user already has open. */
	| { type: 'form-patch'; id: string; name: string; patch: ChatFormPatch }
	/**
	 * Emitted when the assistant needs a clarification before it can continue.
	 *
	 * Always the LAST frame before `done`: the tool that produces it has no `execute`, so the SDK
	 * run ends at the question rather than carrying on and answering it on the user's behalf.
	 */
	| { type: 'question'; id: string; spec: ChatQuestionSpec }
	/**
	 * Emitted when a write tool returns a preview. Renders as a card with the plan on it and a
	 * Confirm button, instead of asking the user to type "yes" at a markdown table.
	 *
	 * Unlike `form`, pressing Confirm sends a MESSAGE - it never runs the write itself.
	 */
	| { type: 'confirm'; id: string; name: string; spec: ChatConfirmSpec }
	/** Emitted when a tool wants to point the user at the page its work landed on. */
	| { type: 'link'; id: string; name: string; link: ChatLink }
	/** Emitted when the answer is a workbench panel rather than a page. See `ChatDeckPanel`. */
	| { type: 'deck'; id: string; name: string; panel: ChatDeckPanel }
	/** Emitted after a write so the page underneath the panel refreshes itself. */
	| { type: 'data-changed'; keys: ChatDataChange[] }
	/**
	 * What the turn cost (AI credit metering, 2026-10-10): the credits charged at real cost and the
	 * payer's balance after. Sent just before `done`, only when the turn produced an answer. `balance` is
	 * null when nobody's balance paid (platform work).
	 */
	| { type: 'credit'; credits: number; balance: number | null; status: 'CHARGED' | 'SHORT' | 'FREE'; payer: 'STAFF' | 'POOL' | 'STUDENT' | 'PARENT' | 'NONE' }
	| { type: 'done'; messageId: string }
	| { type: 'error'; error: string };

export const NDJSON_HEADERS: Record<string, string> = {
	'Content-Type': 'application/x-ndjson; charset=utf-8',
	'Cache-Control': 'no-cache, no-transform',
	Connection: 'keep-alive',
};

/** Encode one frame for the wire. */
export function encodeFrame(frame: ChatFrame): Uint8Array {
	return new TextEncoder().encode(JSON.stringify(frame) + '\n');
}

/**
 * Incremental NDJSON parser. Feed it decoded chunks; it returns the frames that are
 * complete and retains any trailing partial line for the next call.
 *
 * The retained-tail behaviour is the whole point - a naive `split('\n')` per chunk
 * drops the frame that straddles a chunk boundary, which shows up as randomly missing
 * tokens under load and is near-impossible to reproduce locally.
 */
export function createFrameParser(): { push: (chunk: string) => ChatFrame[] } {
	let buffer = '';
	return {
		push(chunk: string): ChatFrame[] {
			buffer += chunk;
			const lines = buffer.split('\n');
			buffer = lines.pop() ?? '';
			const frames: ChatFrame[] = [];
			for (const line of lines) {
				const trimmed = line.trim();
				if (!trimmed) continue;
				try {
					frames.push(JSON.parse(trimmed) as ChatFrame);
				} catch {
					// Malformed line - skip it rather than killing the stream.
				}
			}
			return frames;
		},
	};
}

/**
 * Read a streaming `fetch` response and invoke `onFrame` per frame.
 * Shared by every chat client so the reader loop exists exactly once.
 */
export async function readFrameStream(res: Response, onFrame: (frame: ChatFrame) => void): Promise<void> {
	if (!res.body) throw new Error('Response has no body');
	const reader = res.body.getReader();
	const decoder = new TextDecoder();
	const parser = createFrameParser();
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		for (const frame of parser.push(decoder.decode(value, { stream: true }))) onFrame(frame);
	}
}
