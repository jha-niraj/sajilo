import { NextResponse } from "next/server"
import { addAdDays } from "@repo/calendar"
import { nepalToday } from "@/lib/today"
import { closeRechargeDays, rechargeCollectors } from "@/lib/recharge/server"

/**
 * The nightly Recharge close (plan/phase-4-recharge.md). Called by worker.ts `scheduled` just after
 * midnight Nepal time, with the auth secret as the key, so nobody outside the Worker can run it.
 * Closes every day up to yesterday; running it twice changes nothing.
 */
export async function POST(req: Request) {
    const key = req.headers.get("x-cron-key")
    const secret = process.env.BETTER_AUTH_SECRET
    if (!secret || !key || !timingSafeEqual(key, secret)) return NextResponse.json({ error: "forbidden" }, { status: 403 })

    const upTo = addAdDays(nepalToday(), -1)
    const collectors = await rechargeCollectors()
    let days = 0
    const failed: string[] = []
    for (const id of collectors) {
        try {
            days += await closeRechargeDays(id, upTo)
        } catch (e) {
            console.error("[cron] recharge close failed", id, e)
            failed.push(id)
        }
    }
    return NextResponse.json({ upTo, collectors: collectors.length, days, failed: failed.length })
}

function timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false
    let diff = 0
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
    return diff === 0
}
