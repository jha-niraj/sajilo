"use server"

import { db, eq, asc } from "@repo/db"
import { customer } from "@repo/db/schema"
import { adToBs, bsMonthRange, bsToAd, addAdDays, diffAdDays } from "@repo/calendar"
import { actionCollectorId } from "@/lib/session"
import { nepalToday } from "@/lib/today"
import { entriesUpTo, getSettings, receivedBetween } from "@/lib/collection/server"
import { buildLedger } from "@/lib/money/ledger"

export interface MonthReport {
    year: number
    month: number
    start: string
    end: string
    grandTotal: number
    customers: {
        id: string
        name: string
        bankAccountNo: string | null
        defaultAmount: number
        isActive: boolean
        received: number
        daysPaid: number
        dueNow: number
    }[]
    days: { date: string; total: number; people: number }[]
    totalDueNow: number
    collectorName: string
}

export async function fetchMonthReport(year?: number, month?: number): Promise<MonthReport> {
    const collectorId = await actionCollectorId()
    const today = nepalToday()
    const bsToday = adToBs(today)
    const y = year ?? bsToday.year
    const m = month ?? bsToday.month
    const range = bsMonthRange(y, m)

    const [customers, received, me] = await Promise.all([
        db.select().from(customer).where(eq(customer.collectorId, collectorId)).orderBy(asc(customer.routeOrder)),
        receivedBetween(collectorId, range.start, range.end),
        db.query.user.findFirst({ where: (u, { eq }) => eq(u.id, collectorId), columns: { name: true } }),
    ])

    const entries = await entriesUpTo(
        customers.map((c) => c.id),
        today,
    )

    const perCustomer = new Map<string, { received: number; daysPaid: number }>()
    const perDay = new Map<string, { total: number; people: number }>()
    for (const r of received) {
        const pc = perCustomer.get(r.customerId) ?? { received: 0, daysPaid: 0 }
        pc.received += r.amountReceived
        pc.daysPaid += 1
        perCustomer.set(r.customerId, pc)
        const pd = perDay.get(r.date) ?? { total: 0, people: 0 }
        pd.total += r.amountReceived
        pd.people += 1
        perDay.set(r.date, pd)
    }

    const rows = customers
        .map((c) => {
            const l = buildLedger(
                entries.filter((e) => e.customerId === c.id),
                today,
            )
            const pc = perCustomer.get(c.id) ?? { received: 0, daysPaid: 0 }
            return {
                id: c.id,
                name: c.name,
                bankAccountNo: c.bankAccountNo,
                defaultAmount: c.defaultAmount,
                isActive: c.isActive,
                received: pc.received,
                daysPaid: pc.daysPaid,
                dueNow: l.arrears + l.todayDue,
            }
        })
        .filter((r) => r.isActive || r.received > 0)

    const lastDay = range.end < today ? range.end : today
    const days: MonthReport["days"] = []
    if (range.start <= today) {
        for (let d = range.start; d <= lastDay; d = addAdDays(d, 1)) {
            const pd = perDay.get(d) ?? { total: 0, people: 0 }
            days.push({ date: d, ...pd })
        }
    }

    return {
        year: y,
        month: m,
        start: range.start,
        end: range.end,
        grandTotal: rows.reduce((s, r) => s + r.received, 0),
        customers: rows,
        days,
        totalDueNow: rows.reduce((s, r) => s + r.dueNow, 0),
        collectorName: me?.name ?? "",
    }
}

export interface DeadlineInfo {
    deadline: string
    daysLeft: number
    remind: boolean
    monthTotal: number
}

export async function fetchDeadline(): Promise<DeadlineInfo> {
    const collectorId = await actionCollectorId()
    const today = nepalToday()
    const bs = adToBs(today)
    const settings = await getSettings(collectorId)
    const range = bsMonthRange(bs.year, bs.month)
    const deadlineIn = (year: number, month: number) => {
        const days = bsMonthRange(year, month).days
        const day = settings.bankDeadlineDay ? Math.min(settings.bankDeadlineDay, days) : days
        return bsToAd({ year, month, day })
    }
    let deadline = deadlineIn(bs.year, bs.month)
    if (deadline < today) deadline = bs.month === 12 ? deadlineIn(bs.year + 1, 1) : deadlineIn(bs.year, bs.month + 1)
    const daysLeft = diffAdDays(today, deadline)
    const received = await receivedBetween(collectorId, range.start, range.end)
    return {
        deadline,
        daysLeft,
        remind: daysLeft <= settings.reminderDaysBefore,
        monthTotal: received.reduce((s, r) => s + r.amountReceived, 0),
    }
}
