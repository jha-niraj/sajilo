import "server-only"
import { z } from "zod"
import { makeTool } from "@repo/ai/agent"
import { syncMarks } from "@/actions/collection.action"
import { createCustomers } from "@/actions/customer.action"
import { activeCustomers, bsLabel, matchName, notFound } from "../resolve"
import type { MunshiWriteDef } from "../types"

const STATUS = ["paid", "shop_closed", "no_money"] as const

export const markPaymentDef: MunshiWriteDef = {
    name: "markPayment",
    kind: "mark_payment",
    capability: "mark today's payment for a customer (paid with an amount, shop closed, or no money)",
    isWrite: true,
    commit: async (p, ctx) => {
        const res = await syncMarks([
            {
                opId: crypto.randomUUID(),
                customerId: String(p.customerId),
                date: ctx.today,
                status: p.status as (typeof STATUS)[number],
                amountReceived: Number(p.amount) || 0,
                markedAt: new Date().toISOString(),
            },
        ])
        if (res.applied.length) return { ok: true, message: "saved" }
        return { ok: false, message: res.rejected[0]?.reason === "locked" ? "today is already closed" : "could not save" }
    },
    build: (ctx) =>
        makeTool({
            description:
                "WRITE ACTION. Mark today's collection for one customer. " +
                "Step 1: call with confirm=false - nothing is saved, a Confirm card appears; tell him what you prepared. " +
                "Step 2: only after he says yes, call again with confirm=true and the same arguments.",
            parameters: z.object({
                name: z.string().describe("Customer name exactly as in the list"),
                status: z.enum(STATUS),
                amount: z.number().optional().describe("Rupees received, only for paid. Omit to use their daily amount."),
                confirm: z.boolean().optional().describe("Omit/false = preview only; true = save"),
            }),
            execute: async ({ name, status, amount, confirm }) => {
                const m = matchName(await activeCustomers(ctx), name)
                if (!m.hit) return notFound(m.candidates)
                const amt = status === "paid" ? Math.round(amount || m.hit.defaultAmount) : 0
                const label = status === "paid" ? `Rs ${amt}` : status === "shop_closed" ? "Shop closed" : "No money today"
                const payload = { customerId: m.hit.id, status, amount: amt }
                if (!confirm) {
                    ctx.propose({ kind: "mark_payment", title: `${m.hit.name}: ${label}`, lines: [bsLabel(ctx.today)], payload, call: { tool: "markPayment", args: { name: m.hit.name, status, amount: amt } } })
                    return { preview: `${m.hit.name}: ${label} for today`, saved: false, next: "ask him to confirm" }
                }
                const slot = ctx.claimWriteSlot("markPayment")
                if (slot) return slot
                return ctx.commit("mark_payment", payload, () => markPaymentDef.commit(payload, ctx))
            },
        }),
}

export const addCustomerDef: MunshiWriteDef = {
    name: "addCustomer",
    kind: "add_customer",
    capability: "add a new customer at the end of his route",
    isWrite: true,
    commit: async (p) => {
        const res = await createCustomers([
            { name: String(p.name), defaultAmount: Number(p.dailyAmount), phone: p.phone ? String(p.phone) : null },
        ])
        return { ok: res.count === 1, message: res.count === 1 ? "added" : "could not add" }
    },
    build: (ctx) =>
        makeTool({
            description:
                "WRITE ACTION. Add a new collection customer at the end of the route. " +
                "Step 1: confirm=false (preview + Confirm card). Step 2: after he says yes, confirm=true with the same arguments.",
            parameters: z.object({
                name: z.string(),
                dailyAmount: z.number().describe("Rupees he collects from them each day"),
                phone: z.string().optional(),
                confirm: z.boolean().optional(),
            }),
            execute: async ({ name, dailyAmount, phone, confirm }) => {
                const nm = name.trim()
                const amt = Math.round(dailyAmount)
                if (!nm || !(amt > 0)) return { error: "need a name and a daily amount above zero" }
                const payload = { name: nm, dailyAmount: amt, phone: phone ?? null }
                if (!confirm) {
                    ctx.propose({ kind: "add_customer", title: `New customer: ${nm}`, lines: [`Rs ${amt} daily`, ...(phone ? [phone] : [])], payload, call: { tool: "addCustomer", args: { name: nm, dailyAmount: amt, phone } } })
                    return { preview: `Add ${nm}, Rs ${amt} daily`, saved: false, next: "ask him to confirm" }
                }
                const slot = ctx.claimWriteSlot("addCustomer")
                if (slot) return slot
                return ctx.commit("add_customer", payload, () => addCustomerDef.commit(payload, ctx))
            },
        }),
}
