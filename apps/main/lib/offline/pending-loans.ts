"use client"

import { useLiveQuery } from "dexie-react-hooks"
import { diffAdDays } from "@repo/calendar"
import { calculateLoan } from "@/lib/money/interest"
import type { LoanView } from "@/lib/lending/server"
import type { QueuedOp } from "./ops"
import { idb } from "./store"

export type NewLoanOp = Extract<QueuedOp, { kind: "newLoan" }>
export type RepaymentOp = Extract<QueuedOp, { kind: "repayment" }>
export type ShownLoan = LoanView & { pending?: boolean; pendingRepaymentIds?: string[] }

export function usePendingLoanOps(): (NewLoanOp | RepaymentOp)[] {
    return useLiveQuery(() => idb().outbox.where("kind").anyOf("newLoan", "repayment").sortBy("createdAt"), [], []) as (NewLoanOp | RepaymentOp)[]
}

/** The loan as it will be once the repayments saved on this phone reach the server. */
export function withPendingRepayments(loan: LoanView, ops: (NewLoanOp | RepaymentOp)[], today: string, basis: "balance" | "principal"): ShownLoan {
    const mine = ops.filter((o): o is RepaymentOp => o.kind === "repayment" && o.loanId === loan.id && !loan.repayments.some((r) => r.id === o.repaymentId))
    if (mine.length === 0) return loan
    const repayments = [...loan.repayments, ...mine.map((o) => ({ id: o.repaymentId, date: o.date, amount: o.amount, note: o.note }))].sort((a, b) => (a.date < b.date ? -1 : 1))
    const statement = calculateLoan(
        { principal: loan.principal, ratePer100: loan.ratePer100, startDate: loan.startDate, compounding: loan.compounding, basis },
        repayments.map((r) => ({ date: r.date, amount: r.amount })),
        today,
    )
    return { ...loan, repayments, statement, pendingRepaymentIds: mine.map((o) => o.repaymentId) }
}

/** Loans given on this phone that the server hasn't seen yet. */
export function pendingNewLoans(
    known: LoanView[],
    ops: (NewLoanOp | RepaymentOp)[],
    today: string,
    basis: "balance" | "principal",
    defaultCompounding: boolean,
): ShownLoan[] {
    return ops
        .filter((o): o is NewLoanOp => o.kind === "newLoan" && !known.some((l) => l.id === o.loanId))
        .map((o) => {
            const compounding = o.compounding ?? defaultCompounding
            const base: LoanView = {
                id: o.loanId,
                borrowerId: o.borrowerId,
                borrowerName: o.borrowerName || o.newBorrower?.name || "",
                borrowerPhone: o.newBorrower?.phone ?? null,
                principal: o.principal,
                ratePer100: o.ratePer100,
                startDate: o.startDate,
                dueDate: o.dueDate,
                compounding,
                compoundingOverride: o.compounding,
                status: "active",
                closedAt: null,
                note: o.note,
                repayments: [],
                statement: calculateLoan({ principal: o.principal, ratePer100: o.ratePer100, startDate: o.startDate, compounding, basis }, [], today),
                dueInDays: o.dueDate ? diffAdDays(today, o.dueDate) : null,
            }
            return { ...withPendingRepayments(base, ops, today, basis), pending: true }
        })
}
