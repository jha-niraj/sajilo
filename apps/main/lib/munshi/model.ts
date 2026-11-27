import "server-only"
import { createAnthropic } from "@ai-sdk/anthropic"
import { createOpenAI } from "@ai-sdk/openai"
import type { LanguageModelV1 } from "ai"

export interface MunshiModel {
    model: LanguageModelV1
    id: string
    provider: "anthropic" | "openai" | "sarvam"
}

/** Providers whose key was refused (401/403) in this isolate; skipped until the Worker restarts with new secrets. */
const refused = new Set<MunshiModel["provider"]>()

const isKeyRefused = (e: unknown) => {
    const status = (e as { statusCode?: number } | null)?.statusCode
    return status === 401 || status === 403
}

/**
 * Claude Sonnet 5.5 when ANTHROPIC_API_KEY is set, else GPT when OPENAI_API_KEY is set, else Sarvam's
 * chat model through the AI SDK OpenAI-compatible provider, so Munshi runs on only a Sarvam key.
 * A provider that refuses its key falls through to the next one, so one expired key does not take
 * Munshi down while another works. Used by Munshi and by the scan reader.
 */
export function munshiModel(): MunshiModel | null {
    const chain = candidates().filter((m) => !refused.has(m.provider))
    const first = chain[0]
    if (!first || chain.length === 1) return first ?? null
    const next = async <T>(call: (m: MunshiModel) => PromiseLike<T>): Promise<T> => {
        for (const [i, m] of chain.entries()) {
            try {
                return await call(m)
            } catch (e) {
                if (!isKeyRefused(e) || i === chain.length - 1) throw e
                refused.add(m.provider)
                console.error(`[munshi] ${m.provider} refused its API key, trying the next provider`)
            }
        }
        throw new Error("no provider")
    }
    const model: LanguageModelV1 = {
        specificationVersion: "v1",
        provider: first.model.provider,
        modelId: first.model.modelId,
        defaultObjectGenerationMode: first.model.defaultObjectGenerationMode,
        supportsImageUrls: first.model.supportsImageUrls,
        supportsStructuredOutputs: first.model.supportsStructuredOutputs,
        doGenerate: (o) => next((m) => m.model.doGenerate(o)),
        doStream: (o) => next((m) => m.model.doStream(o)),
    }
    return { ...first, model }
}

function candidates(): MunshiModel[] {
    const out: MunshiModel[] = []
    if (process.env.ANTHROPIC_API_KEY) {
        const anthropic = createAnthropic({
            apiKey: process.env.ANTHROPIC_API_KEY,
            // Sonnet 5.5 rejects `temperature`, and AI SDK v4 always sends one (0 when unset); drop it.
            // Effort `low`: Munshi answers short bookkeeping turns that are often spoken, so speed wins.
            fetch: async (input, init) => {
                if (init?.body && typeof init.body === "string") {
                    const body = JSON.parse(init.body) as Record<string, unknown>
                    delete body.temperature
                    body.output_config = { effort: "low" }
                    init = { ...init, body: JSON.stringify(body) }
                }
                return fetch(input, init)
            },
        })
        out.push({ model: anthropic("claude-sonnet-5-5"), id: "claude-sonnet-5-5", provider: "anthropic" })
    }
    if (process.env.OPENAI_API_KEY) {
        // `strict` makes OpenAI return token usage, which logAiUsage records.
        const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY, compatibility: "strict" })
        out.push({ model: openai("gpt-4o-mini"), id: "gpt-4o-mini", provider: "openai" })
    }
    if (process.env.SARVAM_API_KEY) {
        const sarvam = createOpenAI({
            baseURL: "https://api.sarvam.ai/v1",
            apiKey: process.env.SARVAM_API_KEY,
            compatibility: "compatible",
            // Sarvam reasons by default, which adds seconds to every voice reply; switch it off.
            fetch: async (input, init) => {
                if (init?.body && typeof init.body === "string") {
                    const body = JSON.parse(init.body) as Record<string, unknown>
                    init = { ...init, body: JSON.stringify({ ...body, reasoning_effort: null }) }
                }
                return fetch(input, init)
            },
        })
        out.push({ model: sarvam("sarvam-105b-conversations"), id: "sarvam-105b-conversations", provider: "sarvam" })
    }
    return out
}

/** Claude Sonnet 5.5 rejects `temperature` (the fetch above also strips the SDK's default); other models take it. */
export function samplingFor(m: MunshiModel, temperature: number): { temperature?: number } {
    return m.provider === "anthropic" ? {} : { temperature }
}
