import "server-only"
import { generateText, streamText, type CoreMessage } from "ai"
import { logAiUsage } from "@repo/ai/usage"
import { adToBs, adDayOfWeek, formatBs, WEEKDAYS_EN } from "@repo/calendar"
import { munshiModel, samplingFor } from "./model"
import { claimProposal, releaseProposal } from "./commit-claim"
import { buildTools, capabilityList, WRITE_DEFS } from "./agenttools"
import { knownNames } from "./agenttools/resolve"
import type { MunshiToolContext } from "./agenttools/types"
import type { MunshiMessage, MunshiStreamFrame, Proposal, ProposalKind } from "./types"
import { replyLanguage, replyLanguageRule } from "./reply-language"

const MAX_STEPS = 5
const HISTORY_LIMIT = 16

function systemPrompt(o: {
    today: string
    lang: "ne" | "en"
    userName: string
    voice: boolean
    names: { customers: string[]; borrowers: string[] }
    waiting: Proposal[]
}): string {
    const b = adToBs(o.today)
    const waiting = o.waiting.length
        ? `\nWAITING FOR HIS CONFIRMATION (cards on screen):\n${o.waiting
              .map((p) => `- ${p.title} -> on yes call ${p.call.tool}(${JSON.stringify({ ...p.call.args, confirm: true })})`)
              .join("\n")}\nIf he says yes/हो/ठिक छ/गर, make exactly that call. If he says no/होइन, just acknowledge; nothing was saved.`
        : ""
    return `You are Munshi (मुन्शी), the warm, sharp bookkeeper inside Sajilo, used by ${o.userName || "a"} bank daily-savings collector in Nepal.
He collects daily savings from shops on a fixed route, and sometimes lends money at "Rs X per 100 per month" (सयकडा मासिक).
Today is ${WEEKDAYS_EN[adDayOfWeek(o.today)]}, ${formatBs(b, "en")} BS (${b.year}-${b.month}-${b.day}).

LANGUAGE: Match HIS LAST MESSAGE. If it is English words, reply in simple English. If it is Nepali in Devanagari, reply in simple, warm Nepali (Devanagari). If it is Nepali typed in English letters (like "kati baki cha"), reply the same way, in Roman Nepali. App language: ${o.lang === "ne" ? "Nepali" : "English"}.
STYLE: ${o.voice ? "VOICE reply: 1-3 short spoken sentences. No lists, no symbols, no markdown. Say amounts in words (e.g. 'दुई हजार एक सय रुपैयाँ' / 'two thousand one hundred rupees')." : "Chat reply: at most 4 short lines of plain text. No markdown at all: no **, no #, no tables. Write amounts like Rs 2,100 / रु २,१००."}

YOU CAN:
${capabilityList()}

RULES:
- Never guess numbers. Read them with tools.
- Use names exactly as listed below. Map spoken or Nepali-script names to the closest listed one ("राम किराना" -> "Ram Kirana"). On not_found, ask which one using did_you_mean.
- Every change is two steps: call the tool with confirm=false first (a Confirm card appears). NOTHING is saved yet, so never say it is done/marked/saved; say you have prepared it and ask him to confirm (e.g. "I've prepared Sita Store: Rs 500 for today. Shall I save it?"). Only after he clearly says yes, call it again with confirm=true and the same arguments. One change per message.
- Lines like [card "...": saved] under your earlier replies say what happened to that Confirm card. A saved or cancelled card is finished: never redo it, never mention it again unless he asks.
- If asked about something outside his collection and lending, answer briefly and kindly.

Customers (route order): ${o.names.customers.join(", ") || "(none yet)"}
Borrowers: ${o.names.borrowers.join(", ") || "(none yet)"}${waiting}`
}

export interface MunshiRun {
    collectorId: string
    today: string
    lang: "ne" | "en"
    userName: string
    history: MunshiMessage[]
    text: string
    pending: Proposal[]
    voice: boolean
}

export interface MunshiRunResult {
    reply: string
    proposals: Proposal[]
    resolved: { id: string; status: Proposal["status"] }[]
}

const samePayload = (a: Record<string, unknown>, b: Record<string, unknown>) =>
    JSON.stringify(a, Object.keys(a).sort()) === JSON.stringify(b, Object.keys(b).sort())

