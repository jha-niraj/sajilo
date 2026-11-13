"use server"

import { ZodError } from "zod"
import { actionCollectorId } from "@/lib/session"
import { applyOps } from "@/lib/collection/server"
import { NotFoundError } from "@/lib/errors"
import type { MarkOp } from "@/lib/collection/types"
import { opKind, type QueuedOp, type SyncResult } from "@/lib/offline/ops"
import { closeDay, reopenDay } from "./collection.action"
import { addCustomerAlias, createCustomers, reorderCustomers, setCustomerActive, updateCustomer } from "./customer.action"
import { addRepayment, createLoan } from "./loan.action"
import { rechargeBuy, rechargeCount, rechargePayback, rechargeRemove, rechargeSale } from "./recharge.action"

/**
 * Applies what the phone saved while offline, strictly in the order it happened: a customer added
 * offline must exist before his first tick, and ticks must land before the day is closed.
 * A broken op (bad data, deleted loan) is rejected and skipped; a server hiccup stops the run so
 * nothing is applied out of order, and the rest is retried on the next sync.
 */
export async function syncOutbox(ops: QueuedOp[]): Promise<SyncResult> {
    const collectorId = await actionCollectorId()
    const out: SyncResult = { applied: [], rejected: [], stoppedAt: null }
    const list = ops.slice(0, 300)

    let i = 0
    while (i < list.length) {
        const op = list[i]!
        if (opKind(op) === "mark") {
            const run: MarkOp[] = []
            while (i < list.length && opKind(list[i]!) === "mark") run.push(list[i++] as MarkOp)
            try {
                const res = await applyOps(collectorId, run)
                out.applied.push(...res.applied)
                out.rejected.push(...res.rejected)
            } catch (e) {
                console.error("[sync] marks failed", e)
                out.stoppedAt = run[0]!.opId
                return out
            }
            continue
        }
        try {
            await applyOne(op)
            out.applied.push(op.opId)
        } catch (e) {
            if (e instanceof ZodError || e instanceof NotFoundError) {
                out.rejected.push({ opId: op.opId, reason: e instanceof NotFoundError ? "not_found" : "invalid" })
            } else {
                console.error("[sync] op failed", opKind(op), e)
                out.stoppedAt = op.opId
                return out
            }
        }
        i++
    }
    return out
}

async function applyOne(op: QueuedOp) {
    switch (op.kind) {
        case "closeDay":
            return closeDay(op.date, op.countedCash)
        case "reopenDay":
            return reopenDay(op.date)
        case "newLoan":
            return createLoan({
                id: op.loanId,
                borrowerId: op.newBorrower ? undefined : op.borrowerId,
                newBorrowerId: op.newBorrower ? op.borrowerId : undefined,
                borrowerName: op.newBorrower?.name,
                borrowerPhone: op.newBorrower?.phone ?? null,
                principal: op.principal,
                ratePer100: op.ratePer100,
                startDate: op.startDate,
                dueDate: op.dueDate,
                compounding: op.compounding,
                note: op.note,
            })
        case "repayment":
            return addRepayment(op.loanId, { id: op.repaymentId, date: op.date, amount: op.amount, note: op.note })
        case "addCustomers":
            return createCustomers(op.customers)
        case "editCustomer":
            return updateCustomer(op.id, op.fields)
        case "customerActive":
            return setCustomerActive(op.id, op.isActive)
        case "reorder":
            return reorderCustomers(op.orderedIds)
        case "customerAlias":
            return addCustomerAlias(op.customerId, op.alias)
        case "rechargeSale":
            return rechargeSale(op)
        case "rechargeBuy":
            return rechargeBuy(op)
        case "rechargeCount":
            return rechargeCount(op)
        case "rechargePayback":
            return rechargePayback(op)
        case "rechargeRemove":
            return rechargeRemove(op)
    }
}
