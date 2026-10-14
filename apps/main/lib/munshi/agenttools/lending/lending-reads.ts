import "server-only"
import { z } from "zod"
import { makeTool } from "@repo/ai/agent"
import { calculateLoan } from "@/lib/money/interest"
import { getSettings } from "@/lib/collection/server"
import { cashOnHand } from "@/lib/lending/server"
import { activeLoansNamed, bsArgToAd, bsLabel, matchName, notFound } from "../resolve"
import type { MunshiToolDef } from "../types"

const bsDate = z.object({ year: z.number(), month: z.number().describe("1-12, Baishakh = 1"), day: z.number() })

export const getLoansDef: MunshiToolDef = {
    name: "getLoans",
    capability: "list everyone he has lent money to and what each owes today",
    isWrite: false,
    build: (ctx) =>
        makeTool({
            description: "All active loans with what each borrower owes today.",
            parameters: z.object({}),
            execute: async () =>
                (await activeLoansNamed(ctx)).map((l) => ({
                    name: l.borrowerName,
                    given: l.principal,
                    on: bsLabel(l.startDate),
                    rate_per_100_per_month: l.ratePer100,
                    interest_so_far: l.statement.interestDue,
                    total_to_take_today: l.statement.total,
                    return_by: l.dueDate ? bsLabel(l.dueDate) : null,
                })),
        }),
}

export const getLoanDef: MunshiToolDef = {
    name: "getLoan",
    capability: "work out exactly how much to take from a borrower, today or on any date",
    isWrite: false,
    build: (ctx) =>
        makeTool({
            description: "One borrower's loan: amount given, time passed, interest, total to take - today or on a given BS date.",
            parameters: z.object({
                name: z.string().describe("Borrower name exactly as in the list"),
                on: bsDate.optional().describe("BS date to calculate for; omit for today"),
            }),
            execute: async ({ name, on }) => {
                const m = matchName(await activeLoansNamed(ctx), name)
                if (!m.hit) return notFound(m.candidates)
                const l = m.hit
                const asOf = bsArgToAd(on) ?? ctx.today
                const settings = await getSettings(ctx.collectorId)
                const s = calculateLoan(
                    { principal: l.principal, ratePer100: l.ratePer100, startDate: l.startDate, compounding: l.compounding, basis: settings.interestBasis },
                    l.repayments.map((r) => ({ date: r.date, amount: r.amount })),
                    asOf < l.startDate ? l.startDate : asOf,
                )
                return {
                    name: l.borrowerName,
                    given: l.principal,
                    given_on: bsLabel(l.startDate),
                    rate_per_100_per_month: l.ratePer100,
                    as_of: bsLabel(asOf),
                    time: `${s.elapsed.months} months ${s.elapsed.days} days`,
                    loan_left: s.principalLeft,
                    interest: s.interestDue,
                    total_to_take: s.total,
                }
            },
        }),
}

export const getCashInHandDef: MunshiToolDef = {
    name: "getCashInHand",
    capability: "cash that should be in hand this month after lending and repayments",
    isWrite: false,
    build: (ctx) =>
        makeTool({
            description: "This month: collected, lent out, returned, cash that should be in hand, and money still out on loans.",
            parameters: z.object({}),
            execute: async () => cashOnHand(ctx.collectorId, ctx.today),
        }),
}
