"use client"

import Dexie, { type Table } from "dexie"
import type { DaySnapshot, MarkOp } from "@/lib/collection/types"

export interface OutboxOp extends MarkOp {
    createdAt: number
    tries: number
}

export interface MetaRow {
    key: string
    value: unknown
}

class SajiloDB extends Dexie {
    snapshots!: Table<DaySnapshot, string>
    outbox!: Table<OutboxOp, string>
    meta!: Table<MetaRow, string>

    constructor() {
        super("sajilo")
        this.version(1).stores({
            snapshots: "date",
            outbox: "opId, createdAt, date",
            meta: "key",
        })
    }
}

let instance: SajiloDB | null = null

export function idb(): SajiloDB {
    if (!instance) instance = new SajiloDB()
    return instance
}

/** Apply a mark to a snapshot in place (used both locally and when replaying the outbox). */
export function applyMarkToSnapshot(snap: DaySnapshot, op: MarkOp): DaySnapshot {
    if (snap.date !== op.date) return snap
    const entries = [...snap.entries]
    const i = entries.findIndex((e) => e.customerId === op.customerId)
    const c = snap.customers.find((x) => x.id === op.customerId)
    const next = {
        customerId: op.customerId,
        date: op.date,
        expectedAmount: i >= 0 ? entries[i]!.expectedAmount : (c?.defaultAmount ?? 0),
        status: op.status,
        amountReceived: op.amountReceived,
        markedAt: op.markedAt,
        note: op.note ?? null,
    }
    if (i >= 0) entries[i] = next
    else entries.push(next)
    return { ...snap, entries }
}

/** Remove everything stored on this phone (used on sign out). */
export async function clearLocalData() {
    try {
        await idb().delete()
    } catch {
        // already gone
    }
    instance = null
}
