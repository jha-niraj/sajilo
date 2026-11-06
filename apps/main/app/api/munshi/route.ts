import { stripMarkdown } from "@/lib/munshi/plain-text"
import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { nepalToday } from "@/lib/today"
import { getSettings } from "@/lib/collection/server"
import { runMunshi, streamMunshi } from "@/lib/munshi/agent"
import { munshiModel } from "@/lib/munshi/model"
import { knownNames } from "@/lib/munshi/agenttools/resolve"
import { speak, transcribe } from "@/lib/munshi/speech"
import type { MunshiMessage, MunshiTurnResult, Proposal } from "@/lib/munshi/types"

const MAX_AUDIO_BYTES = 6 * 1024 * 1024

function cleanHistory(history: unknown): MunshiMessage[] {
    if (!Array.isArray(history)) return []
    return (history as MunshiMessage[])
        .filter((m) => (m?.role === "user" || m?.role === "assistant") && typeof m.content === "string" && m.content.trim())
        .slice(-16)
        .map((m) => ({ ...m, content: m.content.slice(0, 2000) }))
}

function cleanPending(pending: unknown): Proposal[] {
    if (!Array.isArray(pending)) return []
    return (pending as Proposal[]).filter((p) => p?.status === "pending" && typeof p.kind === "string" && p.call?.tool).slice(-3)
}

const fail = (error: MunshiTurnResult["error"], extra: Partial<MunshiTurnResult> = {}) =>
    NextResponse.json({ reply: "", proposals: [], resolved: [], error, ...extra } satisfies MunshiTurnResult)

/**
 * One Munshi turn.
 * - JSON `{ text, history, pending }`               -> typed chat, streamed as NDJSON frames
 * - multipart `audio`, `history`, `pending`, `speak` -> voice (Saaras -> agent -> Bulbul)
 */
export async function POST(req: Request) {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
    const collectorId = session.user.id
    const settings = await getSettings(collectorId)
    const base = { collectorId, today: nepalToday(), lang: settings.language === "ne" ? ("ne" as const) : ("en" as const), userName: session.user.name ?? "" }

    if (!munshiModel()) return fail("no_llm")

    const isVoice = (req.headers.get("content-type") ?? "").includes("multipart/form-data")
    try {
        if (!isVoice) {
            const body = (await req.json()) as { text?: string; history?: unknown; pending?: unknown; voice?: boolean }
            const text = String(body.text ?? "").trim().slice(0, 2000)
            if (!text) return fail("no_speech")
            const stream = await streamMunshi({ ...base, history: cleanHistory(body.history), text, pending: cleanPending(body.pending), voice: body.voice === true })
            return new Response(stream, {
                headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store, no-transform", "X-Accel-Buffering": "no" },
            })
        }

        const form = await req.formData()
        const audio = form.get("audio")
        if (!(audio instanceof Blob) || audio.size < 800 || audio.size > MAX_AUDIO_BYTES) return fail("no_speech")
        const parse = (k: string) => {
            try {
                return JSON.parse(String(form.get(k) ?? "[]"))
            } catch {
                return []
            }
        }
        const wantVoice = form.get("speak") !== "0"
        const names = await knownNames(base)
        const heard = await transcribe(audio, settings.language === "en" ? "en" : "ne", [...names.customers, ...names.borrowers])
        if (!heard.text) return fail("no_speech")
        const out = await runMunshi({ ...base, history: cleanHistory(parse("history")), text: heard.text, pending: cleanPending(parse("pending")), voice: wantVoice })
        const voice = wantVoice && out.reply ? await speak(stripMarkdown(out.reply)).catch((e) => (console.error("[munshi] tts", e), null)) : null
        return NextResponse.json({ ...out, heard: heard.text, audio: voice } satisfies MunshiTurnResult)
    } catch (e) {
        console.error("[munshi] turn failed", e)
        return fail("failed")
    }
}
