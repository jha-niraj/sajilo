import "server-only"
import { z } from "zod"
import { makeTool } from "@repo/ai/agent"
import { addRepayment, createLoan } from "@/actions/loan.action"
import { getSettings } from "@/lib/collection/server"
import { activeLoansNamed, borrowers, bsArgToAd, bsLabel, cardWords, matchName, notFound } from "../resolve"
import type { MunshiWriteDef } from "../types"

export const addLoanDef: MunshiWriteDef = {
    name: "addLoan",
    kind: "add_loan",
    capability: "record money he lent to someone (new or existing borrower)",
    isWrite: true,
    commit: async (p) => {
        await createLoan({
            borrowerId: p.borrowerId ? String(p.borrowerId) : undefined,
            borrowerName: p.borrowerId ? undefined : String(p.name),
            principal: Number(p.amount),
            ratePer100: Number(p.rate),
            startDate: String(p.startDate),
        })
        return { ok: true, message: "loan saved" }
    },
    build: (ctx) =>
        makeTool({
            description:
                "WRITE ACTION. Record money he lent. Borrowers are separate from collection customers. " +
                "Step 1: confirm=false (preview + Confirm card). Step 2: after he says yes, confirm=true with the same arguments.",
            parameters: z.object({
                name: z.string().describe("Borrower name; an existing borrower's exact name, or a new one"),
                amount: z.number(),
                ratePer100: z.number().optional().describe("Rupees per 100 per month. Omit to use his default."),
                givenOn: z.object({ year: z.number(), month: z.number(), day: z.number() }).optional().describe("BS date given; omit for today"),
                confirm: z.boolean().optional(),
            }),
            execute: async ({ name, amount, ratePer100, givenOn, confirm }) => {
                const nm = name.trim()
                if (!nm || !(amount > 0)) return { error: "need a name and an amount above zero" }
                const rate = ratePer100 || (await getSettings(ctx.collectorId)).defaultRatePer100
                const on = bsArgToAd(givenOn) ?? ctx.today
                const existing = matchName(await borrowers(ctx), nm).hit
                const payload = { borrowerId: existing?.id ?? null, name: existing?.name ?? nm, amount, rate, startDate: on }
                if (!confirm) {
                    const w = cardWords(ctx.lang)
                    ctx.propose({
                        kind: "add_loan",
                        title: w.loanTo(payload.name, amount),
                        lines: [w.rate(rate), w.given(on), ...(existing ? [] : [w.newBorrower])],
                        payload,
                        call: { tool: "addLoan", args: { name: payload.name, amount, ratePer100: rate, givenOn } },
                    })
                    return { preview: `Lend Rs ${amount} to ${payload.name} at Rs ${rate} per 100 per month from ${bsLabel(on)}`, saved: false, next: "ask him to confirm" }
                }
                const slot = ctx.claimWriteSlot("addLoan")
                if (slot) return slot
                return ctx.commit("add_loan", payload, () => addLoanDef.commit(payload, ctx))
            },
        }),
}

export const addRepaymentDef: MunshiWriteDef = {
    name: "addRepayment",
    kind: "add_repayment",
    capability: "record money a borrower paid back (interest first, then the loan)",
    isWrite: true,
    commit: async (p, ctx) => {
        const res = await addRepayment(String(p.loanId), { date: ctx.today, amount: Number(p.amount) })
        return { ok: true, message: res.closed ? "repayment saved, loan fully paid and closed" : "repayment saved" }
    },
    build: (ctx) =>
        makeTool({
            description:
                "WRITE ACTION. Record money a borrower returned today. " +
                "Step 1: confirm=false (preview + Confirm card). Step 2: after he says yes, confirm=true with the same arguments.",
            parameters: z.object({
                name: z.string().describe("Borrower name exactly as in the list"),
                amount: z.number(),
                confirm: z.boolean().optional(),
            }),
            execute: async ({ name, amount, confirm }) => {
                const m = matchName(await activeLoansNamed(ctx), name)
                if (!m.hit) return notFound(m.candidates)
                if (!(amount > 0)) return { error: "need an amount above zero" }
                const payload = { loanId: m.hit.id, amount }
                if (!confirm) {
                    const w = cardWords(ctx.lang)
                    ctx.propose({
                        kind: "add_repayment",
                        title: w.returned(m.hit.borrowerName, amount),
                        lines: [w.owesToday(m.hit.statement.total)],
                        payload,
                        call: { tool: "addRepayment", args: { name: m.hit.borrowerName, amount } },
                    })
                    return { preview: `${m.hit.borrowerName} paid back Rs ${amount} (owes Rs ${m.hit.statement.total} today)`, saved: false, next: "ask him to confirm" }
                }
                const slot = ctx.claimWriteSlot("addRepayment")
                if (slot) return slot
                return ctx.commit("add_repayment", payload, () => addRepaymentDef.commit(payload, ctx))
            },
        }),
}
