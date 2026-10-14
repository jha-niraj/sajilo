import "server-only"
import { z } from "zod"
import { makeTool } from "@repo/ai/agent"
import { adToBs, bsMonthRange } from "@repo/calendar"
import { buildLedger } from "@/lib/money/ledger"
import { computeTodayView } from "@/lib/collection/today-view"
import { entriesUpTo, getDaySnapshot, receivedBetween } from "@/lib/collection/server"
import { activeCustomers, bsLabel, matchName, notFound } from "../resolve"
import type { MunshiToolDef } from "../types"

export const getTodayStatusDef: MunshiToolDef = {
    name: "getTodayStatus",
    capability: "tell him today's collection: total so far, who has paid, who has not",
    isWrite: false,
    build: (ctx) =>
        makeTool({
            description: "Today's collection: total collected and expected, who paid (with amounts), who has not yet, who missed.",
            parameters: z.object({}),
            execute: async () => {
                const snap = await getDaySnapshot(ctx.collectorId, ctx.today)
                const entryBy = new Map(snap.entries.map((e) => [e.customerId, e]))
                const carryBy = new Map(snap.carry.map((c) => [c.customerId, c]))
                let collected = 0
                let expected = 0
                const paid: string[] = []
                const notYet: string[] = []
                const missed: string[] = []
                for (const c of snap.customers) {
                    const e = entryBy.get(c.id)
                    const v = computeTodayView(carryBy.get(c.id), e?.expectedAmount ?? c.defaultAmount, e?.status ?? "pending", e?.amountReceived ?? 0)
                    collected += v.received
                    expected += v.expected
                    if (e?.status === "paid") paid.push(`${c.name}: Rs ${v.received}`)
                    else if (e?.status === "shop_closed" || e?.status === "no_money") missed.push(`${c.name} (${e.status})`)
                    else if (e?.status !== "holiday") notYet.push(c.name)
                }
                return { date: bsLabel(ctx.today), collected, expected, paid, not_yet: notYet, missed, day_closed: Boolean(snap.lockedAt) }
            },
        }),
}

export const getCustomerDef: MunshiToolDef = {
    name: "getCustomer",
    capability: "look up one customer: what they owe, missed days, what they paid this month",
    isWrite: false,
    build: (ctx) =>
        makeTool({
            description: "One collection customer: daily amount, what they owe now, missed days, advance, paid this month, today's status, recent payments.",
            parameters: z.object({ name: z.string().describe("Customer name exactly as in the customer list") }),
            execute: async ({ name }) => {
                const m = matchName(await activeCustomers(ctx), name)
                if (!m.hit) return notFound(m.candidates)
                const c = m.hit
                const entries = await entriesUpTo([c.id], ctx.today)
                const l = buildLedger(entries, ctx.today)
                const b = adToBs(ctx.today)
                const r = bsMonthRange(b.year, b.month)
                const today = entries.find((e) => e.date === ctx.today)
                return {
                    name: c.name,
                    daily_amount: c.defaultAmount,
                    owes_now: l.arrears + l.todayDue,
                    missed_days: l.arrearsDays,
                    advance: l.advance,
                    paid_this_month: entries.filter((e) => e.date >= r.start && e.date <= r.end).reduce((s, e) => s + e.amountReceived, 0),
                    today: today ? { status: today.status, received: today.amountReceived } : null,
                    recent_payments: entries
                        .filter((e) => e.amountReceived > 0)
                        .sort((a, z2) => (a.date < z2.date ? 1 : -1))
                        .slice(0, 5)
                        .map((e) => `${bsLabel(e.date)}: Rs ${e.amountReceived}`),
                }
            },
        }),
}

export const getMonthTotalDef: MunshiToolDef = {
    name: "getMonthTotal",
    capability: "total collected in a Bikram Sambat month and the biggest payers",
    isWrite: false,
    build: (ctx) =>
        makeTool({
            description: "Total collected in a BS month (default: this month) and the top customers.",
            parameters: z.object({
                year: z.number().optional(),
                month: z.number().optional().describe("1-12, Baishakh = 1"),
            }),
            execute: async ({ year, month }) => {
                const b = adToBs(ctx.today)
                const y = year || b.year
                const mo = month || b.month
                const r = bsMonthRange(y, mo)
                const [list, received] = await Promise.all([activeCustomers(ctx), receivedBetween(ctx.collectorId, r.start, r.end)])
                const by = new Map<string, number>()
                for (const x of received) by.set(x.customerId, (by.get(x.customerId) ?? 0) + x.amountReceived)
                return {
                    month: `${y}-${mo}`,
                    total: received.reduce((s, x) => s + x.amountReceived, 0),
                    top_customers: list
                        .map((c) => ({ name: c.name, total: by.get(c.id) ?? 0 }))
                        .sort((a, z2) => z2.total - a.total)
                        .slice(0, 5),
                }
            },
        }),
}
