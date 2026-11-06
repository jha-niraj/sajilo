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

    it("sells the oldest purchase first, at that purchase's rate", () => {
        const { days, batches } = runLedger(emptyState(), [buy(D1, 1000, 970), buy(D1, 10000, 9600), sell(D1, 1500)])
        expect(days.get(D1)!.profit).toBe(30 + 20)
        expect(batches.map((b) => [b.sold, b.left])).toEqual([
            [1000, 0],
            [500, 9500],
        ])
    })

    it("each batch keeps its own sold, left and profit across days and checkpoints", () => {
        const first = runLedger(emptyState(), [buy(D1, 20000, 19300), sell(D1, 5000)])
        const { batches, state } = runLedger(first.state, [sell(D2, 3000), buy(D2, 10000, 9650), sell(D2, 13000)])
        expect(batches.map((b) => [b.face, b.sold, b.left, b.profit])).toEqual([
            [20000, 20000, 0, 700],
            [10000, 1000, 9000, 35],
        ])
        expect(state["ncell:eload"].batches).toHaveLength(1)
    })

    it("online money is sold but not cash in hand", () => {
        const { days } = runLedger(emptyState(), [buy(D1, 1000, 970), { ...sell(D1, 200), online: true } as RechargeEvent, sell(D1, 100)])
        expect(days.get(D1)!.sold).toBe(300)
        expect(days.get(D1)!.cash).toBe(100)
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

    it("a check sets the stock, shows the gap and marks it missing on the oldest batch, without touching profit", () => {
        const { state, days, batches } = runLedger(emptyState(), [
            buy(D1, 5000, 4850),
            sell(D1, 1000),
            { type: "count", id: "c", pool: "ncell:eload", date: D1, at: at(), stock: 3900, note: "lost" },
        ])
        const d = days.get(D1)!
        expect(d.pools["ncell:eload"].gap).toBe(100)
        expect(d.profit).toBe(30)
        expect(state["ncell:eload"].stock).toBe(3900)
        expect(batches[0]).toMatchObject({ left: 3900, missing: 100 })
    })

    it("a check that finds more adds it to the newest batch", () => {
        const { state, batches } = runLedger(emptyState(), [buy(D1, 1000, 970), { type: "count", id: "c", pool: "ncell:eload", date: D1, at: at(), stock: 1050 }])
        expect(state["ncell:eload"].stock).toBe(1050)
        expect(batches[0]).toMatchObject({ left: 1050, missing: -50 })
    })

    it("reads an old checkpoint without batches as one opening batch", () => {
        const old = { ...emptyState(), "ncell:eload": { stock: 2000, cost: 1930, rate: 0.965 } } as unknown as Parameters<typeof runLedger>[0]
        const { batches, days } = runLedger(old, [sell(D1, 500)])
        expect(batches[0]).toMatchObject({ left: 1500, sold: 500 })
        expect(days.get(D1)!.profit).toBe(17.5)
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
        expect(sumDays(days, D1, D2)).toEqual({ sold: 3000, profit: 105, credit: 0, paidBack: 0, cash: 3000 })
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
