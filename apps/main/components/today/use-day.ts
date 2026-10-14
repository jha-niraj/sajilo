"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useLiveQuery } from "dexie-react-hooks"
import { toNepalDateStr } from "@repo/calendar"
import { idb } from "@/lib/offline/store"
import { ensureLocalDay, recordMark, refreshDay } from "@/lib/offline/sync"
import { isOnline } from "@/lib/offline/network"
import { computeTodayView, type TodayView } from "@/lib/collection/today-view"
import type { DaySnapshot, EntryStatus, SnapshotCustomer, SnapshotEntry } from "@/lib/collection/types"

export interface DayRow {
    customer: SnapshotCustomer
    index: number
    entry: SnapshotEntry | null
    status: EntryStatus
    view: TodayView
    flagged: boolean
}

export function useNepalToday(): string {
    const [today, setToday] = useState(() => toNepalDateStr())
    useEffect(() => {
        const id = setInterval(() => setToday(toNepalDateStr()), 60_000)
        return () => clearInterval(id)
    }, [])
    return today
}

/** One collection day, read from the phone first, refreshed from the server when online. */
export function useDay(date: string) {
    const snapshot = useLiveQuery(() => idb().snapshots.get(date), [date])
    const [loading, setLoading] = useState(true)
    const [failed, setFailed] = useState(false)

    const reload = useCallback(async () => {
        setLoading(true)
        const res = await refreshDay(date)
        if (!res) await ensureLocalDay(date)
        setFailed(res === null && isOnline())
        setLoading(false)
    }, [date])

    useEffect(() => {
        void reload()
        const onVisible = () => document.visibilityState === "visible" && void reload()
        const onOnline = () => void reload()
        document.addEventListener("visibilitychange", onVisible)
        window.addEventListener("online", onOnline)
        return () => {
            document.removeEventListener("visibilitychange", onVisible)
            window.removeEventListener("online", onOnline)
        }
    }, [reload])

    const rows = useMemo(() => (snapshot ? buildRows(snapshot) : []), [snapshot])

    const totals = useMemo(() => {
        let collected = 0
        let expected = 0
        let done = 0
        let counted = 0
        for (const r of rows) {
            collected += r.view.received
            if (r.status === "holiday") continue
            counted++
            expected += r.view.expected
            if (r.status !== "pending") done++
        }
        return { collected, expected, done, total: counted }
    }, [rows])

    const mark = useCallback(
        (customerId: string, status: EntryStatus, amountReceived: number, note?: string | null) =>
            recordMark({ customerId, date, status, amountReceived, note: note ?? null }),
        [date],
    )

    return { snapshot: snapshot as DaySnapshot | undefined, rows, totals, loading, failed, reload, mark }
}

export function buildRows(snap: DaySnapshot): DayRow[] {
    const entryBy = new Map(snap.entries.map((e) => [e.customerId, e]))
    const carryBy = new Map(snap.carry.map((c) => [c.customerId, c]))
    const rows: DayRow[] = snap.customers.map((c, index) => {
        const entry = entryBy.get(c.id) ?? null
        const status: EntryStatus = entry?.status ?? "pending"
        const view = computeTodayView(carryBy.get(c.id), entry?.expectedAmount ?? c.defaultAmount, status, entry?.amountReceived ?? 0)
        return { customer: c, index, entry, status, view, flagged: false }
    })
    // A row is "forgotten?" when someone later on the route is already marked.
    let laterMarked = false
    for (let i = rows.length - 1; i >= 0; i--) {
        const r = rows[i]!
        if (r.status === "pending" && laterMarked) r.flagged = true
        if (r.status !== "pending" && r.status !== "holiday") laterMarked = true
    }
    return rows
}
