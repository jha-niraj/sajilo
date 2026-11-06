import "server-only"
import { z } from "zod"
import { makeTool } from "@repo/ai/agent"
import { rechargeBuy, rechargeCount, rechargePayback, rechargeSale } from "@/actions/recharge.action"
import { normalizePhone } from "@/lib/phone"
import { poolOf, suggestPaid } from "@/lib/recharge/ledger"
import { cardWords, matchName, notFound } from "../resolve"
import type { MunshiToolContext, MunshiWriteDef } from "../types"
import { rechargeBook } from "./recharge-reads"

const provider = z.enum(["ntc", "ncell"]).describe("NTC (Nepal Telecom) or Ncell")
const stock = z.enum(["eload", "card"]).optional().describe("eload (balance sent to the number) or card (scratch card). Omit = eload")
const NAME = { ntc: "NTC", ncell: "Ncell" } as const
const what = (lang: "ne" | "en", p: "ntc" | "ncell", s: "eload" | "card") => `${NAME[p]} ${s === "eload" ? (lang === "ne" ? "ई-लोड" : "e-load") : lang === "ne" ? "कार्ड" : "card"}`
const id = () => crypto.randomUUID()

/**
 * Who a udharo is for: someone who already took udharo, a collection customer, or a new number.
 * Returns the payload pieces the sale needs, or a not_found for Munshi to ask about.
 */
async function udharoPerson(ctx: Pick<MunshiToolContext, "collectorId" | "today">, who: string) {
    const { people, data } = await rechargeBook(ctx)
    const phone = normalizePhone(who)
    if (phone) {
        const same = people.find((p) => p.phone === phone)
        if (same) return { personId: same.id, newPerson: null, label: same.name }
        const nid = id()
        return { personId: nid, newPerson: { id: nid, name: null, phone, customerId: null }, label: phone.replace("+977", "") }
    }
    const rows = [
        ...people.map((p) => ({ name: p.name, personId: p.id, newPerson: null as null | { id: string; name: string | null; phone: string | null; customerId: string | null } })),
        ...data.customers
            .filter((c) => !people.some((p) => p.customerId === c.id))
            .map((c) => ({ name: c.name, personId: `cust:${c.id}`, newPerson: { id: `cust:${c.id}`, name: c.name, phone: c.phone, customerId: c.id } })),
    ]
    const m = matchName(rows, who)
    if (!m.hit) return { error: notFound(m.candidates), hint: "Not found. Ask which one, or ask for their phone number to add them as a new person." }
    return { personId: m.hit.personId, newPerson: m.hit.newPerson, label: m.hit.name }
}

export const rechargeSellDef: MunshiWriteDef = {
    name: "rechargeSell",
    kind: "recharge_sale",
    capability: "record a recharge sale (NTC/Ncell, e-load or card), paid now or on udharo",
    isWrite: true,
    commit: async (p, ctx) => {
        await rechargeSale({
            id: String(p.id),
            provider: p.provider as "ntc" | "ncell",
            stock: p.stock as "eload" | "card",
            date: ctx.today,
            at: Date.now(),
            amount: Number(p.amount),
            personId: (p.personId as string | null) ?? null,
            newPerson: (p.newPerson as never) ?? null,
        })
        return { ok: true, message: "sale saved" }
    },
    build: (ctx) =>
        makeTool({
            description:
                "WRITE ACTION. Record a recharge sale for today. udharo_to = name or phone if the person did not pay now. " +
                "Step 1: confirm=false (preview + Confirm card). Step 2: after he says yes, confirm=true with the same arguments.",
            parameters: z.object({
                provider,
                stock,
                amount: z.number().describe("Rupees of recharge sold"),
                udharo_to: z.string().optional().describe("Name or phone number, only when it was given on credit"),
                confirm: z.boolean().optional(),
            }),
            execute: async ({ provider: pr, stock: st, amount, udharo_to, confirm }) => {
                const s = st ?? "eload"
                if (!(amount > 0)) return { error: "need an amount above zero" }
                const inHand = (await rechargeBook(ctx)).ledger.state[poolOf(pr, s)].stock
                if (amount > inHand) return { error: "not_enough_stock", in_hand: Math.max(0, inHand), hint: "Tell him only that much is in hand; ask if he bought stock to add first." }
                let person: { personId: string | null; newPerson: unknown; label: string | null } = { personId: null, newPerson: null, label: null }
                if (udharo_to) {
                    const r = await udharoPerson(ctx, udharo_to)
                    if ("error" in r) return r
                    person = r
                }
                const w = cardWords(ctx.lang)
                const payload = { id: id(), provider: pr, stock: s, amount: Math.round(amount), personId: person.personId, newPerson: person.newPerson }
                if (!confirm) {
                    ctx.propose({
                        kind: "recharge_sale",
                        title: person.label
                            ? `${ctx.lang === "ne" ? "उधारो" : "Udharo"}: ${person.label} · ${w.rs(payload.amount)}`
                            : `${ctx.lang === "ne" ? "बिक्री" : "Sold"}: ${w.rs(payload.amount)}`,
                        lines: [what(ctx.lang, pr, s), w.date(ctx.today)],
                        payload,
                        call: { tool: "rechargeSell", args: { provider: pr, stock: s, amount, udharo_to } },
                    })
                    return { preview: `${NAME[pr]} ${s} Rs ${payload.amount}${person.label ? ` on udharo to ${person.label}` : ""}`, saved: false, next: "ask him to confirm" }
                }
                const slot = ctx.claimWriteSlot("rechargeSell")
                if (slot) return slot
                return ctx.commit("recharge_sale", payload, () => rechargeSellDef.commit(payload, ctx))
            },
        }),
}

