import "server-only"
import { generateText, type CoreMessage } from "ai"
import { logAiUsage } from "@repo/ai/usage"
import { adToBs, adDayOfWeek, formatBs, WEEKDAYS_EN } from "@repo/calendar"
import { munshiModel } from "./model"
import { buildTools, capabilityList, WRITE_DEFS } from "./agenttools"
import { knownNames } from "./agenttools/resolve"
import type { MunshiToolContext } from "./agenttools/types"
import type { MunshiMessage, Proposal } from "./types"

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

LANGUAGE: Match HIS LAST MESSAGE. If it is English words, reply in simple English. If it is Nepali (Devanagari, or Nepali words typed in English letters like "kati baki cha"), reply in simple, warm Nepali (Devanagari). App language: ${o.lang === "ne" ? "Nepali" : "English"}.
STYLE: ${o.voice ? "VOICE reply: 1-3 short spoken sentences. No lists, no symbols, no markdown. Say amounts in words (e.g. 'दुई हजार एक सय रुपैयाँ' / 'two thousand one hundred rupees')." : "Chat reply: at most 4 short lines, no markdown headings. Write amounts like Rs 2,100 / रु २,१००."}

YOU CAN:
${capabilityList()}

RULES:
- Never guess numbers. Read them with tools.
- Use names exactly as listed below. Map spoken or Nepali-script names to the closest listed one ("राम किराना" -> "Ram Kirana"). On not_found, ask which one using did_you_mean.
- Every change is two steps: call the tool with confirm=false first (a Confirm card appears). NOTHING is saved yet, so never say it is done/marked/saved; say you have prepared it and ask him to confirm (e.g. "I've prepared Sita Store: Rs 500 for today. Shall I save it?"). Only after he clearly says yes, call it again with confirm=true and the same arguments. One change per message.
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

const NEPALI_ROMAN = /\b(cha|chha|kati|baki|bhayo|garnu|garnus|diyo|dinu|tiryo|paisa|rupaiya|aaja|aja|hijo|kasle|kun|ho|haina|hajur|dai|bhai|ma|lai|le|ko)\b/i

/** Which language to answer in, decided in code: models drift toward one language otherwise. */
function replyLanguage(text: string): "ne" | "en" {
    if (/[\u0900-\u097F]/.test(text)) return "ne"
    return (text.match(new RegExp(NEPALI_ROMAN, "gi")) ?? []).length >= 2 ? "ne" : "en"
}

export async function runMunshi(run: MunshiRun): Promise<MunshiRunResult> {
    const m = munshiModel()
    if (!m) throw new Error("NO_LLM")

    const waiting = run.pending.filter((p) => p.status === "pending")
    const proposals: Proposal[] = []
    const resolved: MunshiRunResult["resolved"] = []
    let committed: string | null = null

    const ctx: MunshiToolContext = {
        collectorId: run.collectorId,
        today: run.today,
        lang: run.lang,
        propose: (p) => {
            const full: Proposal = { ...p, id: crypto.randomUUID(), status: "pending" }
            proposals.push(full)
            return full
        },
        resolve: (kind, status) => {
            const target = [...proposals, ...waiting].filter((p) => p.kind === kind && p.status === "pending").at(-1)
            if (!target) return
            target.status = status
            resolved.push({ id: target.id, status })
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

    const result = await generateText({
        model: m.model,
        system:
            systemPrompt({ today: run.today, lang: run.lang, userName: run.userName, voice: run.voice, names, waiting }) +
            (replyLanguage(run.text) === "ne"
                ? "\n\nREPLY LANGUAGE FOR THIS MESSAGE: Nepali (Devanagari)."
                : "\n\nREPLY LANGUAGE FOR THIS MESSAGE: English. Do not reply in Nepali."),
        messages,
        tools: buildTools(ctx),
        maxSteps: MAX_STEPS,
        temperature: 0.3,
        abortSignal: AbortSignal.timeout(50_000),
    })

    void logAiUsage({
        referenceId: crypto.randomUUID(),
        referenceType: run.voice ? "MUNSHI_VOICE" : "MUNSHI_CHAT",
        modelId: m.id,
        inputTokens: result.usage?.promptTokens ?? 0,
        outputTokens: result.usage?.completionTokens ?? 0,
        userId: run.collectorId,
    })

    // A card he never confirmed in this turn that the model replaced with a newer one of the same kind is stale.
    const fresh = proposals.filter((p, i) => p.status !== "pending" || !proposals.slice(i + 1).some((q) => q.kind === p.kind && q.status === "pending"))
    return { reply: result.text.trim(), proposals: fresh, resolved }
}

/** The on-screen Confirm button: run the same commit the tool would. */
export async function commitProposal(p: Proposal, ctx: { collectorId: string; today: string }) {
    const def = WRITE_DEFS.find((d) => d.kind === p.kind)
    if (!def) return { ok: false, message: "unknown action" }
    return def.commit(p.payload, ctx)
}
