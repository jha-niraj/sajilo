import "server-only"
import { cache } from "react"
import { db, and, eq, gte, lte, inArray, asc, sql } from "@repo/db"
import { customer, collectionEntry, collectionDay, collectorSettings, holiday } from "@repo/db/schema"
import { addAdDays, adDayOfWeek, diffAdDays } from "@repo/calendar"
import { buildLedger } from "@/lib/money/ledger"
import type { ApplyOpsResult, CarryIn, DaySnapshot, MarkOp, SnapshotEntry } from "./types"

const MAX_BACKFILL_DAYS = 400
const INSERT_CHUNK = 500

/** Once per request (React `cache`): pages that need settings in two places read them once. */
export const getSettings = cache(async (collectorId: string) => {
    const row = await db.query.collectorSettings.findFirst({ where: eq(collectorSettings.userId, collectorId) })
    if (row) return row
    const [created] = await db.insert(collectorSettings).values({ userId: collectorId }).onConflictDoNothing().returning()
    return created ?? (await db.query.collectorSettings.findFirst({ where: eq(collectorSettings.userId, collectorId) }))!
})

type ActiveCustomer = typeof customer.$inferSelect

/** Active customers in route order, and the last day each already has a row for. */
function readRoute(collectorId: string) {
    return [
        db
            .select()
            .from(customer)
            .where(and(eq(customer.collectorId, collectorId), eq(customer.isActive, true)))
            .orderBy(asc(customer.routeOrder), asc(customer.createdAt)),
        db
            .select({ customerId: collectionEntry.customerId, last: sql<string>`max(${collectionEntry.date})` })
            .from(collectionEntry)
            .where(eq(collectionEntry.collectorId, collectorId))
            .groupBy(collectionEntry.customerId),
    ] as const
}

/**
 * Make sure every active customer has a row for every day from their start (or last row) up to
 * `upTo`. A day nobody opened the app is still a collection day, so missed days become dues.
 * Writes only what is missing: in practice the first open of a day; every later open writes nothing.
 */
export async function ensureEntries(collectorId: string, upTo: string): Promise<void> {
    const [route, lastDates] = readRoute(collectorId)
    const [settings, customers, last] = await Promise.all([getSettings(collectorId), route, lastDates])
    await fillMissing(collectorId, upTo, settings, customers, last)
}

async function fillMissing(
    collectorId: string,
    upTo: string,
    settings: { workingDays: number[] },
    customers: Pick<ActiveCustomer, "id" | "defaultAmount" | "startDate">[],
    lastDates: { customerId: string; last: string }[],
): Promise<void> {
    if (customers.length === 0) return

    const lastByCustomer = new Map(lastDates.map((r) => [r.customerId, r.last]))
    const earliest = customers.reduce((min, c) => {
        const from = lastByCustomer.get(c.id) ? addAdDays(lastByCustomer.get(c.id)!, 1) : c.startDate
        return from < min ? from : min
    }, upTo)
    if (earliest > upTo) return

    const holidayRows = await db
        .select({ date: holiday.date })
        .from(holiday)
        .where(and(eq(holiday.collectorId, collectorId), gte(holiday.date, earliest), lte(holiday.date, upTo)))
    const holidays = new Set(holidayRows.map((h) => h.date))
    const working = new Set(settings.workingDays)

    const rows: (typeof collectionEntry.$inferInsert)[] = []
    for (const c of customers) {
        const last = lastByCustomer.get(c.id)
        let from = last ? addAdDays(last, 1) : c.startDate
        if (diffAdDays(from, upTo) > MAX_BACKFILL_DAYS) from = addAdDays(upTo, -MAX_BACKFILL_DAYS)
        for (let d = from; d <= upTo; d = addAdDays(d, 1)) {
            const off = !working.has(adDayOfWeek(d)) || holidays.has(d)
            rows.push({
                collectorId,
                customerId: c.id,
                date: d,
                expectedAmount: c.defaultAmount,
                status: off ? "holiday" : "pending",
            })
        }
    }
    await insertChunks(rows)
}

async function insertChunks(rows: (typeof collectionEntry.$inferInsert)[]) {
    for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
        await db.insert(collectionEntry).values(rows.slice(i, i + INSERT_CHUNK)).onConflictDoNothing()
    }
}

