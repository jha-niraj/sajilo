/**
 * Minimal OpenAI client over raw fetch - zero bundle cost vs the full SDK.
 *
 * This is the union of the three copies that had drifted apart in apps/main,
 * apps/shishya-main and apps/admin (plus a fourth hand-rolled copy inside the worker's
 * curriculum processor). Lines were byte-identical up to `chatCompletion` and then
 * each app grew a different half: admin had batch embeddings, main had the
 * SSE->ReadableStream proxy, student had the async-generator streamer. All of it
 * lives here now.
 */
import { DEFAULT_CHAT_MODEL, DEFAULT_EMBEDDING_MODEL } from '../models';

const BASE = 'https://api.openai.com/v1';

/**
 * Long enough for a full lesson page with a big prompt, short enough that a teacher is not left
 * looking at a spinner while a dead socket holds their credits.
 */
export const DEFAULT_CHAT_TIMEOUT_MS = 90_000;

function getKey(explicit?: string): string {
	const key = explicit ?? process.env.OPENAI_API_KEY;
	if (!key) throw new Error('OPENAI_API_KEY not set');
	return key;
}

function headers(apiKey?: string): Record<string, string> {
	return { 'Content-Type': 'application/json', Authorization: `Bearer ${getKey(apiKey)}` };
}

export interface ChatMessage {
	role: 'system' | 'user' | 'assistant';
	content: string | Array<{ type: string; text?: string; image_url?: { url: string; detail?: string } }>;
}

export interface ChatOptions {
	model?: string;
	messages: ChatMessage[];
	temperature?: number;
	max_tokens?: number;
	response_format?: { type: 'json_object' | 'text' };
	/** Explicit key for edge/worker runtimes where process.env is not populated. */
	apiKey?: string;
	/**
	 * Milliseconds before the request is abandoned. Defaults to `DEFAULT_CHAT_TIMEOUT_MS`.
	 *
	 * There was no timeout at all, which is not a missing nicety: a lesson plan reserves credits,
	 * calls this, and refunds on failure. A connection that hangs never fails, so the operation
	 * holds its reservation until the platform kills the whole request, and nothing refunds. Pass a
	 * longer one for a genuinely long job; pass `0` to wait forever, which nothing should.
	 */
	timeoutMs?: number;
}

export interface TokenUsage {
	inputTokens: number;
	outputTokens: number;
}

async function postChat(opts: ChatOptions): Promise<{
	choices: { message: { content: string } }[];
	usage?: { prompt_tokens: number; completion_tokens: number };
}> {
	const { apiKey, timeoutMs, ...body } = opts;
	const ms = timeoutMs ?? DEFAULT_CHAT_TIMEOUT_MS;
	let res: Response;
	try {
		res = await fetch(`${BASE}/chat/completions`, {
			method: 'POST',
			headers: headers(apiKey),
			body: JSON.stringify({ model: opts.model ?? DEFAULT_CHAT_MODEL, ...body }),
			...(ms > 0 ? { signal: AbortSignal.timeout(ms) } : {}),
		});
	} catch (e) {
		// A timeout must read as a timeout: the caller refunds on it, and "fetch failed" in a log
		// is what made this look like a network blip for as long as it did.
		if (e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError')) {
			throw new Error(`OpenAI did not answer within ${Math.round(ms / 1000)}s`);
		}
		throw e;
	}
	if (!res.ok) throw new Error(`OpenAI error ${res.status}: ${await res.text()}`);
	return res.json() as Promise<{
		choices: { message: { content: string } }[];
		usage?: { prompt_tokens: number; completion_tokens: number };
	}>;
}

/** Blocking completion. Prefer `chatCompletionWithUsage` so the call can be metered. */
export async function chatCompletion(opts: ChatOptions): Promise<string> {
	const data = await postChat(opts);
	return data.choices[0]?.message?.content ?? '';
}

/**
 * Blocking completion that also returns token counts. Use this over `chatCompletion`
 * wherever the result is logged - the plain variant discards `usage`, which is exactly
 * why the student app's quiz routes were invisible to cost analytics.
 */
export async function chatCompletionWithUsage(opts: ChatOptions): Promise<{ content: string } & TokenUsage> {
	const data = await postChat(opts);
	return {
		content: data.choices[0]?.message?.content ?? '',
		inputTokens: data.usage?.prompt_tokens ?? 0,
		outputTokens: data.usage?.completion_tokens ?? 0,
	};
}

/** Start a streaming completion. Pair with `streamDeltas` or `streamToTextStream`. */
export async function streamChatRequest(opts: ChatOptions): Promise<Response> {
	const { apiKey, ...body } = opts;
	const res = await fetch(`${BASE}/chat/completions`, {
		method: 'POST',
		headers: headers(apiKey),
		body: JSON.stringify({
			model: opts.model ?? DEFAULT_CHAT_MODEL,
			...body,
			stream: true,
			stream_options: { include_usage: true },
		}),
	});
	if (!res.ok) throw new Error(`OpenAI error ${res.status}: ${await res.text()}`);
	return res;
}

