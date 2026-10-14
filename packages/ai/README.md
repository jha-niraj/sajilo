# @repo/ai

Shared AI base for every app in the monorepo. **Scaffold only** - it owns transport,
metering and the SDK workarounds. It deliberately owns **no tools and no prompts**:
those are the product, and they stay in the app that defines them.

## Why it exists

Before this package:

- `openai-fetch.ts` existed in **three** apps (main, student, admin) and had diverged -
  identical for the first 54 lines, then each grew a different half (admin: batch
  embeddings, main: SSE proxy, student: async generator). The worker hand-copied it a
  **fourth** time inline, minus a correctness guard.
- Each app invented its own wire format: main streamed `{type:'text-delta'}`, student
  streamed `{type:'delta'}` - the same idea with incompatible names - and 4+ separate
  client reader loops each re-solved "a frame can split across two chunks".
- `ai_usage_logs` was written by main and student only. Admin, worker and public-api
  logged **nothing**, so Gemini invoice drafts, WhatsApp Claude replies, worker
  embeddings and gpt-4o vision grading were invisible to cost reporting. The staff chat
  itself was unmetered despite having reference types defined for it.
- Cost was hardcoded in the admin UI as a **single blended rate** applied to every row,
  so gpt-4o vision and gemini-flash were priced identically.

## Exports

| Entry | Contents |
|---|---|
| `@repo/ai/models` | Model registry + per-model pricing, `costUsd`, `costNpr`, `DEFAULT_CHAT_MODEL` |
| `@repo/ai/usage` | `logAiUsage` - the single funnel every AI call logs through |
| `@repo/ai/client` | Raw-fetch OpenAI client (chat, streaming, embeddings) - the union of the 3 copies |
| `@repo/ai/protocol` | NDJSON `ChatFrame` vocabulary, `encodeFrame`, `readFrameStream` |
| `@repo/ai/agent` | `makeTool` (Zod 4 shim) and `runAgentStream` (the agentic loop) |

## The Zod 4 trap (`agent/tool.ts`)

`ai@4.x` peers on zod `^3` but this repo runs zod 4. The SDK's zod->JSON-schema
converter only understands zod 3's `._def`, so it silently emits an **empty** schema for
every tool, OpenAI rejects the function definitions mid-stream, and the chat returns
"No response generated" with nothing in the logs.

`makeTool` converts via zod 4's own `z.toJSONSchema` and hands the SDK a prebuilt
`jsonSchema()`. **Always define tools with `makeTool`, never with the SDK's `tool()`
directly.** If you upgrade to AI SDK v5 (native zod 4), `agent/tool.ts` is the one file
to delete.

## Tool result conventions

The raw tool result is **never** streamed to the client. Only two reserved keys are read:

- `_summary: string` - the one-line label shown in the UI timeline
- `error: string` - presence turns the step into a `tool-error` frame

So a tool can query sensitive rows without risking them reaching the browser.

## Adding a chat to a new app

1. Define tools with `makeTool`, scoped to whatever that app's user is allowed to see.
2. Build a system prompt in the app.
3. In the route, call `runAgentStream({ system, messages, tools, messageId, usage, onFinish, onEmpty })`.
4. On the client, read with `readFrameStream` - do not hand-roll a reader loop.

Always pass `usage`, or the call will not appear in cost reporting.

## Maintenance

Pricing in `models.ts` is USD per 1M tokens and **goes stale**. Re-check it when adding a
model or when a provider reprices. `costUsd` returns `isKnown: false` for unregistered
models rather than throwing - surface that instead of quietly reporting an under-count.