/** Create any missing day rows for these customers between two dates (used after importing old pages). */
export async function fillEntries(collectorId: string, customerIds: string[], from: string, to: string): Promise<void> {
    if (customerIds.length === 0 || from > to) return
    const [settings, customers, holidayRows] = await Promise.all([
        getSettings(collectorId),
        db
            .select({ id: customer.id, defaultAmount: customer.defaultAmount })
            .from(customer)
            .where(and(eq(customer.collectorId, collectorId), inArray(customer.id, customerIds))),
        db
            .select({ date: holiday.date })
            .from(holiday)
            .where(and(eq(holiday.collectorId, collectorId), gte(holiday.date, from), lte(holiday.date, to))),
    ])
    const holidays = new Set(holidayRows.map((h) => h.date))
    const working = new Set(settings.workingDays)
    const rows: (typeof collectionEntry.$inferInsert)[] = []
    for (const c of customers) {
        for (let d = from; d <= to; d = addAdDays(d, 1)) {
            const off = !working.has(adDayOfWeek(d)) || holidays.has(d)
            rows.push({ collectorId, customerId: c.id, date: d, expectedAmount: c.defaultAmount, status: off ? "holiday" : "pending" })
        }
    }
    await insertChunks(rows)
}

function toSnapshotEntry(e: typeof collectionEntry.$inferSelect): SnapshotEntry {
    return {
        customerId: e.customerId,
        date: e.date,
        expectedAmount: e.expectedAmount,
        status: e.status,
        amountReceived: e.amountReceived,
        markedAt: e.markedAt ? e.markedAt.toISOString() : null,
        note: e.note,
    }
}

/**
 * Today's screen in two round trips: one wave reads settings, the route, each customer's last row
 * and the day together (the "anything missing?" check rides along for free; missing days are filled
 * only when there are some, i.e. the first open of a day), then the entries. It used to check, then
 * read settings and customers again, then the entries: three trips in a row.
 */
export async function getDaySnapshot(collectorId: string, date: string): Promise<DaySnapshot> {
    const [route, lastDates] = readRoute(collectorId)
    const [settings, active, last, day] = await Promise.all([
        getSettings(collectorId),
        route,
        lastDates,
        db.query.collectionDay.findFirst({
            where: and(eq(collectionDay.collectorId, collectorId), eq(collectionDay.date, date)),
        }),
    ])
    await fillMissing(collectorId, date, settings, active, last)
    const customers = active.filter((c) => c.startDate <= date)

    const ids = customers.map((c) => c.id)
    const entries = ids.length
        ? await db
              .select()
              .from(collectionEntry)
              .where(and(inArray(collectionEntry.customerId, ids), lte(collectionEntry.date, date)))
        : []

    const byCustomer = new Map<string, (typeof entries)[number][]>()
    for (const e of entries) {
        const list = byCustomer.get(e.customerId) ?? []
        list.push(e)
        byCustomer.set(e.customerId, list)
    }

    const carry: CarryIn[] = []
    const todayEntries: SnapshotEntry[] = []
    for (const c of customers) {
        const list = byCustomer.get(c.id) ?? []
        const before = list.filter((e) => e.date < date)
        const ledger = buildLedger(before, date)
        carry.push({
            customerId: c.id,
            openDays: ledger.days.filter((d) => d.outstanding > 0).map((d) => ({ date: d.date, outstanding: d.outstanding })),
            advance: ledger.advance,
        })
        const today = list.find((e) => e.date === date)
        if (today) todayEntries.push(toSnapshotEntry(today))
    }

    return {
        date,
        isWorkingDay: settings.workingDays.includes(adDayOfWeek(date)),
        lockedAt: day?.lockedAt ? day.lockedAt.toISOString() : null,
        countedCash: day?.countedCash ?? null,
        customers: customers.map((c) => ({
            id: c.id,
            name: c.name,
            phone: c.phone,
            bankAccountNo: c.bankAccountNo,
            defaultAmount: c.defaultAmount,
            routeOrder: c.routeOrder,
            aliases: c.aliases,
        })),
        entries: todayEntries,
        carry,
        fetchedAt: new Date().toISOString(),
    }
}

const VALID_STATUS = new Set(["pending", "paid", "shop_closed", "no_money", "holiday"])

