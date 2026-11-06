/**
 * Recharge maths, pure and tested (ledger.test.ts). Sold, profit, stock and cash are always worked
 * out from the events, never stored per entry, so fixing one entry fixes every number after it.
 * Rules: plan/phase-4-recharge.md.
 *
 * Every purchase is a batch ("the 20,000 bought on 20 Kartik"). Sales use the oldest batch first,
 * so each batch shows how much of it is sold, what is left and the profit it made, the way he
 * keeps it in his notebook.
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

/** Why a check found a different stock: anything but "sold" (that is saved as a sale instead). */
export type CheckNote = "lost" | "other"

export type RechargeEvent =
    | { type: "buy"; id: string; pool: Pool; date: string; at: number; face: number; paid: number }
    | { type: "sell"; id: string; pool: Pool; date: string; at: number; amount: number; personId: string | null; online?: boolean }
    | { type: "count"; id: string; pool: Pool; date: string; at: number; stock: number; note?: CheckNote | null }
    | { type: "payback"; id: string; personId: string; date: string; at: number; amount: number; online?: boolean }

/** One purchase and what has happened to it since. */
export interface Batch {
    id: string
    pool: Pool
    date: string
    face: number
    paid: number
    /** recharge of this batch still in hand (below zero only if sales ran past all stock) */
    left: number
    sold: number
    profit: number
    /** less than expected at a check, taken from this batch (lost, not sold) */
    missing: number
}

/** One stock at a moment: rupees of recharge in hand, the purchases it is made of, and his last rate. */
export interface PoolState {
    stock: number
    /** paid / face of the last purchase; prices a sale when there is no batch at all */
    rate: number
    /** purchases with something left, oldest first, plus always the newest one */
    batches: Batch[]
}
export type LedgerState = Record<Pool, PoolState>

export interface PoolDay {
    opening: number
    bought: number
    paid: number
    sold: number
    credit: number
    profit: number
    /** expected minus found, from the day's last check (positive = missing) */
    gap: number | null
    closing: number
}
export interface DaySummary {
    pools: Record<Pool, PoolDay>
    opening: number
    closing: number
    sold: number
    profit: number
    credit: number
    paidBack: number
    /** sales and paybacks paid by QR / online, so not in his hand */
    online: number
    /** cash he should have from recharge that day: sold - udharo - online + paid back in cash */
    cash: number
    bought: number
    paid: number
}

const r2 = (n: number) => Math.round(n * 100) / 100
const rateOf = (b: Batch) => (b.face > 0 ? b.paid / b.face : 0)

export function emptyState(): LedgerState {
    return Object.fromEntries(POOLS.map((p) => [p, { stock: 0, rate: 0, batches: [] }])) as unknown as LedgerState
}

/** A checkpoint written before batches existed has no `batches`: its stock becomes one opening batch. */
function normalise(start: LedgerState): LedgerState {
    const s = structuredClone(start)
    for (const p of POOLS) {
        const ps = (s[p] ??= { stock: 0, rate: 0, batches: [] })
        if (!Array.isArray(ps.batches)) {
            ps.batches = []
            if (ps.stock > 0) ps.batches.push({ id: `open-${p}`, pool: p, date: "", face: ps.stock, paid: r2(ps.stock * ps.rate), left: ps.stock, sold: 0, profit: 0, missing: 0 })
        }
    }
    return s
}

function emptyDay(state: LedgerState): DaySummary {
    const pools = Object.fromEntries(
        POOLS.map((p) => [p, { opening: state[p].stock, bought: 0, paid: 0, sold: 0, credit: 0, profit: 0, gap: null, closing: state[p].stock }]),
    ) as Record<Pool, PoolDay>
    return { pools, opening: 0, closing: 0, sold: 0, profit: 0, credit: 0, paidBack: 0, online: 0, cash: 0, bought: 0, paid: 0 }
}

const order = (a: RechargeEvent, b: RechargeEvent) => (a.date === b.date ? a.at - b.at || (a.id < b.id ? -1 : 1) : a.date < b.date ? -1 : 1)

/** Takes `amount` from the oldest batches first; `book` records each piece. Returns what no batch had. */
function takeOldest(batches: Batch[], amount: number, book: (b: Batch, piece: number) => void): number {
    let rest = amount
    for (const b of batches) {
        if (rest <= 0.004) break
        if (b.left <= 0.004) continue
        const piece = Math.min(b.left, rest)
        b.left -= piece
        book(b, piece)
        rest -= piece
    }
    return rest
}

