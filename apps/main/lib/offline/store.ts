"use client"

import Dexie, { type Table } from "dexie"
import type { DaySnapshot } from "@/lib/collection/types"
import type { QueuedOp } from "./ops"

export type OutboxOp = QueuedOp & {
    createdAt: number
    tries: number
}

/** Something he said offline that the phone could not understand: the recording or the words, kept to go through once online. */
export interface ClipRow {
    id: string
    /** the day he said it */
    date: string
    createdAt: number
    audio?: Blob
    text?: string
}

export interface MetaRow {
    key: string
    value: unknown
}

class SajiloDB extends Dexie {
    snapshots!: Table<DaySnapshot, string>
    outbox!: Table<OutboxOp, string>
    meta!: Table<MetaRow, string>
    clips!: Table<ClipRow, string>

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
        this.version(3).stores({
            snapshots: "date",
            outbox: "opId, createdAt, date, kind",
            meta: "key",
            clips: "id, createdAt",
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
