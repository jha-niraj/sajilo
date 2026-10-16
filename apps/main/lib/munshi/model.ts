import "server-only"
import { createAnthropic } from "@ai-sdk/anthropic"
import { createOpenAI } from "@ai-sdk/openai"
import type { LanguageModelV1 } from "ai"

export interface MunshiModel {
    model: LanguageModelV1
    id: string
    provider: "anthropic" | "openai" | "sarvam"
}

/**
 * Claude Haiku when ANTHROPIC_API_KEY is set, else GPT when OPENAI_API_KEY is set, else Sarvam's
 * chat model through the AI SDK OpenAI-compatible provider, so Munshi runs on only a Sarvam key.
 * Used by Munshi and by the scan reader.
 */
export function munshiModel(): MunshiModel | null {
    if (process.env.ANTHROPIC_API_KEY) {
        const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
        return { model: anthropic("claude-haiku-5-5"), id: "claude-haiku-5-5", provider: "anthropic" }
    }
    if (process.env.OPENAI_API_KEY) {
        // `strict` makes OpenAI return token usage, which logAiUsage records.
        const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY, compatibility: "strict" })
        return { model: openai("gpt-4o-mini"), id: "gpt-4o-mini", provider: "openai" }
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
        return { model: sarvam("sarvam-105b-conversations"), id: "sarvam-105b-conversations", provider: "sarvam" }
    }
    return null
}