export const rechargeBuyDef: MunshiWriteDef = {
    name: "rechargeBuy",
    kind: "recharge_buy",
    capability: "record recharge stock he bought (face value and what he paid)",
    isWrite: true,
    commit: async (p, ctx) => {
        await rechargeBuy({ id: String(p.id), provider: p.provider as "ntc" | "ncell", stock: p.stock as "eload" | "card", date: ctx.today, at: Date.now(), face: Number(p.face), paid: Number(p.paid) })
        return { ok: true, message: "stock added" }
    },
    build: (ctx) =>
        makeTool({
            description:
                "WRITE ACTION. Recharge stock bought today: face = recharge value received, paid = what he paid the dealer (omit to use his last rate). " +
                "Step 1: confirm=false. Step 2: after yes, confirm=true with the same arguments.",
            parameters: z.object({ provider, stock, face: z.number(), paid: z.number().optional(), confirm: z.boolean().optional() }),
            execute: async ({ provider: pr, stock: st, face, paid, confirm }) => {
                const s = st ?? "eload"
                if (!(face > 0)) return { error: "need the recharge amount received" }
                const price = paid ?? suggestPaid((await rechargeBook(ctx)).ledger.state, poolOf(pr, s), face)
                if (!price) return { error: "ask how much he paid the dealer; there is no earlier purchase to go by" }
                const w = cardWords(ctx.lang)
                const pct = Math.round(((face - price) / face) * 1000) / 10
                const payload = { id: id(), provider: pr, stock: s, face: Math.round(face), paid: Math.round(price) }
                if (!confirm) {
                    ctx.propose({
                        kind: "recharge_buy",
                        title: `${ctx.lang === "ne" ? "स्टक" : "Stock"}: ${what(ctx.lang, pr, s)} ${w.rs(payload.face)}`,
                        lines: [`${ctx.lang === "ne" ? "तिरेको" : "Paid"} ${w.rs(payload.paid)} · ${pct}%`],
                        payload,
                        call: { tool: "rechargeBuy", args: { provider: pr, stock: s, face, paid: payload.paid } },
                    })
                    return { preview: `Bought ${NAME[pr]} ${s} Rs ${payload.face} for Rs ${payload.paid} (${pct}% margin)`, saved: false, next: "ask him to confirm" }
                }
                const slot = ctx.claimWriteSlot("rechargeBuy")
                if (slot) return slot
                return ctx.commit("recharge_buy", payload, () => rechargeBuyDef.commit(payload, ctx))
            },
        }),
}

