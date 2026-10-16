"use server"

import { z } from "zod"
import { db, and, eq, desc, sql } from "@repo/db"
import { munshiConversation } from "@repo/db/schema"
import { actionCollectorId, getSession } from "@/lib/session"
import { nepalToday } from "@/lib/today"
import { getSettings } from "@/lib/collection/server"
import { commitProposal } from "@/lib/munshi/agent"
import { speak } from "@/lib/munshi/speech"
import type { MunshiConversationSummary, MunshiMessage, Proposal } from "@/lib/munshi/types"

async function caller() {
    const collectorId = await actionCollectorId()
    const [settings, session] = await Promise.all([getSettings(collectorId), getSession()])
    return { collectorId, today: nepalToday(), lang: settings.language, userName: session?.user.name ?? "" }
}

/** Speak a line out loud (welcome, "say it again"). */
export async function munshiSpeak(text: string): Promise<string | null> {
    await actionCollectorId()
    return speak(text.slice(0, 1200)).catch(() => null)
}

/** He tapped Confirm on a card. */
export async function confirmProposal(p: Proposal): Promise<{ ok: boolean; message: string }> {
    const c = await caller()
    try {
        return await commitProposal(p, c)
    } catch (e) {
        console.error("[munshi] confirm failed", e)
        return { ok: false, message: "failed" }
    }
}

const conversationId = z.string().uuid()

export async function listConversations(): Promise<MunshiConversationSummary[]> {
    const collectorId = await actionCollectorId()
    const rows = await db
        .select({ id: munshiConversation.id, title: munshiConversation.title, messageCount: munshiConversation.messageCount, updatedAt: munshiConversation.updatedAt })
        .from(munshiConversation)
        .where(eq(munshiConversation.collectorId, collectorId))
        .orderBy(desc(munshiConversation.updatedAt))
        .limit(300)
    return rows.map((r) => ({ ...r, updatedAt: r.updatedAt.toISOString() }))
}

export async function getConversation(id: string): Promise<MunshiMessage[] | null> {
    const collectorId = await actionCollectorId()
    if (!conversationId.safeParse(id).success) return null
    const row = await db.query.munshiConversation.findFirst({
        columns: { messages: true },
        where: and(eq(munshiConversation.id, id), eq(munshiConversation.collectorId, collectorId)),
    })
    return row ? (row.messages as MunshiMessage[]) : null
}

/** Saves the whole chat. The title is his first question, so the history list reads naturally. */
export async function saveConversation(id: string, messages: MunshiMessage[]): Promise<{ ok: boolean }> {
    const collectorId = await actionCollectorId()
    if (!conversationId.safeParse(id).success) return { ok: false }
    const kept = messages.slice(-200)
    const title = (kept.find((m) => m.role === "user")?.content ?? "").replace(/\s+/g, " ").trim().slice(0, 80)
    const count = kept.filter((m) => m.role === "user").length
    await db
        .insert(munshiConversation)
        .values({ id, collectorId, title, messages: kept, messageCount: count })
        .onConflictDoUpdate({
            target: munshiConversation.id,
            set: { title, messages: kept, messageCount: count, updatedAt: new Date() },
            setWhere: sql`${munshiConversation.collectorId} = ${collectorId}`,
        })
    return { ok: true }
}

export async function deleteConversation(id: string): Promise<{ ok: true }> {
    const collectorId = await actionCollectorId()
    await db.delete(munshiConversation).where(and(eq(munshiConversation.id, id), eq(munshiConversation.collectorId, collectorId)))
    return { ok: true }
}
