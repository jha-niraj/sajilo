import "server-only"
import { z } from "zod"
import { makeTool } from "@repo/ai/agent"
import { adToBs, bsMonthRange } from "@repo/calendar"
import { loadRecharge } from "@/lib/recharge/server"
import { POOLS, runLedger, splitPool, sumDays } from "@/lib/recharge/ledger"
import { bsArgToAd, bsLabel } from "../resolve"
import type { MunshiToolContext, MunshiToolDef } from "../types"

const bsDate = z.object({ year: z.number(), month: z.number().describe("1-12, Baishakh = 1"), day: z.number() })

/** The month's recharge data with names resolved: shared by the read and the write tools. */
export async function rechargeBook(ctx: Pick<MunshiToolContext, "collectorId" | "today">, on = ctx.today) {
    const bs = adToBs(on)
    const range = bsMonthRange(bs.year, bs.month)
    const to = range.end < ctx.today ? range.end : ctx.today
    const data = await loadRecharge(ctx.collectorId, range.start, to, ctx.today)
    const ledger = runLedger(data.start, data.events)
    const people = data.people.map((p) => {
        const c = p.customerId ? data.customers.find((x) => x.id === p.customerId) : null
        return { ...p, name: p.name || c?.name || p.phone || "-" }
    })
    return { data, ledger, people, range, to }
}

export const getRechargeDef: MunshiToolDef = {
    name: "getRecharge",
    capability: "tell him about his NTC/Ncell recharge business: stock in hand, sold, profit, who owes udharo",
    isWrite: false,
    build: (ctx) =>
        makeTool({
            description:
                "Recharge (NTC and Ncell, e-load and scratch cards; a separate business from collection): stock in hand per provider and type, a day's sales/profit/cash, the month's profit, and everyone who owes recharge udharo.",
            parameters: z.object({ on: bsDate.optional().describe("BS date; omit for today") }),
            execute: async ({ on }) => {
                const day = bsArgToAd(on) ?? ctx.today
                const { ledger, people, range, to } = await rechargeBook(ctx, day)
                const d = ledger.days.get(day)
                const month = sumDays(ledger.days, range.start, to)
                return {
                    day: bsLabel(day),
                    stock_in_hand_now: Object.fromEntries(POOLS.map((p) => [p.replace(":", " "), ledger.state[p].stock])),
                    that_day: d
                        ? {
                              sold: d.sold,
                              profit: d.profit,
                              given_on_udharo: d.credit,
                              udharo_paid_back: d.paidBack,
                              cash_from_recharge: d.cash,
                              by_stock: POOLS.filter((p) => d.pools[p].sold || d.pools[p].bought).map((p) => ({
                                  ...splitPool(p),
                                  sold: d.pools[p].sold,
                                  bought: d.pools[p].bought,
                                  profit: d.pools[p].profit,
                              })),
                          }
                        : "nothing recorded",
                    month: { sold: month.sold, profit: month.profit },
                    udharo_owed: people.filter((p) => p.owed > 0).map((p) => ({ name: p.name, phone: p.phone, owes: p.owed })),
                }
            },
        }),
}