export const rechargeCountDef: MunshiWriteDef = {
    name: "rechargeCount",
    kind: "recharge_count",
    capability: "record how much recharge stock is really left (a count)",
    isWrite: true,
    commit: async (p, ctx) => {
        await rechargeCount({ id: String(p.id), provider: p.provider as "ntc" | "ncell", stock: p.stock as "eload" | "card", date: ctx.today, at: Date.now(), counted: Number(p.counted) })
        return { ok: true, message: "count saved" }
    },
    build: (ctx) =>
        makeTool({
            description: "WRITE ACTION. The recharge stock he counted (SIM balance or cards in hand). Step 1: confirm=false. Step 2: after yes, confirm=true.",
            parameters: z.object({ provider, stock, counted: z.number(), confirm: z.boolean().optional() }),
            execute: async ({ provider: pr, stock: st, counted, confirm }) => {
                const s = st ?? "eload"
                if (!(counted >= 0)) return { error: "need the amount left" }
                const expected = (await rechargeBook(ctx)).ledger.state[poolOf(pr, s)].stock
                const w = cardWords(ctx.lang)
                const payload = { id: id(), provider: pr, stock: s, counted: Math.round(counted) }
                if (!confirm) {
                    ctx.propose({
                        kind: "recharge_count",
                        title: `${ctx.lang === "ne" ? "गन्ती" : "Count"}: ${what(ctx.lang, pr, s)} ${w.rs(payload.counted)}`,
                        lines: [`${ctx.lang === "ne" ? "सजिलो अनुसार" : "Sajilo expects"} ${w.rs(expected)}`],
                        payload,
                        call: { tool: "rechargeCount", args: { provider: pr, stock: s, counted } },
                    })
                    return { preview: `Count ${NAME[pr]} ${s}: Rs ${payload.counted} (expected Rs ${expected})`, saved: false, next: "ask him to confirm" }
                }
                const slot = ctx.claimWriteSlot("rechargeCount")
                if (slot) return slot
                return ctx.commit("recharge_count", payload, () => rechargeCountDef.commit(payload, ctx))
            },
        }),
}

export const rechargePaidBackDef: MunshiWriteDef = {
    name: "rechargePaidBack",
    kind: "recharge_payback",
    capability: "record someone paying back their recharge udharo",
    isWrite: true,
    commit: async (p, ctx) => {
        await rechargePayback({ id: String(p.id), personId: String(p.personId), date: ctx.today, at: Date.now(), amount: Number(p.amount), newPerson: null })
        return { ok: true, message: "payment saved" }
    },
    build: (ctx) =>
        makeTool({
            description: "WRITE ACTION. Someone paid back recharge udharo. Omit amount = everything they owe. Step 1: confirm=false. Step 2: after yes, confirm=true.",
            parameters: z.object({ name: z.string().describe("Name or phone of who paid"), amount: z.number().optional(), confirm: z.boolean().optional() }),
            execute: async ({ name, amount, confirm }) => {
                const { people } = await rechargeBook(ctx)
                const owing = people.filter((p) => p.owed > 0)
                const phone = normalizePhone(name)
                const hit = phone ? owing.find((p) => p.phone === phone) : matchName(owing, name).hit
                if (!hit) return phone ? { error: "nobody with that number owes udharo" } : notFound(matchName(owing, name).candidates)
                const amt = Math.round(amount ?? hit.owed)
                if (!(amt > 0)) return { error: "need an amount above zero" }
                const w = cardWords(ctx.lang)
                const payload = { id: id(), personId: hit.id, amount: amt }
                if (!confirm) {
                    ctx.propose({
                        kind: "recharge_payback",
                        title: `${hit.name} ${ctx.lang === "ne" ? "ले फिर्ता" : "paid back"} ${w.rs(amt)}`,
                        lines: [`${ctx.lang === "ne" ? "बाँकी थियो" : "Owed"} ${w.rs(hit.owed)}`],
                        payload,
                        call: { tool: "rechargePaidBack", args: { name: hit.name, amount: amt } },
                    })
                    return { preview: `${hit.name} paid back Rs ${amt} of Rs ${hit.owed}`, saved: false, next: "ask him to confirm" }
                }
                const slot = ctx.claimWriteSlot("rechargePaidBack")
                if (slot) return slot
                return ctx.commit("recharge_payback", payload, () => rechargePaidBackDef.commit(payload, ctx))
            },
        }),
}
