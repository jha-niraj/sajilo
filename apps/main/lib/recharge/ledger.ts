/**
 * Recharge maths, pure and tested (ledger.test.ts). Sold, profit, stock and cash are always worked
 * out from the events, never stored per entry, so fixing one entry fixes every number after it.
 * Rules: plan/phase-4-recharge.md.
 */

export const PROVIDERS = ["ntc", "ncell"] as const
export const STOCKS = ["eload", "card"] as const
export type Provider = (typeof PROVIDERS)[number]
export type StockKind = (typeof STOCKS)[number]
export type Pool = `${Provider}:${StockKind}`
export const POOLS: Pool[] = PROVIDERS.flatMap((p) => STOCKS.map((s) => `${p}:${s}` as Pool))

export const poolOf = (provider: Provider, stock: StockKind): Pool => `${provider}:${stock}`
export const splitPool = (pool: Pool) => {
    const [provider, stock] = pool.split(":") as [Provider, StockKind]
    return { provider, stock }
}

export type RechargeEvent =
    | { type: "buy"; id: string; pool: Pool; date: string; at: number; face: number; paid: number }
    | { type: "sell"; id: string; pool: Pool; date: string; at: number; amount: number; personId: string | null }
    | { type: "count"; id: string; pool: Pool; date: string; at: number; stock: number }
    | { type: "payback"; id: string; personId: string; date: string; at: number; amount: number }

/** One stock at a moment: rupees of recharge in hand, what they cost him, and his last buying rate. */
export interface PoolState {
    stock: number
    cost: number
    /** paid / face of the last purchase; prices a sale when the stock has run out */
    rate: number
}
export type LedgerState = Record<Pool, PoolState>

export interface PoolDay {
    bought: number
    paid: number
    sold: number
    credit: number
    profit: number
    /** expected minus counted, from the day's last count (positive = missing) */
    gap: number | null
    closing: number
}
export interface DaySummary {
    pools: Record<Pool, PoolDay>
    sold: number
    profit: number
    credit: number
    paidBack: number
    /** money he should have from recharge today: sold - udharo + paid back */
    cash: number
    bought: number
    paid: number
}

const r2 = (n: number) => Math.round(n * 100) / 100

export function emptyState(): LedgerState {
    return Object.fromEntries(POOLS.map((p) => [p, { stock: 0, cost: 0, rate: 0 }])) as LedgerState
}

function emptyDay(state: LedgerState): DaySummary {
    return {
        pools: Object.fromEntries(POOLS.map((p) => [p, { bought: 0, paid: 0, sold: 0, credit: 0, profit: 0, gap: null, closing: state[p].stock }])) as Record<Pool, PoolDay>,
        sold: 0,
        profit: 0,
        credit: 0,
        paidBack: 0,
        cash: 0,
        bought: 0,
        paid: 0,
    }
}

const order = (a: RechargeEvent, b: RechargeEvent) => (a.date === b.date ? a.at - b.at || (a.id < b.id ? -1 : 1) : a.date < b.date ? -1 : 1)

/**
 * Replays events (any order) on top of `start` and returns the state after them plus one summary per
 * day that had events. Average cost: a sale costs (cost / stock) per rupee, so a dealer rate that
 * changes between purchases still gives the right profit.
 */
export function runLedger(start: LedgerState, events: RechargeEvent[]): { state: LedgerState; days: Map<string, DaySummary> } {
    const state = structuredClone(start)
    const days = new Map<string, DaySummary>()
    const dayOf = (date: string) => {
        let d = days.get(date)
        if (!d) days.set(date, (d = emptyDay(state)))
        return d
    }

    for (const e of [...events].sort(order)) {
        const day = dayOf(e.date)
        if (e.type === "payback") {
            day.paidBack += e.amount
            continue
        }
        const s = state[e.pool]
        const pd = day.pools[e.pool]
        if (e.type === "buy") {
            s.stock += e.face
            s.cost += e.paid
            if (e.face > 0) s.rate = e.paid / e.face
            pd.bought += e.face
            pd.paid += e.paid
        } else if (e.type === "sell") {
            const unit = s.stock > 0 ? Math.min(1, Math.max(0, s.cost / s.stock)) : s.rate
            const costOfSale = e.amount * unit
            pd.sold += e.amount
            pd.profit += e.amount - costOfSale
            if (e.personId) pd.credit += e.amount
            s.stock -= e.amount
            s.cost = s.stock > 0 ? Math.max(0, s.cost - costOfSale) : 0
        } else {
            const unit = s.stock > 0 ? s.cost / s.stock : s.rate
            pd.gap = r2(s.stock - e.stock)
            s.stock = e.stock
            s.cost = e.stock * unit
        }
        pd.closing = s.stock
    }

    for (const d of days.values()) {
        for (const p of POOLS) {
            const pd = d.pools[p]
            pd.profit = r2(pd.profit)
            pd.closing = r2(pd.closing)
            d.sold += pd.sold
            d.profit += pd.profit
            d.credit += pd.credit
            d.bought += pd.bought
            d.paid += pd.paid
        }
        d.profit = r2(d.profit)
        d.cash = r2(d.sold - d.credit + d.paidBack)
    }
    for (const p of POOLS) {
        state[p].stock = r2(state[p].stock)
        state[p].cost = r2(state[p].cost)
    }
    return { state, days }
}

/** The state at the end of `date`: everything up to and including that day. */
export function stateAt(start: LedgerState, events: RechargeEvent[], date: string): LedgerState {
    return runLedger(
        start,
        events.filter((e) => e.date <= date),
    ).state
}

/** Totals over a range of days (a month). */
export function sumDays(days: Map<string, DaySummary>, from: string, to: string) {
    let sold = 0
    let profit = 0
    let credit = 0
    let paidBack = 0
    for (const [date, d] of days) {
        if (date < from || date > to) continue
        sold += d.sold
        profit += d.profit
        credit += d.credit
        paidBack += d.paidBack
    }
    return { sold: r2(sold), profit: r2(profit), credit: r2(credit), paidBack: r2(paidBack) }
}

/** What each person owes: udharo sales minus what they paid back. */
export function balances(events: RechargeEvent[]): Map<string, number> {
    const out = new Map<string, number>()
    for (const e of events) {
        if (e.type === "sell" && e.personId) out.set(e.personId, (out.get(e.personId) ?? 0) + e.amount)
        if (e.type === "payback") out.set(e.personId, (out.get(e.personId) ?? 0) - e.amount)
    }
    for (const [k, v] of out) out.set(k, r2(v))
    return out
}

/** What he probably paid for `face` of this stock, from his last purchase: the Bought sheet fills it in. */
export function suggestPaid(state: LedgerState, pool: Pool, face: number): number | null {
    const rate = state[pool].rate
    return rate > 0 ? Math.round(face * rate) : null
}
