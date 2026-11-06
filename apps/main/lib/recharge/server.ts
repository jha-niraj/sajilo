import "server-only"
import { db, and, eq, gt, gte, lte, lt, desc, asc, inArray, isNotNull, sql } from "@repo/db"
import { customer, rechargeDay, rechargeEntry, rechargePerson } from "@repo/db/schema"
import { emptyState, poolOf, runLedger, type CheckNote, type DaySummary, type LedgerState, type Provider, type RechargeEvent, type StockKind } from "./ledger"

export interface RechargePerson {
    id: string
    name: string | null
    phone: string | null
    customerId: string | null
    /** what they owe right now (udharo minus paid back), all time */
    owed: number
}

export interface RechargeData {
    today: string
    from: string
    to: string
    /** state at the end of the checkpoint day (the last nightly close before `from`), or empty */
    start: LedgerState
    events: RechargeEvent[]
    people: RechargePerson[]
    customers: { id: string; name: string; phone: string | null }[]
}

type EntryRow = typeof rechargeEntry.$inferSelect

export function toEvent(r: EntryRow): RechargeEvent | null {
    const at = r.at.getTime()
    if (r.kind === "payback") return r.personId ? { type: "payback", id: r.id, personId: r.personId, date: r.date, at, amount: r.amount, online: r.online } : null
    if (!r.provider || !r.stock) return null
    const pool = poolOf(r.provider as Provider, r.stock as StockKind)
    if (r.kind === "buy") return { type: "buy", id: r.id, pool, date: r.date, at, face: r.amount, paid: r.paid ?? r.amount }
    if (r.kind === "sell") return { type: "sell", id: r.id, pool, date: r.date, at, amount: r.amount, personId: r.personId, online: r.online }
    return { type: "count", id: r.id, pool, date: r.date, at, stock: r.amount, note: (r.note as CheckNote | null) ?? null }
}

const events = (rows: EntryRow[]) => rows.map(toEvent).filter((e): e is RechargeEvent => e !== null)

/** Everything the Recharge page needs for the days from..to (a BS month up to today). */
export async function loadRecharge(collectorId: string, from: string, to: string, today: string): Promise<RechargeData> {
    const [checkpoint, people, owed, customers] = await Promise.all([
        db
            .select({ date: rechargeDay.date, state: rechargeDay.state })
            .from(rechargeDay)
            .where(and(eq(rechargeDay.collectorId, collectorId), lt(rechargeDay.date, from)))
            .orderBy(desc(rechargeDay.date))
            .limit(1),
        db.select().from(rechargePerson).where(eq(rechargePerson.collectorId, collectorId)),
        db
            .select({
                personId: rechargeEntry.personId,
                owed: sql<string>`sum(case when ${rechargeEntry.kind} = 'sell' then ${rechargeEntry.amount} else -${rechargeEntry.amount} end)`,
            })
            .from(rechargeEntry)
            .where(and(eq(rechargeEntry.collectorId, collectorId), isNotNull(rechargeEntry.personId), inArray(rechargeEntry.kind, ["sell", "payback"])))
            .groupBy(rechargeEntry.personId),
        db
            .select({ id: customer.id, name: customer.name, phone: customer.phone })
            .from(customer)
            .where(and(eq(customer.collectorId, collectorId), eq(customer.isActive, true)))
            .orderBy(asc(customer.routeOrder)),
    ])
    const cp = checkpoint[0]
    const rows = await db
        .select()
        .from(rechargeEntry)
        .where(and(eq(rechargeEntry.collectorId, collectorId), cp ? gt(rechargeEntry.date, cp.date) : undefined, lte(rechargeEntry.date, to)))
    const owedBy = new Map(owed.map((o) => [o.personId!, Math.round(Number(o.owed) * 100) / 100]))
    return {
        today,
        from,
        to,
        start: cp ? (cp.state as LedgerState) : emptyState(),
        events: events(rows),
        people: people.map((p) => ({ id: p.id, name: p.name, phone: p.phone, customerId: p.customerId, owed: owedBy.get(p.id) ?? 0 })),
        customers,
    }
}

/** A changed entry on or before a closed day makes those closes wrong: drop them, the next close redoes them. */
export async function reopenFrom(collectorId: string, date: string) {
    await db.delete(rechargeDay).where(and(eq(rechargeDay.collectorId, collectorId), gte(rechargeDay.date, date)))
}

/**
 * The nightly close: one `recharge_day` per day with entries since the last close, and one for
 * `upTo` itself, so the next page load starts from there instead of replaying history.
 */
export async function closeRechargeDays(collectorId: string, upTo: string): Promise<number> {
    const [cp] = await db
        .select({ date: rechargeDay.date, state: rechargeDay.state })
        .from(rechargeDay)
        .where(and(eq(rechargeDay.collectorId, collectorId), lte(rechargeDay.date, upTo)))
        .orderBy(desc(rechargeDay.date))
        .limit(1)
    if (cp?.date === upTo) return 0
    const rows = await db
        .select()
        .from(rechargeEntry)
        .where(and(eq(rechargeEntry.collectorId, collectorId), cp ? gt(rechargeEntry.date, cp.date) : undefined, lte(rechargeEntry.date, upTo)))
    if (!cp && rows.length === 0) return 0

    const all = events(rows)
    const dates = [...new Set(all.map((e) => e.date))].sort()
    if (dates.at(-1) !== upTo) dates.push(upTo)
    let state = cp ? (cp.state as LedgerState) : emptyState()
    const out: (typeof rechargeDay.$inferInsert)[] = []
    for (const date of dates) {
        const { state: next, days } = runLedger(
            state,
            all.filter((e) => e.date === date),
        )
        state = next
        const summary: DaySummary | { empty: true } = days.get(date) ?? { empty: true }
        out.push({ collectorId, date, state, summary })
    }
    for (let i = 0; i < out.length; i += 50) {
        await db
            .insert(rechargeDay)
            .values(out.slice(i, i + 50))
            .onConflictDoUpdate({ target: [rechargeDay.collectorId, rechargeDay.date], set: { state: sql`excluded.state`, summary: sql`excluded.summary`, closedAt: new Date() } })
    }
    return out.length
}

/** What a collection customer owes for recharge udharo (their profile is `cust:<customerId>`), all time. */
export async function customerRechargeOwed(collectorId: string, customerId: string): Promise<number> {
    const [row] = await db
        .select({ owed: sql<string>`coalesce(sum(case when ${rechargeEntry.kind} = 'sell' then ${rechargeEntry.amount} else -${rechargeEntry.amount} end), 0)` })
        .from(rechargeEntry)
        .innerJoin(rechargePerson, eq(rechargePerson.id, rechargeEntry.personId))
        .where(and(eq(rechargeEntry.collectorId, collectorId), eq(rechargePerson.customerId, customerId), inArray(rechargeEntry.kind, ["sell", "payback"])))
    return Math.round(Number(row?.owed ?? 0) * 100) / 100
}

/** Every collector who has ever used Recharge (for the nightly close). */
export async function rechargeCollectors(): Promise<string[]> {
    const rows = await db.selectDistinct({ id: rechargeEntry.collectorId }).from(rechargeEntry)
    return rows.map((r) => r.id)
}
