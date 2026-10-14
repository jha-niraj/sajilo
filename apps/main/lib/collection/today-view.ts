import type { CarryIn, EntryStatus } from "./types"

// Same rules as buildLedger (lib/money/ledger.ts), applied to one new day on top of what was
// owed before it. Runs on the phone so the row updates instantly, even offline.

export interface TodayView {
    expected: number
    received: number
    /** Part of today's cash that covered today */
    toToday: number
    /** Part of today's cash that settled older days */
    toOld: number
    /** Old days fully settled by today's cash */
    oldDaysSettled: number
    /** Part of today's cash kept as advance */
    toAdvance: number
    todayOutstanding: number
    arrears: number
    arrearsDays: number
    advance: number
}

export function computeTodayView(
    carry: Pick<CarryIn, "openDays" | "advance"> | undefined,
    expectedAmount: number,
    status: EntryStatus,
    received: number,
): TodayView {
    const openDays = (carry?.openDays ?? []).map((d) => ({ ...d }))
    let advance = carry?.advance ?? 0
    const expected = status === "holiday" ? 0 : Math.max(0, expectedAmount)
    const r = Math.max(0, received)

    const toToday = Math.min(r, expected)
    let todayOutstanding = expected - toToday
    let extra = r - toToday

    let toOld = 0
    let oldDaysSettled = 0
    for (const d of openDays) {
        if (extra <= 0) break
        const pay = Math.min(extra, d.outstanding)
        d.outstanding -= pay
        extra -= pay
        toOld += pay
        if (d.outstanding === 0) oldDaysSettled++
    }

    const toAdvance = extra
    advance += extra

    if (todayOutstanding > 0 && advance > 0) {
        const pay = Math.min(advance, todayOutstanding)
        todayOutstanding -= pay
        advance -= pay
    }

    const remaining = openDays.filter((d) => d.outstanding > 0)
    return {
        expected,
        received: r,
        toToday,
        toOld,
        oldDaysSettled,
        toAdvance,
        todayOutstanding,
        arrears: remaining.reduce((s, d) => s + d.outstanding, 0),
        arrearsDays: remaining.length,
        advance,
    }
}