/**
 * Replays events (any order) on top of `start`. Returns the state after them, one summary per day
 * that had events, each check's gap by entry id, and every batch seen (those carried in from `start` and those bought), oldest first.
 */
export function runLedger(
    start: LedgerState,
    events: RechargeEvent[],
): { state: LedgerState; days: Map<string, DaySummary>; batches: Batch[]; gaps: Map<string, number> } {
    const state = normalise(start)
    const days = new Map<string, DaySummary>()
    const seen = new Map<string, Batch>()
    const gaps = new Map<string, number>()
    for (const p of POOLS) for (const b of state[p].batches) seen.set(b.id, b)
    const dayOf = (date: string) => {
        let d = days.get(date)
        if (!d) days.set(date, (d = emptyDay(state)))
        return d
    }

    for (const e of [...events].sort(order)) {
        const day = dayOf(e.date)
        if (e.type === "payback") {
            day.paidBack += e.amount
            if (e.online) day.online += e.amount
            continue
        }
        const s = state[e.pool]
        const pd = day.pools[e.pool]
        if (e.type === "buy") {
            const b: Batch = { id: e.id, pool: e.pool, date: e.date, face: e.face, paid: e.paid, left: e.face, sold: 0, profit: 0, missing: 0 }
            s.batches.push(b)
            seen.set(b.id, b)
            s.stock += e.face
            if (e.face > 0) s.rate = e.paid / e.face
            pd.bought += e.face
            pd.paid += e.paid
        } else if (e.type === "sell") {
            const book = (b: Batch, piece: number) => {
                const profit = piece * (1 - Math.min(1, rateOf(b)))
                b.sold += piece
                b.profit += profit
                pd.profit += profit
            }
            const over = takeOldest(s.batches, e.amount, book)
            if (over > 0.004) {
                const last = s.batches.at(-1)
                if (last) {
                    last.left -= over
                    book(last, over)
                } else pd.profit += over * (1 - s.rate)
            }
            pd.sold += e.amount
            if (e.personId) pd.credit += e.amount
            else if (e.online) day.online += e.amount
            s.stock -= e.amount
        } else {
            const gap = r2(s.stock - e.stock)
            pd.gap = gap
            gaps.set(e.id, gap)
            if (gap > 0) {
                const over = takeOldest(s.batches, gap, (b, piece) => (b.missing += piece))
                const last = s.batches.at(-1)
                if (over > 0.004 && last) {
                    last.left -= over
                    last.missing += over
                }
            } else if (gap < 0) {
                const last = s.batches.at(-1)
                if (last) {
                    last.left -= gap
                    last.missing += gap
                }
            }
            s.stock = e.stock
        }
        s.batches = s.batches.filter((b, i, all) => b.left > 0.004 || i === all.length - 1)
        pd.closing = s.stock
    }

    for (const d of days.values()) {
        for (const p of POOLS) {
            const pd = d.pools[p]
            pd.profit = r2(pd.profit)
            pd.closing = r2(pd.closing)
            d.opening += pd.opening
            d.closing += pd.closing
            d.sold += pd.sold
            d.profit += pd.profit
            d.credit += pd.credit
            d.bought += pd.bought
            d.paid += pd.paid
        }
        d.opening = r2(d.opening)
        d.closing = r2(d.closing)
        d.profit = r2(d.profit)
        d.cash = r2(d.sold - d.credit - d.online + d.paidBack)
    }
    for (const b of seen.values()) {
        b.left = r2(b.left)
        b.sold = r2(b.sold)
        b.profit = r2(b.profit)
        b.missing = r2(b.missing)
    }
    for (const p of POOLS) state[p].stock = r2(state[p].stock)
    const batches = [...seen.values()].sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? -1 : 1))
    return { state: structuredClone(state), days, batches, gaps }
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
    let cash = 0
    for (const [date, d] of days) {
        if (date < from || date > to) continue
        sold += d.sold
        profit += d.profit
        credit += d.credit
        paidBack += d.paidBack
        cash += d.cash
    }
    return { sold: r2(sold), profit: r2(profit), credit: r2(credit), paidBack: r2(paidBack), cash: r2(cash) }
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

/** Margin of a purchase in percent, one decimal: 20,000 for 19,300 is 3.5. */
export const marginPct = (face: number, paid: number) => (face > 0 ? Math.round(((face - paid) / face) * 1000) / 10 : 0)
