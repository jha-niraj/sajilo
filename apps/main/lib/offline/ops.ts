import type { DaySnapshot, MarkOp } from "@/lib/collection/types"

/**
 * Everything important is written to the phone first and sent from this queue. Every op carries
 * ids made on the phone, so sending one twice (a retry after a dropped connection) changes nothing.
 */
export type CustomerFields = {
    name: string
    defaultAmount: number
    phone?: string | null
    bankAccountNo?: string | null
    startDate?: string
    note?: string | null
}

export type QueuedOp =
    | ({ kind?: "mark" } & MarkOp)
    | { kind: "closeDay"; opId: string; date: string; countedCash: number | null }
    | { kind: "reopenDay"; opId: string; date: string }
    | {
          kind: "newLoan"
          opId: string
          loanId: string
          borrowerId: string
          /** For showing the loan before it syncs; the server ignores it */
          borrowerName: string
          /** Set when the borrower was typed in, not picked from the list */
          newBorrower: { name: string; phone: string | null } | null
          principal: number
          ratePer100: number
          startDate: string
          dueDate: string | null
          compounding: boolean | null
          note: string | null
      }
    | { kind: "repayment"; opId: string; repaymentId: string; loanId: string; date: string; amount: number; note: string | null }
    | { kind: "addCustomers"; opId: string; customers: (CustomerFields & { id: string })[] }
    | { kind: "editCustomer"; opId: string; id: string; fields: CustomerFields }
    | { kind: "customerActive"; opId: string; id: string; isActive: boolean }
    | { kind: "reorder"; opId: string; orderedIds: string[] }
    | { kind: "customerAlias"; opId: string; customerId: string; alias: string }
    | RechargeOp

/** Recharge (plan/phase-4-recharge.md). `id` is the entry's id, made on the phone; `at` is when he tapped. */
export type RechargeNewPerson = { id: string; name: string | null; phone: string | null; customerId: string | null }
export type RechargeOp =
    | {
          kind: "rechargeSale"
          opId: string
          id: string
          provider: "ntc" | "ncell"
          stock: "eload" | "card"
          date: string
          at: number
          amount: number
          personId: string | null
          newPerson: RechargeNewPerson | null
          online?: boolean
      }
    | { kind: "rechargeBuy"; opId: string; id: string; provider: "ntc" | "ncell"; stock: "eload" | "card"; date: string; at: number; face: number; paid: number }
    | { kind: "rechargeCount"; opId: string; id: string; provider: "ntc" | "ncell"; stock: "eload" | "card"; date: string; at: number; counted: number; note?: "lost" | "other" | null }
    | { kind: "rechargePayback"; opId: string; id: string; personId: string; date: string; at: number; amount: number; newPerson: RechargeNewPerson | null; online?: boolean }
    | { kind: "rechargeRemove"; opId: string; id: string; date: string }

export const RECHARGE_KINDS = ["rechargeSale", "rechargeBuy", "rechargeCount", "rechargePayback", "rechargeRemove"] as const

export type OpKind = NonNullable<QueuedOp["kind"]>

export function opKind(op: QueuedOp): OpKind {
    return op.kind ?? "mark"
}

export interface SyncResult {
    applied: string[]
    rejected: { opId: string; reason: string }[]
    /** Ops left unsent because the server hit a temporary error; they are retried later */
    stoppedAt: string | null
}

/** What an op means for one saved day, so offline screens show it straight away. */
export function applyOpToSnapshot(snap: DaySnapshot, op: QueuedOp): DaySnapshot {
    switch (op.kind ?? "mark") {
        case "mark": {
            const m = op as MarkOp
            if (snap.date !== m.date) return snap
            const entries = [...snap.entries]
            const i = entries.findIndex((e) => e.customerId === m.customerId)
            const c = snap.customers.find((x) => x.id === m.customerId)
            const next = {
                customerId: m.customerId,
                date: m.date,
                expectedAmount: i >= 0 ? entries[i]!.expectedAmount : (c?.defaultAmount ?? 0),
                status: m.status,
                amountReceived: m.amountReceived,
                markedAt: m.markedAt,
                note: m.note ?? null,
            }
            if (i >= 0) entries[i] = next
            else entries.push(next)
            return { ...snap, entries }
        }
        case "closeDay": {
            const o = op as Extract<QueuedOp, { kind: "closeDay" }>
            return snap.date === o.date ? { ...snap, lockedAt: snap.lockedAt ?? new Date().toISOString(), countedCash: o.countedCash } : snap
        }
        case "reopenDay": {
            const o = op as Extract<QueuedOp, { kind: "reopenDay" }>
            return snap.date === o.date ? { ...snap, lockedAt: null } : snap
        }
        case "addCustomers": {
            const o = op as Extract<QueuedOp, { kind: "addCustomers" }>
            const have = new Set(snap.customers.map((c) => c.id))
            let order = snap.customers.reduce((m, c) => Math.max(m, c.routeOrder), 0)
            const added = o.customers
                .filter((c) => !have.has(c.id) && (!c.startDate || c.startDate <= snap.date))
                .map((c) => ({
                    id: c.id,
                    name: c.name,
                    phone: c.phone ?? null,
                    bankAccountNo: c.bankAccountNo ?? null,
                    defaultAmount: c.defaultAmount,
                    routeOrder: ++order,
                }))
            return added.length ? { ...snap, customers: [...snap.customers, ...added] } : snap
        }
        case "editCustomer": {
            const o = op as Extract<QueuedOp, { kind: "editCustomer" }>
            if (!snap.customers.some((c) => c.id === o.id)) return snap
            return {
                ...snap,
                customers: snap.customers.map((c) =>
                    c.id === o.id
                        ? { ...c, name: o.fields.name, defaultAmount: o.fields.defaultAmount, phone: o.fields.phone ?? null, bankAccountNo: o.fields.bankAccountNo ?? null }
                        : c,
                ),
            }
        }
        case "customerActive": {
            const o = op as Extract<QueuedOp, { kind: "customerActive" }>
            if (o.isActive) return snap
            const paid = snap.entries.some((e) => e.customerId === o.id && e.amountReceived > 0)
            return paid ? snap : { ...snap, customers: snap.customers.filter((c) => c.id !== o.id), entries: snap.entries.filter((e) => e.customerId !== o.id) }
        }
        case "reorder": {
            const o = op as Extract<QueuedOp, { kind: "reorder" }>
            const pos = new Map(o.orderedIds.map((id, i) => [id, i + 1]))
            const customers = snap.customers.map((c) => ({ ...c, routeOrder: pos.get(c.id) ?? c.routeOrder })).sort((a, b) => a.routeOrder - b.routeOrder)
            return { ...snap, customers }
        }
        case "customerAlias": {
            const o = op as Extract<QueuedOp, { kind: "customerAlias" }>
            return {
                ...snap,
                customers: snap.customers.map((c) => (c.id === o.customerId ? { ...c, aliases: withAlias(c.aliases ?? [], o.alias) } : c)),
            }
        }
        default:
            return snap
    }
}

/** Adds a spoken name to a customer's aliases: no duplicates, the newest ten kept. */
export function withAlias(aliases: string[], alias: string): string[] {
    const a = alias.trim().toLowerCase()
    if (!a) return aliases
    return [...aliases.filter((x) => x !== a), a].slice(-10)
}
