"use client"

import Dexie, { type Table } from "dexie"
import type { DaySnapshot } from "@/lib/collection/types"
import type { QueuedOp } from "./ops"

export type OutboxOp = QueuedOp & {
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
        this.version(2).stores({
            snapshots: "date",
            outbox: "opId, createdAt, date, kind",
            meta: "key",
        })
    }
}

let instance: SajiloDB | null = null

export function idb(): SajiloDB {
    if (!instance) instance = new SajiloDB()
    return instance
}

/** Remove everything stored on this phone (used on sign out). */
export async function clearLocalData() {
    try {
        await idb().delete()
    } catch {
        // already gone
    }
    instance = null
    // Saved pages hold his numbers too.
    try {
        const keys = await caches.keys()
        await Promise.all(keys.filter((k) => k.startsWith("sajilo-pages")).map((k) => caches.delete(k)))
    } catch {
        // no cache storage (private mode)
    }
}
