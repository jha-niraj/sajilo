"use server"

import { db, and, eq, asc } from "@repo/db"
import { customer } from "@repo/db/schema"
import { adToBs, bsMonthRange } from "@repo/calendar"
import { actionCollectorId } from "@/lib/session"
import { nepalToday } from "@/lib/today"
import { applyOps, entriesUpTo, getDaySnapshot, setDayLock } from "@/lib/collection/server"
import { buildLedger, isPaidLate } from "@/lib/money/ledger"
import type { ApplyOpsResult, DaySnapshot, MarkOp } from "@/lib/collection/types"

export async function fetchDaySnapshot(date?: string): Promise<DaySnapshot> {
    const collectorId = await actionCollectorId()
    const today = nepalToday()
    const d = date && date <= today ? date : today
    return getDaySnapshot(collectorId, d)
}

export async function syncMarks(ops: MarkOp[]): Promise<ApplyOpsResult> {
    const collectorId = await actionCollectorId()
    return applyOps(collectorId, ops.slice(0, 500))
}

export async function closeDay(date: string, countedCash: number | null) {
    const collectorId = await actionCollectorId()
    await setDayLock(collectorId, date, countedCash, true)
    return { ok: true }
}

export async function reopenDay(date: string) {
    const collectorId = await actionCollectorId()
    await setDayLock(collectorId, date, null, false)
    return { ok: true }
}

export interface CustomerHistoryDay {
    date: string
    status: string
    expected: number
    received: number
    outstanding: number
    paidLate: boolean
    settledOn: string | null
    toOldDays: number
}

export interface CustomerHistory {
    customer: { id: string; name: string; phone: string | null; bankAccountNo: string | null; defaultAmount: number; startDate: string; isActive: boolean }
    year: number
    month: number
    days: CustomerHistoryDay[]
    monthReceived: number
    arrears: number
    arrearsDays: number
    advance: number
}

export async function fetchCustomerHistory(customerId: string, year?: number, month?: number): Promise<CustomerHistory | null> {
    const collectorId = await actionCollectorId()
    const today = nepalToday()
    const c = await db.query.customer.findFirst({
        where: and(eq(customer.id, customerId), eq(customer.collectorId, collectorId)),
    })
    if (!c) return null

    const bsToday = adToBs(today)
    const y = year ?? bsToday.year
    const m = month ?? bsToday.month
    const range = bsMonthRange(y, m)

    const entries = await entriesUpTo([c.id], today)
    const ledger = buildLedger(entries, today)
    const days = ledger.days
        .filter((d) => d.date >= range.start && d.date <= range.end)
        .map((d) => ({
            date: d.date,
            status: d.status,
            expected: d.expected,
            received: d.received,
            outstanding: d.outstanding,
            paidLate: isPaidLate(d),
            settledOn: d.settlements.find((s) => s.byDate > d.date)?.byDate ?? null,
            toOldDays: d.extraToOldDays.reduce((s, x) => s + x.amount, 0),
        }))

    return {
        customer: {
            id: c.id,
            name: c.name,
            phone: c.phone,
            bankAccountNo: c.bankAccountNo,
            defaultAmount: c.defaultAmount,
            startDate: c.startDate,
            isActive: c.isActive,
        },
        year: y,
        month: m,
        days,
        monthReceived: days.reduce((s, d) => s + d.received, 0),
        arrears: ledger.arrears + ledger.todayDue,
        arrearsDays: ledger.arrearsDays,
        advance: ledger.advance,
    }
}

/** Current dues for every active customer (for month report + manage list). */
export async function fetchDues(): Promise<Record<string, { arrears: number; days: number; advance: number }>> {
    const collectorId = await actionCollectorId()
    const today = nepalToday()
    const customers = await db
        .select({ id: customer.id })
        .from(customer)
        .where(and(eq(customer.collectorId, collectorId)))
        .orderBy(asc(customer.routeOrder))
    const entries = await entriesUpTo(
        customers.map((c) => c.id),
        today,
    )
    const out: Record<string, { arrears: number; days: number; advance: number }> = {}
    for (const c of customers) {
        const l = buildLedger(
            entries.filter((e) => e.customerId === c.id),
            today,
        )
        out[c.id] = { arrears: l.arrears, days: l.arrearsDays, advance: l.advance }
    }
    return out
}

