import type { EntryStatus } from "@/lib/money/ledger"

export type { EntryStatus }

export interface SnapshotCustomer {
    id: string
    name: string
    phone: string | null
    bankAccountNo: string | null
    defaultAmount: number
    routeOrder: number
}

export interface SnapshotEntry {
    customerId: string
    date: string
    expectedAmount: number
    status: EntryStatus
    amountReceived: number
    markedAt: string | null
    note: string | null
}

/** What was owed before the snapshot day, oldest unpaid day first. */
export interface CarryIn {
    customerId: string
    openDays: { date: string; outstanding: number }[]
    advance: number
}

export interface DaySnapshot {
    date: string
    isWorkingDay: boolean
    lockedAt: string | null
    countedCash: number | null
    customers: SnapshotCustomer[]
    entries: SnapshotEntry[]
    carry: CarryIn[]
    fetchedAt: string
}

export interface MarkOp {
    opId: string
    customerId: string
    date: string
    status: EntryStatus
    amountReceived: number
    note?: string | null
    markedAt: string
}

export interface ApplyOpsResult {
    applied: string[]
    rejected: { opId: string; reason: "locked" | "unknown_customer" | "invalid" }[]
}
