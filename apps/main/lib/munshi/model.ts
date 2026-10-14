import "server-only"
import { createOpenAI } from "@ai-sdk/openai"
import type { LanguageModelV1 } from "ai"

export interface MunshiModel {
    model: LanguageModelV1
    id: string
    provider: "openai" | "sarvam"
}

/**
 * GPT when OPENAI_API_KEY is set; otherwise Sarvam's chat model through the same AI SDK
 * OpenAI-compatible provider, so Munshi runs on only a Sarvam key.
 */
export function munshiModel(): MunshiModel | null {
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
