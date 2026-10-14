"use server"

import { z } from "zod"
import { db, and, eq } from "@repo/db"
import { loan, loanRepayment } from "@repo/db/schema"
import { actionCollectorId } from "@/lib/session"
import { nepalToday } from "@/lib/today"
import { cashOnHand, findOrCreateBorrower, getLoan, listBorrowers, listLoans, type CashOnHand, type LoanView } from "@/lib/lending/server"

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export async function fetchLoans(): Promise<LoanView[]> {
    const id = await actionCollectorId()
    return listLoans(id, nepalToday())
}

export async function fetchLoan(loanId: string, asOf?: string): Promise<LoanView | null> {
    const id = await actionCollectorId()
    return getLoan(id, loanId, asOf && isoDate.safeParse(asOf).success ? asOf : nepalToday())
}

export async function fetchBorrowers() {
    const id = await actionCollectorId()
    return listBorrowers(id)
}

export async function fetchCashOnHand(): Promise<CashOnHand> {
    const id = await actionCollectorId()
    return cashOnHand(id, nepalToday())
}

const newLoanInput = z.object({
    borrowerId: z.string().optional(),
    borrowerName: z.string().trim().max(120).optional(),
    borrowerPhone: z.string().trim().max(20).optional().nullable(),
    principal: z.coerce.number().positive().max(100_000_000),
    ratePer100: z.coerce.number().min(0).max(100),
    startDate: isoDate,
    dueDate: isoDate.optional().nullable(),
    compounding: z.boolean().nullable().optional(),
    note: z.string().trim().max(500).optional().nullable(),
})

export async function createLoan(input: z.input<typeof newLoanInput>): Promise<{ id: string }> {
    const collectorId = await actionCollectorId()
    const p = newLoanInput.parse(input)
    const borrowerId = await findOrCreateBorrower(collectorId, { id: p.borrowerId, name: p.borrowerName, phone: p.borrowerPhone })
    const [row] = await db
        .insert(loan)
        .values({
            collectorId,
            borrowerId,
            principal: p.principal,
            ratePer100: p.ratePer100,
            startDate: p.startDate,
            dueDate: p.dueDate ?? null,
            compounding: p.compounding ?? null,
            note: p.note ?? null,
        })
        .returning({ id: loan.id })
    return { id: row!.id }
}

export async function addRepayment(loanId: string, input: { date: string; amount: number; note?: string | null }): Promise<{ ok: true; closed: boolean }> {
    const collectorId = await actionCollectorId()
    const date = isoDate.parse(input.date)
    const amount = z.coerce.number().positive().max(100_000_000).parse(input.amount)
    const l = await db.query.loan.findFirst({ where: and(eq(loan.id, loanId), eq(loan.collectorId, collectorId)) })
    if (!l) throw new Error("not found")
    await db.insert(loanRepayment).values({ collectorId, loanId, date, amount, note: input.note ?? null })

    const view = await getLoan(collectorId, loanId, date)
    const closed = !!view && view.statement.total <= 0
    if (closed) await db.update(loan).set({ status: "closed", closedAt: date }).where(eq(loan.id, loanId))
    return { ok: true, closed }
}

export async function deleteRepayment(repaymentId: string): Promise<{ ok: true }> {
    const collectorId = await actionCollectorId()
    await db.delete(loanRepayment).where(and(eq(loanRepayment.id, repaymentId), eq(loanRepayment.collectorId, collectorId)))
    return { ok: true }
}

export async function setLoanStatus(loanId: string, status: "active" | "closed"): Promise<{ ok: true }> {
    const collectorId = await actionCollectorId()
    await db
        .update(loan)
        .set({ status, closedAt: status === "closed" ? nepalToday() : null })
        .where(and(eq(loan.id, loanId), eq(loan.collectorId, collectorId)))
    return { ok: true }
}

const editLoanInput = z.object({
    principal: z.coerce.number().positive().max(100_000_000),
    ratePer100: z.coerce.number().min(0).max(100),
    startDate: isoDate,
    dueDate: isoDate.nullable(),
    compounding: z.boolean().nullable(),
    note: z.string().trim().max(500).nullable(),
})

export async function updateLoan(loanId: string, input: z.input<typeof editLoanInput>): Promise<{ ok: true }> {
    const collectorId = await actionCollectorId()
    const p = editLoanInput.parse(input)
    await db.update(loan).set(p).where(and(eq(loan.id, loanId), eq(loan.collectorId, collectorId)))
    return { ok: true }
}

export async function deleteLoan(loanId: string): Promise<{ ok: true }> {
    const collectorId = await actionCollectorId()
    await db.delete(loan).where(and(eq(loan.id, loanId), eq(loan.collectorId, collectorId)))
    return { ok: true }
}