/**
 * Async-generator view of an OpenAI SSE stream. Yields `{ delta }` per token and a
 * final `{ delta: '', usage }` when `stream_options.include_usage` was set, so the
 * caller can meter the call without a second request.
 */
export async function* streamDeltas(upstream: Response): AsyncGenerator<{ delta: string; usage?: TokenUsage }> {
	const reader = upstream.body!.getReader();
	const decoder = new TextDecoder();
	let buffer = '';
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		buffer += decoder.decode(value, { stream: true });
		const lines = buffer.split('\n');
		// Keep the trailing partial line - SSE frames split across reader chunks.
		buffer = lines.pop() ?? '';
		for (const line of lines) {
			const trimmed = line.trim();
			if (!trimmed.startsWith('data:')) continue;
			const payload = trimmed.slice(5).trim();
			if (payload === '[DONE]') return;
			try {
				const parsed = JSON.parse(payload) as {
					choices?: { delta?: { content?: string } }[];
					usage?: { prompt_tokens: number; completion_tokens: number };
				};
				const token = parsed.choices?.[0]?.delta?.content;
				if (token) yield { delta: token };
				if (parsed.usage) {
					yield {
						delta: '',
						usage: { inputTokens: parsed.usage.prompt_tokens, outputTokens: parsed.usage.completion_tokens },
					};
				}
			} catch {
				// Ignore partial/!JSON frames - the next chunk completes them.
			}
		}
	}
}

/** Transform an OpenAI SSE response into a plain-text ReadableStream for proxying. */
export function streamToTextStream(upstream: Response): ReadableStream<Uint8Array> {
	const encoder = new TextEncoder();
	return new ReadableStream<Uint8Array>({
		async start(controller) {
			try {
				for await (const { delta } of streamDeltas(upstream)) {
					if (delta) controller.enqueue(encoder.encode(delta));
				}
				controller.close();
			} catch (err) {
				controller.error(err);
			}
		},
	});
}

/** Drain a streaming response to its full text (e.g. to persist it). */
export async function readStreamToText(upstream: Response): Promise<string> {
	let out = '';
	for await (const { delta } of streamDeltas(upstream)) out += delta;
	return out;
}

export async function createEmbedding(text: string, model: string = DEFAULT_EMBEDDING_MODEL, apiKey?: string): Promise<number[]> {
	const [first] = await getBatchEmbeddings([text], model, apiKey);
	return first!;
}

/**
 * Batch embeddings. Results are re-ordered by the API's `index` field before being
 * returned - OpenAI does not guarantee response order matches request order, and the
 * worker's inline copy of this function omitted that guard, so a reordered batch would
 * silently attach every embedding to the wrong chunk.
 */
export async function getBatchEmbeddings(texts: string[], model: string = DEFAULT_EMBEDDING_MODEL, apiKey?: string): Promise<number[][]> {
	if (texts.length === 0) return [];
	const res = await fetch(`${BASE}/embeddings`, {
		method: 'POST',
		headers: headers(apiKey),
		body: JSON.stringify({ model, input: texts.map((t) => t.slice(0, 8000)) }),
	});
	if (!res.ok) throw new Error(`OpenAI embeddings error ${res.status}: ${await res.text()}`);
	const data = (await res.json()) as { data: { embedding: number[]; index: number }[] };
	return data.data.slice().sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

/**
 * Batch embeddings that ALSO returns the token count the provider billed.
 *
 * `getBatchEmbeddings` discards `usage`, which is why every embedding call in the repo
 * was invisible to `ai_usage_logs` - a caller had no honest number to log and estimating
 * from character counts would have poisoned the cost figures. Prefer this variant
 * wherever the call is metered. Embeddings are billed on input only, so `outputTokens`
 * is always 0.
 */
export async function getBatchEmbeddingsWithUsage(
	texts: string[],
	model: string = DEFAULT_EMBEDDING_MODEL,
	apiKey?: string,
): Promise<{ embeddings: number[][] } & TokenUsage> {
	if (texts.length === 0) return { embeddings: [], inputTokens: 0, outputTokens: 0 };
	const res = await fetch(`${BASE}/embeddings`, {
		method: 'POST',
		headers: headers(apiKey),
		body: JSON.stringify({ model, input: texts.map((t) => t.slice(0, 8000)) }),
	});
	if (!res.ok) throw new Error(`OpenAI embeddings error ${res.status}: ${await res.text()}`);
	const data = (await res.json()) as {
		data: { embedding: number[]; index: number }[];
		usage?: { prompt_tokens: number };
	};
	return {
		embeddings: data.data.slice().sort((a, b) => a.index - b.index).map((d) => d.embedding),
		inputTokens: data.usage?.prompt_tokens ?? 0,
		outputTokens: 0,
	};
}
