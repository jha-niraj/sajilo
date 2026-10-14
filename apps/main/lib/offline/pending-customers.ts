"use client"

import { useLiveQuery } from "dexie-react-hooks"
import type { CustomerRow } from "@/actions/customer.action"
import type { QueuedOp } from "./ops"
import { idb } from "./store"

type CustomerOp = Extract<QueuedOp, { kind: "addCustomers" | "editCustomer" | "customerActive" | "reorder" }>

export function usePendingCustomerOps(): CustomerOp[] {
    return useLiveQuery(() => idb().outbox.where("kind").anyOf("addCustomers", "editCustomer", "customerActive", "reorder").sortBy("createdAt"), [], []) as CustomerOp[]
}

/** The customer list as it will be once this phone's unsent changes reach the server. */
export function withPendingCustomers(list: CustomerRow[], ops: CustomerOp[], today: string): { rows: CustomerRow[]; pendingIds: Set<string> } {
    const pendingIds = new Set<string>()
    let rows = [...list]
    for (const op of ops) {
        if (op.kind === "addCustomers") {
            let order = rows.reduce((m, c) => Math.max(m, c.routeOrder), 0)
            for (const c of op.customers) {
                if (rows.some((r) => r.id === c.id)) continue
                rows.push({
                    id: c.id,
                    name: c.name,
                    phone: c.phone ?? null,
                    bankAccountNo: c.bankAccountNo ?? null,
                    defaultAmount: c.defaultAmount,
                    routeOrder: ++order,
                    startDate: c.startDate ?? today,
                    isActive: true,
                    note: c.note ?? null,
                })
                pendingIds.add(c.id)
            }
        } else if (op.kind === "editCustomer") {
            rows = rows.map((r) =>
                r.id === op.id
                    ? { ...r, name: op.fields.name, defaultAmount: op.fields.defaultAmount, phone: op.fields.phone ?? null, bankAccountNo: op.fields.bankAccountNo ?? null, note: op.fields.note ?? null, startDate: op.fields.startDate ?? r.startDate }
                    : r,
            )
            pendingIds.add(op.id)
        } else if (op.kind === "customerActive") {
            rows = rows.map((r) => (r.id === op.id ? { ...r, isActive: op.isActive } : r))
            pendingIds.add(op.id)
        } else if (op.kind === "reorder") {
            const pos = new Map(op.orderedIds.map((id, i) => [id, i + 1]))
            rows = rows.map((r) => ({ ...r, routeOrder: pos.get(r.id) ?? r.routeOrder }))
        }
    }
    rows.sort((a, b) => a.routeOrder - b.routeOrder)
    return { rows, pendingIds }
}
