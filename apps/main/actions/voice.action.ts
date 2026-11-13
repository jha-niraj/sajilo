"use server"

import { actionCollectorId } from "@/lib/session"
import { nepalToday } from "@/lib/today"
import { loadRecharge, type RechargeData } from "@/lib/recharge/server"

/** Today's recharge book for the voice loop (stock, udharo, cash); the phone keeps a copy for offline. */
export async function voiceRecharge(): Promise<RechargeData> {
    const collectorId = await actionCollectorId()
    const today = nepalToday()
    return loadRecharge(collectorId, today, today, today)
}
