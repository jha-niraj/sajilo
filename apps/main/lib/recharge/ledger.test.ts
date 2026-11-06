import { describe, expect, it } from "vitest"
import { balances, emptyState, runLedger, stateAt, suggestPaid, sumDays, type Pool, type RechargeEvent } from "./ledger"

const D1 = "2026-11-05"
const D2 = "2026-11-06"
let n = 0
const at = () => ++n
const buy = (date: string, face: number, paid: number, pool: Pool = "ncell:eload"): RechargeEvent => ({ type: "buy", id: `b${n}`, pool, date, at: at(), face, paid })
const sell = (date: string, amount: number, personId: string | null = null, pool: Pool = "ncell:eload"): RechargeEvent => ({
    type: "sell",
    id: `s${n}`,
    pool,
    date,
    at: at(),
    amount,
    personId,
})

describe("runLedger", () => {
    it("works the plan's example: 2,000 + 20,000 bought for 19,300, 4,500 sold", () => {
        const start = runLedger(emptyState(), [buy(D1, 2000, 1930)]).state
        const { state, days } = runLedger(start, [buy(D2, 20000, 19300), sell(D2, 4000), sell(D2, 200, "p1"), sell(D2, 300)])
        const d = days.get(D2)!
        expect(d.sold).toBe(4500)
        expect(d.profit).toBe(157.5)
        expect(d.credit).toBe(200)
        expect(d.cash).toBe(4300)
        expect(state["ncell:eload"].stock).toBe(17500)
        expect(d.pools["ncell:eload"].closing).toBe(17500)
    })

    it("prices sales at the average cost when rates differ", () => {
        const { days } = runLedger(emptyState(), [buy(D1, 10000, 9700), buy(D1, 10000, 9600), sell(D1, 1000)])
        expect(days.get(D1)!.profit).toBe(35)
    })

    it("keeps the four stocks apart", () => {
        const { state } = runLedger(emptyState(), [buy(D1, 5000, 4850, "ntc:card"), sell(D1, 100, null, "ntc:card"), buy(D1, 1000, 965)])
        expect(state["ntc:card"].stock).toBe(4900)
        expect(state["ncell:eload"].stock).toBe(1000)
        expect(state["ntc:eload"].stock).toBe(0)
    })

    it("uses the last buying rate once stock runs out, and lets stock go below zero", () => {
        const { state, days } = runLedger(emptyState(), [buy(D1, 1000, 970), sell(D1, 1000), sell(D1, 500)])
        expect(state["ncell:eload"].stock).toBe(-500)
        expect(days.get(D1)!.profit).toBe(45)
    })

    it("a count sets the stock and shows the gap without touching profit", () => {
        const { state, days } = runLedger(emptyState(), [buy(D1, 5000, 4850), sell(D1, 1000), { type: "count", id: "c", pool: "ncell:eload", date: D1, at: at(), stock: 3900 }])
        const d = days.get(D1)!
        expect(d.pools["ncell:eload"].gap).toBe(100)
        expect(d.profit).toBe(30)
        expect(state["ncell:eload"].stock).toBe(3900)
        expect(state["ncell:eload"].cost).toBe(3783)
    })

    it("orders events by day then time, whatever order they arrive in", () => {
        const late = sell(D2, 500)
        const early = buy(D1, 1000, 970)
        expect(runLedger(emptyState(), [late, early]).state["ncell:eload"].stock).toBe(500)
    })

    it("a payback adds to cash, not to sold", () => {
        const { days } = runLedger(emptyState(), [{ type: "payback", id: "pb", personId: "p1", date: D2, at: at(), amount: 200 }])
        expect(days.get(D2)!.cash).toBe(200)
        expect(days.get(D2)!.sold).toBe(0)
    })
})

describe("helpers", () => {
    it("stateAt stops at the day", () => {
        expect(stateAt(emptyState(), [buy(D1, 1000, 970), buy(D2, 1000, 970)], D1)["ncell:eload"].stock).toBe(1000)
    })

    it("sumDays adds a range", () => {
        const { days } = runLedger(emptyState(), [buy(D1, 10000, 9650), sell(D1, 1000), sell(D2, 2000)])
        expect(sumDays(days, D1, D2)).toEqual({ sold: 3000, profit: 105, credit: 0, paidBack: 0 })
        expect(sumDays(days, D2, D2).sold).toBe(2000)
    })

    it("balances: udharo minus paid back", () => {
        const b = balances([sell(D1, 300, "p1"), sell(D1, 200, "p1"), sell(D1, 100, "p2"), { type: "payback", id: "x", personId: "p1", date: D2, at: at(), amount: 500 }])
        expect(b.get("p1")).toBe(0)
        expect(b.get("p2")).toBe(100)
    })

    it("suggestPaid uses the last rate", () => {
        const { state } = runLedger(emptyState(), [buy(D1, 20000, 19300)])
        expect(suggestPaid(state, "ncell:eload", 30000)).toBe(28950)
        expect(suggestPaid(state, "ntc:eload", 30000)).toBeNull()
    })
})
