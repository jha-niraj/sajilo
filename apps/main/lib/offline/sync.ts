"use client"

import { fetchDaySnapshot, syncMarks } from "@/actions/collection.action"
import type { DaySnapshot, MarkOp } from "@/lib/collection/types"
import { applyMarkToSnapshot, idb, type OutboxOp } from "./store"

type Listener = () => void

const state = { syncing: false, lastError: null as string | null, lockedRejections: 0 }
const listeners = new Set<Listener>()

function emit() {
    for (const l of listeners) l()
}

export function subscribeSync(l: Listener): () => void {
    listeners.add(l)
    return () => listeners.delete(l)
}

export function getSyncState() {
    return state
}

export function isOnline(): boolean {
    return typeof navigator === "undefined" ? true : navigator.onLine
}

function newOpId(): string {
    return typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

/** Save a mark on the phone right away, then try to send it. */
export async function recordMark(input: Omit<MarkOp, "opId" | "markedAt">): Promise<void> {
    const op: OutboxOp = { ...input, opId: newOpId(), markedAt: new Date().toISOString(), createdAt: Date.now(), tries: 0 }
    const db = idb()
    await db.transaction("rw", db.snapshots, db.outbox, async () => {
        const snap = await db.snapshots.get(op.date)
        if (snap) await db.snapshots.put(applyMarkToSnapshot(snap, op))
        // Only the latest mark per customer-day matters; drop older queued ones.
        await db.outbox
            .where("date")
            .equals(op.date)
            .filter((o) => o.customerId === op.customerId)
            .delete()
        await db.outbox.put(op)
    })
    void flush()
}

let flushing: Promise<void> | null = null

export function flush(): Promise<void> {
    if (flushing) return flushing
    flushing = doFlush().finally(() => {
        flushing = null
    })
    return flushing
}

async function doFlush() {
    if (!isOnline()) return
    const db = idb()
    const ops = await db.outbox.orderBy("createdAt").limit(200).toArray()
    if (ops.length === 0) return
    state.syncing = true
    emit()
    try {
        const res = await syncMarks(ops.map((o) => ({ opId: o.opId, customerId: o.customerId, date: o.date, status: o.status, amountReceived: o.amountReceived, note: o.note, markedAt: o.markedAt })))
        const done = [...res.applied, ...res.rejected.map((r) => r.opId)]
        await db.outbox.bulkDelete(done)
        state.lastError = null
        if (res.applied.length) window.dispatchEvent(new Event("sajilo:synced"))
        if (res.rejected.some((r) => r.reason === "locked")) {
            state.lockedRejections++
            const dates = new Set(ops.filter((o) => res.rejected.some((r) => r.opId === o.opId)).map((o) => o.date))
            for (const d of dates) await refreshDay(d)
        }
    } catch (e) {
        state.lastError = e instanceof Error ? e.message : String(e)
        await db.outbox.bulkUpdate(ops.map((o) => ({ key: o.opId, changes: { tries: o.tries + 1 } })))
    } finally {
        state.syncing = false
        emit()
    }
    const left = await db.outbox.count()
    if (left > 0 && state.lastError === null) void flush()
}

/** Pull the day from the server and lay any still-unsent marks on top. */
export async function refreshDay(date?: string): Promise<DaySnapshot | null> {
    if (!isOnline()) return null
    try {
        const fresh = await fetchDaySnapshot(date)
        const db = idb()
        const pending = await db.outbox.where("date").equals(fresh.date).sortBy("createdAt")
        const merged = pending.reduce((snap, op) => applyMarkToSnapshot(snap, op), fresh)
        await db.snapshots.put(merged)
        await db.meta.put({ key: "lastDate", value: fresh.date })
        return merged
    } catch (e) {
        state.lastError = e instanceof Error ? e.message : String(e)
        emit()
        return null
    }
}

let started = false

/** Keep trying in the background: when the phone comes online, the app is reopened, or every 30s. */
export function startSyncLoop() {
    if (started || typeof window === "undefined") return
    started = true
    window.addEventListener("online", () => {
        emit()
        void flush()
    })
    window.addEventListener("offline", emit)
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") void flush()
    })
    setInterval(() => void flush(), 30_000)
    void flush()
}