/** Everything one turn needs, shared by the full-reply (voice) and streaming (chat) paths. */
async function prepareTurn(run: MunshiRun) {
    const m = munshiModel()
    if (!m) throw new Error("NO_LLM")

    const waiting = run.pending.filter((p) => p.status === "pending")
    let proposals: Proposal[] = []
    const resolved: MunshiRunResult["resolved"] = []
    let committed: string | null = null

    const close = (p: Proposal, status: Proposal["status"]) => {
        p.status = status
        if (waiting.includes(p)) resolved.push({ id: p.id, status })
    }

    const ctx: MunshiToolContext = {
        collectorId: run.collectorId,
        today: run.today,
        lang: run.lang,
        propose: (p) => {
            const full: Proposal = { ...p, id: crypto.randomUUID(), status: "pending" }
            proposals.push(full)
            return full
        },
        commit: async (kind: ProposalKind, payload, save) => {
            const isOpen = (p: Proposal) => p.kind === kind && p.status === "pending"
            const onScreen = waiting.filter(isOpen)
            const madeNow = proposals.filter(isOpen)
            // The card he is saying yes to. A card already on screen wins over one the model made again
            // this turn (even with a changed detail), or that screen card would stay open to be tapped.
            const target =
                onScreen.filter((p) => samePayload(p.payload, payload)).at(-1) ??
                onScreen.at(-1) ??
                madeNow.filter((p) => samePayload(p.payload, payload)).at(-1) ??
                madeNow.at(-1)
            const claimId = target?.id ?? crypto.randomUUID()
            if (!(await claimProposal(claimId, run.collectorId, kind))) {
                if (target) close(target, "done")
                return { ok: true, message: "already saved earlier; nothing new was saved" }
            }
            const res = await save().catch(() => ({ ok: false, message: "could not save" }))
            if (!res.ok) await releaseProposal(claimId).catch(() => {})
            if (target) close(target, res.ok ? "done" : "failed")
            if (res.ok) {
                // Cards of this kind made again in this same turn are re-proposals of what was just saved.
                for (const p of waiting) if (p.kind === kind && p.status === "pending" && samePayload(p.payload, payload)) close(p, "done")
                proposals = proposals.filter((p) => p === target || !(p.kind === kind && p.status === "pending"))
            }
            return res
        },
        claimWriteSlot: (toolName) => {
            if (committed) return { error: "Only one change per message. Ask him to confirm the next one separately.", alreadyCommitted: committed }
            committed = toolName
            return null
        },
    }

    const names = await knownNames(ctx)
    const messages: CoreMessage[] = [
        ...run.history.slice(-HISTORY_LIMIT).map((h) => ({ role: h.role, content: h.content }) as CoreMessage),
        { role: "user", content: run.text },
    ]

    const options = {
        model: m.model,
        system:
            systemPrompt({ today: run.today, lang: run.lang, userName: run.userName, voice: run.voice, names, waiting }) +
            replyLanguageRule(replyLanguage(run.text), run.voice),
        messages,
        tools: buildTools(ctx),
        maxSteps: MAX_STEPS,
        ...samplingFor(m, 0.3),
        abortSignal: AbortSignal.timeout(50_000),
    }

    const finish = (reply: string, usage: { promptTokens?: number; completionTokens?: number } | undefined): MunshiRunResult => {
        void logAiUsage({
            referenceId: crypto.randomUUID(),
            referenceType: run.voice ? "MUNSHI_VOICE" : "MUNSHI_CHAT",
            modelId: m.id,
            inputTokens: usage?.promptTokens ?? 0,
            outputTokens: usage?.completionTokens ?? 0,
            userId: run.collectorId,
        })
        // A card he never confirmed in this turn that the model replaced with a newer one of the same kind is stale.
        const fresh = proposals.filter((p, i) => p.status !== "pending" || !proposals.slice(i + 1).some((q) => q.kind === p.kind && q.status === "pending"))
        return { reply: reply.trim(), proposals: fresh, resolved }
    }

    return { options, finish }
}

/** One turn, whole reply at once (voice: the reply is spoken, so it is needed in full). */
export async function runMunshi(run: MunshiRun): Promise<MunshiRunResult> {
    const { options, finish } = await prepareTurn(run)
    const result = await generateText(options)
    return finish(result.text, result.usage)
}

/**
 * One turn as NDJSON frames: `text` deltas while the model writes, then one `done` with the cards
 * (or `error`). Text from steps on either side of a tool call is kept apart with a blank line.
 */
export async function streamMunshi(run: MunshiRun): Promise<ReadableStream<Uint8Array>> {
    const { options, finish } = await prepareTurn(run)
    const enc = new TextEncoder()
    return new ReadableStream<Uint8Array>({
        async start(controller) {
            const send = (f: MunshiStreamFrame) => controller.enqueue(enc.encode(JSON.stringify(f) + "\n"))
            let text = ""
            let gap = false
            let failed: unknown = null
            try {
                const result = streamText({ ...options, onError: ({ error }) => void (failed = error) })
                for await (const part of result.fullStream) {
                    if (part.type === "text-delta" && part.textDelta) {
                        const delta = (gap && text ? "\n\n" : "") + part.textDelta
                        gap = false
                        text += delta
                        send({ type: "text", delta })
                    } else if (part.type === "step-finish") {
                        gap = true
                    } else if (part.type === "error") {
                        failed = part.error
                    }
                }
                if (failed && !text) throw failed
                send({ type: "done", result: finish(text, await result.usage.catch(() => undefined)) })
            } catch (e) {
                console.error("[munshi] stream failed", e)
                send({ type: "error" })
            } finally {
                controller.close()
            }
        },
    })
}

/** The on-screen Confirm button: the same claim and commit the tool would run. */
export async function commitProposal(p: Proposal, ctx: { collectorId: string; today: string }) {
    const def = WRITE_DEFS.find((d) => d.kind === p.kind)
    if (!def) return { ok: false, message: "unknown action" }
    if (!(await claimProposal(p.id, ctx.collectorId, p.kind))) return { ok: true, message: "already saved" }
    const res = await def.commit(p.payload, ctx).catch(() => ({ ok: false, message: "could not save" }))
    if (!res.ok) await releaseProposal(p.id).catch(() => {})
    return res
}
