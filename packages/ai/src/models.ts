/**
 * Model registry + pricing.
 *
 * Why this exists: cost was previously hardcoded in the admin UI as a SINGLE blended
 * rate applied to every row regardless of which model produced it - so a gpt-4o vision
 * call and a gemini-flash call were priced identically. Rates belong next to the model
 * ids, in one place, so every surface computes the same number.
 *
 * Rates are USD per 1,000,000 tokens, taken from the providers' public pricing.
 * THEY GO STALE - re-check when you add a model or when a provider repricing lands.
 */

export type Provider = 'openai' | 'anthropic' | 'google';

export interface ModelInfo {
	id: string;
	provider: Provider;
	/** USD per 1M input tokens. */
	inputPerMillion: number;
	/** USD per 1M output tokens. 0 for embedding models. */
	outputPerMillion: number;
	/** Embeddings are billed on input only and cannot be used for chat. */
	kind: 'chat' | 'embedding';
}

export const MODELS = {
	'gpt-4o-mini': { id: 'gpt-4o-mini', provider: 'openai', inputPerMillion: 0.15, outputPerMillion: 0.6, kind: 'chat' },
	'gpt-4o': { id: 'gpt-4o', provider: 'openai', inputPerMillion: 2.5, outputPerMillion: 10, kind: 'chat' },
	'text-embedding-3-small': { id: 'text-embedding-3-small', provider: 'openai', inputPerMillion: 0.02, outputPerMillion: 0, kind: 'embedding' },
	'gemini-2.5-flash': { id: 'gemini-2.5-flash', provider: 'google', inputPerMillion: 0.3, outputPerMillion: 2.5, kind: 'chat' },
	'claude-haiku-4-5-20251001': { id: 'claude-haiku-4-5-20251001', provider: 'anthropic', inputPerMillion: 1, outputPerMillion: 5, kind: 'chat' },
	// Prompts up to 100k tokens; longer prompts cost $0.50 / $2.50 (Munshi's never come close).
	'claude-haiku-5-5': { id: 'claude-haiku-5-5', provider: 'anthropic', inputPerMillion: 0.1, outputPerMillion: 0.5, kind: 'chat' },
	'claude-sonnet-5-5': { id: 'claude-sonnet-5-5', provider: 'anthropic', inputPerMillion: 2, outputPerMillion: 10, kind: 'chat' },
	'claude-sonnet-4-6': { id: 'claude-sonnet-4-6', provider: 'anthropic', inputPerMillion: 3, outputPerMillion: 15, kind: 'chat' },
} as const satisfies Record<string, ModelInfo>;

export type ModelId = keyof typeof MODELS;

/** Default chat model for every app. Change here, not at each call site. */
export const DEFAULT_CHAT_MODEL: ModelId = 'gpt-4o-mini';
/** Default embedding model. Must match the pgvector column dimensions (1536). */
export const DEFAULT_EMBEDDING_MODEL: ModelId = 'text-embedding-3-small';

/** Look up a model, tolerating ids that are not in the registry yet. */
export function getModel(modelId: string): ModelInfo | undefined {
	return (MODELS as Record<string, ModelInfo>)[modelId];
}

/**
 * USD cost of a call. Unknown models cost 0 rather than throwing - a pricing gap must
 * never break a request - but callers showing money should surface `isKnown: false`
 * instead of quietly reporting an under-count.
 */
export function costUsd(modelId: string, inputTokens: number, outputTokens: number): { usd: number; isKnown: boolean } {
	const model = getModel(modelId);
	if (!model) return { usd: 0, isKnown: false };
	const usd =
		(Math.max(0, inputTokens) / 1_000_000) * model.inputPerMillion +
		(Math.max(0, outputTokens) / 1_000_000) * model.outputPerMillion;
	return { usd, isKnown: true };
}

/** Display rate for NPR surfaces. Override per deployment if you track FX. */
export const USD_TO_NPR = 133;

export function costNpr(modelId: string, inputTokens: number, outputTokens: number): { npr: number; isKnown: boolean } {
	const { usd, isKnown } = costUsd(modelId, inputTokens, outputTokens);
	return { npr: usd * USD_TO_NPR, isKnown };
}