/**
 * Apply phone-side marks. Each op is one upsert of one (customer, day) row, so a retry is
 * harmless and an older op can never overwrite a newer one (markedAt guard).
 */
export async function applyOps(collectorId: string, ops: MarkOp[]): Promise<ApplyOpsResult> {
    const result: ApplyOpsResult = { applied: [], rejected: [] }
    if (ops.length === 0) return result

    const customerIds = [...new Set(ops.map((o) => o.customerId))]
    const dates = [...new Set(ops.map((o) => o.date))]
    const [owned, lockedDays] = await Promise.all([
        db
            .select({ id: customer.id, defaultAmount: customer.defaultAmount })
            .from(customer)
            .where(and(eq(customer.collectorId, collectorId), inArray(customer.id, customerIds))),
        db
            .select({ date: collectionDay.date })
            .from(collectionDay)
            .where(
                and(
                    eq(collectionDay.collectorId, collectorId),
                    inArray(collectionDay.date, dates),
                    sql`${collectionDay.lockedAt} is not null`,
                ),
            ),
    ])
    const amounts = new Map(owned.map((c) => [c.id, c.defaultAmount]))
    const locked = new Set(lockedDays.map((d) => d.date))

    const writes = []
    for (const op of ops) {
        if (!amounts.has(op.customerId)) {
            result.rejected.push({ opId: op.opId, reason: "unknown_customer" })
            continue
        }
        if (locked.has(op.date)) {
            result.rejected.push({ opId: op.opId, reason: "locked" })
            continue
        }
        const amount = Math.round(Number(op.amountReceived))
        if (!VALID_STATUS.has(op.status) || !Number.isFinite(amount) || amount < 0 || amount > 10_000_000 || !/^\d{4}-\d{2}-\d{2}$/.test(op.date)) {
            result.rejected.push({ opId: op.opId, reason: "invalid" })
            continue
        }
        const markedAt = new Date(op.markedAt)
        writes.push(
            db
                .insert(collectionEntry)
                .values({
                    collectorId,
                    customerId: op.customerId,
                    date: op.date,
                    expectedAmount: amounts.get(op.customerId)!,
                    status: op.status,
                    amountReceived: amount,
                    markedAt,
                    clientOpId: op.opId,
                    note: op.note ?? null,
                })
                .onConflictDoUpdate({
                    target: [collectionEntry.customerId, collectionEntry.date],
                    set: {
                        status: op.status,
                        amountReceived: amount,
                        markedAt,
                        clientOpId: op.opId,
                        note: op.note ?? null,
                        updatedAt: new Date(),
                    },
                    setWhere: sql`${collectionEntry.markedAt} is null or ${collectionEntry.markedAt} <= ${markedAt}`,
                }),
        )
        result.applied.push(op.opId)
    }

    if (writes.length > 0) {
        await db.batch(writes as [(typeof writes)[number], ...(typeof writes)[number][]])
    }
    return result
}

export async function setDayLock(collectorId: string, date: string, countedCash: number | null, lock: boolean) {
    await db
        .insert(collectionDay)
        .values({ collectorId, date, countedCash, lockedAt: lock ? new Date() : null })
        .onConflictDoUpdate({
            target: [collectionDay.collectorId, collectionDay.date],
            set: { countedCash, lockedAt: lock ? new Date() : null, updatedAt: new Date() },
        })
}

/** All entries of the given customers up to `upTo` (for ledgers). */
export async function entriesUpTo(customerIds: string[], upTo: string) {
    if (customerIds.length === 0) return []
    return db
        .select()
        .from(collectionEntry)
        .where(and(inArray(collectionEntry.customerId, customerIds), lte(collectionEntry.date, upTo)))
}

/** Once per request: the month report and the printed register read the same range. */
export const receivedBetween = cache(async (collectorId: string, start: string, end: string) => {
    return db
        .select({
            customerId: collectionEntry.customerId,
            date: collectionEntry.date,
            amountReceived: collectionEntry.amountReceived,
        })
        .from(collectionEntry)
        .where(
            and(
                eq(collectionEntry.collectorId, collectorId),
                gte(collectionEntry.date, start),
                lte(collectionEntry.date, end),
                sql`${collectionEntry.amountReceived} > 0`,
            ),
        )
})

