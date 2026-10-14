import "server-only"
import { db, and, eq, inArray, asc, desc, gte, lte } from "@repo/db"
import { borrower, loan, loanRepayment } from "@repo/db/schema"
import { adToBs, bsMonthRange, diffAdDays } from "@repo/calendar"
import { calculateLoan, type LoanStatement } from "@/lib/money/interest"
import { getSettings, receivedBetween } from "@/lib/collection/server"

export interface LoanView {
    id: string
    borrowerId: string
    borrowerName: string
    borrowerPhone: string | null
    principal: number
    ratePer100: number
    startDate: string
    dueDate: string | null
    compounding: boolean
    compoundingOverride: boolean | null
    status: "active" | "closed"
    closedAt: string | null
    note: string | null
    repayments: { id: string; date: string; amount: number; note: string | null }[]
    statement: LoanStatement
    dueInDays: number | null
}

type LoanRow = typeof loan.$inferSelect
type BorrowerRow = typeof borrower.$inferSelect
type RepaymentRow = typeof loanRepayment.$inferSelect

function toView(l: LoanRow, b: BorrowerRow, reps: RepaymentRow[], asOf: string, settings: Awaited<ReturnType<typeof getSettings>>): LoanView {
    const compounding = l.compounding ?? settings.compoundingEnabled
    const end = l.status === "closed" && l.closedAt && l.closedAt < asOf ? l.closedAt : asOf
    const statement = calculateLoan(
        { principal: l.principal, ratePer100: l.ratePer100, startDate: l.startDate, compounding, basis: settings.interestBasis },
        reps.map((r) => ({ date: r.date, amount: r.amount })),
        end,
    )
    return {
        id: l.id,
        borrowerId: b.id,
        borrowerName: b.name,
        borrowerPhone: b.phone,
        principal: l.principal,
        ratePer100: l.ratePer100,
        startDate: l.startDate,
        dueDate: l.dueDate,
        compounding,
        compoundingOverride: l.compounding,
        status: l.status,
        closedAt: l.closedAt,
        note: l.note,
        repayments: reps
            .sort((a, z) => (a.date < z.date ? -1 : 1))
            .map((r) => ({ id: r.id, date: r.date, amount: r.amount, note: r.note })),
        statement,
        dueInDays: l.dueDate ? diffAdDays(asOf, l.dueDate) : null,
    }
}

export async function listLoans(collectorId: string, asOf: string, status?: "active" | "closed"): Promise<LoanView[]> {
    const settings = await getSettings(collectorId)
    const loans = await db
        .select()
        .from(loan)
        .where(status ? and(eq(loan.collectorId, collectorId), eq(loan.status, status)) : eq(loan.collectorId, collectorId))
        .orderBy(desc(loan.startDate))
    if (loans.length === 0) return []
    const [borrowers, reps] = await Promise.all([
        db
            .select()
            .from(borrower)
            .where(inArray(borrower.id, [...new Set(loans.map((l) => l.borrowerId))])),
        db
            .select()
            .from(loanRepayment)
            .where(inArray(loanRepayment.loanId, loans.map((l) => l.id))),
    ])
    const bMap = new Map(borrowers.map((b) => [b.id, b]))
    return loans.map((l) =>
        toView(
            l,
            bMap.get(l.borrowerId)!,
            reps.filter((r) => r.loanId === l.id),
            asOf,
            settings,
        ),
    )
}

export async function getLoan(collectorId: string, id: string, asOf: string): Promise<LoanView | null> {
    const l = await db.query.loan.findFirst({ where: and(eq(loan.id, id), eq(loan.collectorId, collectorId)) })
    if (!l) return null
    const [b, reps, settings] = await Promise.all([
        db.query.borrower.findFirst({ where: eq(borrower.id, l.borrowerId) }),
        db.select().from(loanRepayment).where(eq(loanRepayment.loanId, l.id)).orderBy(asc(loanRepayment.date)),
        getSettings(collectorId),
    ])
    return toView(l, b!, reps, asOf, settings)
}

export async function findOrCreateBorrower(collectorId: string, input: { id?: string; name?: string; phone?: string | null }): Promise<string> {
    if (input.id) {
        const b = await db.query.borrower.findFirst({ where: and(eq(borrower.id, input.id), eq(borrower.collectorId, collectorId)) })
        if (b) return b.id
    }
    const name = input.name?.trim()
    if (!name) throw new Error("borrower name required")
    const [created] = await db
        .insert(borrower)
        .values({ collectorId, name, phone: input.phone || null })
        .returning({ id: borrower.id })
    return created!.id
}

export async function listBorrowers(collectorId: string) {
    return db
        .select({ id: borrower.id, name: borrower.name, phone: borrower.phone })
        .from(borrower)
        .where(eq(borrower.collectorId, collectorId))
        .orderBy(asc(borrower.name))
}

export interface CashOnHand {
    year: number
    month: number
    collected: number
    lentThisMonth: number
    returnedThisMonth: number
    shouldHave: number
    stillOut: number
    stillOutInterest: number
}

export async function cashOnHand(collectorId: string, today: string): Promise<CashOnHand> {
    const bs = adToBs(today)
    const range = bsMonthRange(bs.year, bs.month)
    const [received, lent, returned, active] = await Promise.all([
        receivedBetween(collectorId, range.start, range.end),
        db
            .select({ principal: loan.principal })
            .from(loan)
            .where(and(eq(loan.collectorId, collectorId), gte(loan.startDate, range.start), lte(loan.startDate, range.end))),
        db
            .select({ amount: loanRepayment.amount })
            .from(loanRepayment)
            .where(
                and(
                    eq(loanRepayment.collectorId, collectorId),
                    gte(loanRepayment.date, range.start),
                    lte(loanRepayment.date, range.end),
                ),
            ),
        listLoans(collectorId, today, "active"),
    ])
    const collected = received.reduce((s, r) => s + r.amountReceived, 0)
    const lentThisMonth = lent.reduce((s, r) => s + r.principal, 0)
    const returnedThisMonth = returned.reduce((s, r) => s + r.amount, 0)
    return {
        year: bs.year,
        month: bs.month,
        collected,
        lentThisMonth,
        returnedThisMonth,
        shouldHave: collected - lentThisMonth + returnedThisMonth,
        stillOut: active.reduce((s, l) => s + l.statement.principalLeft, 0),
        stillOutInterest: active.reduce((s, l) => s + l.statement.interestDue, 0),
    }
}
