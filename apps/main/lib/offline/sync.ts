"use client"

import { fetchDaySnapshot } from "@/actions/collection.action"
import { syncOutbox } from "@/actions/sync.action"
import type { DaySnapshot, MarkOp } from "@/lib/collection/types"
import { applyOpToSnapshot, opKind, type QueuedOp } from "./ops"
import { idb, type OutboxOp } from "./store"
import { isNetworkError, isOnline, setReachable } from "./network"

export { isOnline }

type Listener = () => void

const state = { syncing: false, lastError: null as string | null, rejected: 0 }
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

export function newOpId(): string {
    return typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => (Number(c) ^ (Math.random() * 16) >> (Number(c) / 4)).toString(16))
}

type NewOp = QueuedOp extends infer T ? (T extends { opId: string } ? Omit<T, "opId"> : never) : never

/**
 * Saves a change on the phone first, then tries to send it. Resolves once the first send attempt
 * is over: `synced` says whether the server already has it, so the screen can say "saved" or
 * "saved on this phone".
 */
export async function queueOp(input: NewOp, opts: { wait?: number } = {}): Promise<{ opId: string; synced: boolean }> {
    const op = { ...input, opId: newOpId(), createdAt: Date.now(), tries: 0 } as OutboxOp
    const db = idb()
    await db.transaction("rw", db.snapshots, db.outbox, async () => {
        await supersede(op)
        await db.outbox.put(op)
        const days = await db.snapshots.toArray()
        for (const snap of days) {
            const next = applyOpToSnapshot(snap, op)
            if (next !== snap) await db.snapshots.put(next)
        }
    })
    const attempt = flush()
    if (!opts.wait || !isOnline()) {
        void attempt
        return { opId: op.opId, synced: false }
    }
    await Promise.race([attempt, new Promise((r) => setTimeout(r, opts.wait))])
    const still = await db.outbox.get(op.opId)
    return { opId: op.opId, synced: !still }
}

/** Only the latest tick per customer-day and the latest close/reopen per day need sending. */
async function supersede(op: OutboxOp) {
    const db = idb()
    const kind = opKind(op)
    if (kind === "mark") {
        const m = op as MarkOp
        await db.outbox
            .where("date")
            .equals(m.date)
            .filter((o) => opKind(o) === "mark" && (o as MarkOp).customerId === m.customerId)
            .delete()
    } else if (kind === "closeDay" || kind === "reopenDay") {
        const date = (op as { date: string }).date
        await db.outbox
            .where("date")
            .equals(date)
            .filter((o) => opKind(o) === "closeDay" || opKind(o) === "reopenDay")
            .delete()
    }
}

/** Kept for the Today screen, which ticks a lot. */
export function recordMark(input: Omit<MarkOp, "opId" | "markedAt">): Promise<{ opId: string; synced: boolean }> {
    return queueOp({ kind: "mark", ...input, markedAt: new Date().toISOString() })
}

/**
 * After a new version goes live, a phone still running the old page calls server actions the
 * server no longer has. The queue is safe on the phone, so reload once to pick up the new version.
 */
function reloadIfOutdated(e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    if (!/server action/i.test(msg) || !/not found|failed to find/i.test(msg)) return
    const last = Number(sessionStorage.getItem("sajilo.versionReload") ?? 0)
    if (Date.now() - last < 60_000) return
    sessionStorage.setItem("sajilo.versionReload", String(Date.now()))
    window.location.reload()
}

function toWire(o: OutboxOp): QueuedOp {
    const op: Partial<OutboxOp> = { ...o }
    delete op.createdAt
    delete op.tries
    return op as QueuedOp
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
    if (typeof navigator !== "undefined" && !navigator.onLine) return
    const db = idb()
    const ops = await db.outbox.orderBy("createdAt").limit(150).toArray()
    if (ops.length === 0) return
    state.syncing = true
    emit()
    let more = false
    try {
        const res = await syncOutbox(ops.map(toWire))
        setReachable(true)
        const done = [...res.applied, ...res.rejected.map((r) => r.opId)]
        await db.outbox.bulkDelete(done)
        state.lastError = res.stoppedAt ? "server" : null
        if (res.rejected.length) {
            state.rejected += res.rejected.length
            window.dispatchEvent(new CustomEvent("sajilo:rejected", { detail: res.rejected.length }))
        }
        if (res.stoppedAt) await db.outbox.update(res.stoppedAt, { tries: (ops.find((o) => o.opId === res.stoppedAt)?.tries ?? 0) + 1 })
        if (res.applied.length || res.rejected.length) {
            const dates = new Set(ops.filter((o) => done.includes(o.opId) && "date" in o).map((o) => (o as { date: string }).date))
            for (const d of dates) await refreshDay(d)
            window.dispatchEvent(new Event("sajilo:synced"))
        }
        more = !res.stoppedAt && ops.length === 150
    } catch (e) {
        if (isNetworkError(e)) setReachable(false)
        state.lastError = e instanceof Error ? e.message : String(e)
        reloadIfOutdated(e)
        await db.outbox.bulkUpdate(ops.map((o) => ({ key: o.opId, changes: { tries: o.tries + 1 } })))
    } finally {
        state.syncing = false
        emit()
    }
    if (more) void flush()
}

/** Pull the day from the server and lay everything still unsent on top. */
export async function refreshDay(date?: string): Promise<DaySnapshot | null> {
    if (typeof navigator !== "undefined" && !navigator.onLine) return null
    try {
        const fresh = await fetchDaySnapshot(date)
        setReachable(true)
        const db = idb()
        const pending = await db.outbox.orderBy("createdAt").toArray()
        const merged = pending.reduce((snap, op) => applyOpToSnapshot(snap, op), fresh)
        await db.snapshots.put(merged)
        await db.meta.put({ key: "lastDate", value: fresh.date })
        return merged
    } catch (e) {
        if (isNetworkError(e)) setReachable(false)
        state.lastError = e instanceof Error ? e.message : String(e)
        emit()
        return null
    }
}

/**
 * A day the phone never saw (first tick of the morning with no signal): start it from the most
 * recent saved day. Dues carried in may be a day behind until the server answers; ticks are exact.
 */
export async function ensureLocalDay(date: string): Promise<void> {
    const db = idb()
    if (await db.snapshots.get(date)) return
    const earlier = await db.snapshots.where("date").below(date).reverse().first()
    if (!earlier) return
    const pending = await db.outbox.orderBy("createdAt").toArray()
    const base: DaySnapshot = {
        date,
        isWorkingDay: true,
        lockedAt: null,
        countedCash: null,
        customers: earlier.customers,
        entries: [],
        carry: earlier.carry,
        fetchedAt: earlier.fetchedAt,
    }
    await db.snapshots.put(pending.reduce((snap, op) => applyOpToSnapshot(snap, op), base))
}

async function ping() {
    try {
        const res = await fetch("/manifest.webmanifest", { method: "HEAD", cache: "no-store" })
        if (res.ok) setReachable(true)
    } catch {
        // still unreachable
    }
}

let started = false

/** Keep trying in the background: when the phone comes online, the app is reopened, and on a timer. */
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
    // Every 15s while something is waiting; this is also how a "no signal" spell ends on weak wifi.
    setInterval(async () => {
        if ((await idb().outbox.count()) > 0) return void flush()
        if (navigator.onLine && !isOnline()) await ping()
    }, 15_000)
    void flush()
}
