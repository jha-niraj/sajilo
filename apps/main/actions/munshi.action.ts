"use server"

import { actionCollectorId, getSession } from "@/lib/session"
import { nepalToday } from "@/lib/today"
import { getSettings } from "@/lib/collection/server"
import { commitProposal } from "@/lib/munshi/agent"
import { speak } from "@/lib/munshi/speech"
import type { Proposal } from "@/lib/munshi/types"

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
