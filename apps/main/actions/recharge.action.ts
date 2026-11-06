"use server"

import { z } from "zod"
import { db, and, eq } from "@repo/db"
import { rechargeEntry, rechargePerson } from "@repo/db/schema"
import { adToBs, bsMonthRange } from "@repo/calendar"
import { actionCollectorId } from "@/lib/session"
import { nepalToday } from "@/lib/today"
import { NotFoundError } from "@/lib/errors"
import { normalizePhone } from "@/lib/phone"
import { loadRecharge, reopenFrom, type RechargeData } from "@/lib/recharge/server"

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const entryId = z.string().min(8).max(64)
const provider = z.enum(["ntc", "ncell"])
const stock = z.enum(["eload", "card"])
const money = z.number().finite().positive().max(10_000_000)
const at = z.number().int().positive()
const newPerson = z
    .object({ id: z.string().min(8).max(80), name: z.string().trim().max(120).nullable(), phone: z.string().max(20).nullable(), customerId: z.string().max(64).nullable() })
    .nullable()

/** The Recharge page for one BS month (up to today when it is this month). */
export async function fetchRecharge(year?: number, month?: number): Promise<RechargeData> {
    const id = await actionCollectorId()
    const today = nepalToday()
    const bs = adToBs(today)
    const y = year ?? bs.year
    const m = month ?? bs.month
    const range = bsMonthRange(y, m)
    const to = range.end < today ? range.end : today
    return loadRecharge(id, range.start, to, today)
}

/**
 * The person on a udharo op: an existing one, or one made on the phone. Two phones (or a retry) can
 * make the same new person; a phone already on file means the same person, so their id is reused.
 */
async function resolvePerson(collectorId: string, personId: string, created: z.infer<typeof newPerson>): Promise<string> {
    if (!created) {
        const [p] = await db
            .select({ id: rechargePerson.id })
            .from(rechargePerson)
            .where(and(eq(rechargePerson.collectorId, collectorId), eq(rechargePerson.id, personId)))
        if (!p) throw new NotFoundError("recharge person")
        return p.id
    }
    const phone = created.phone ? normalizePhone(created.phone) : null
    if (phone) {
        const [same] = await db
            .select({ id: rechargePerson.id })
            .from(rechargePerson)
            .where(and(eq(rechargePerson.collectorId, collectorId), eq(rechargePerson.phone, phone)))
        if (same) return same.id
    }
    await db
        .insert(rechargePerson)
        .values({ id: created.id, collectorId, customerId: created.customerId, name: created.name || null, phone })
        .onConflictDoNothing({ target: rechargePerson.id })
    return created.id
}

const saleInput = z.object({
    id: entryId,
    provider,
    stock,
    date: isoDate,
    at,
    amount: money,
    personId: z.string().max(80).nullable(),
    newPerson,
    online: z.boolean().optional(),
})

export async function rechargeSale(input: z.input<typeof saleInput>) {
    const collectorId = await actionCollectorId()
    const v = saleInput.parse(input)
    const personId = v.personId ? await resolvePerson(collectorId, v.personId, v.newPerson) : null
    await db
        .insert(rechargeEntry)
        .values({ id: v.id, collectorId, kind: "sell", provider: v.provider, stock: v.stock, date: v.date, at: new Date(v.at), amount: v.amount, personId, online: !personId && !!v.online })
        .onConflictDoNothing({ target: rechargeEntry.id })
    await reopenFrom(collectorId, v.date)
}

const buyInput = z.object({ id: entryId, provider, stock, date: isoDate, at, face: money, paid: money })

export async function rechargeBuy(input: z.input<typeof buyInput>) {
    const collectorId = await actionCollectorId()
    const v = buyInput.parse(input)
    await db
        .insert(rechargeEntry)
        .values({ id: v.id, collectorId, kind: "buy", provider: v.provider, stock: v.stock, date: v.date, at: new Date(v.at), amount: v.face, paid: v.paid })
        .onConflictDoNothing({ target: rechargeEntry.id })
    await reopenFrom(collectorId, v.date)
}

const countInput = z.object({ id: entryId, provider, stock, date: isoDate, at, counted: z.number().finite().min(0).max(10_000_000), note: z.enum(["lost", "other"]).nullable().optional() })

export async function rechargeCount(input: z.input<typeof countInput>) {
    const collectorId = await actionCollectorId()
    const v = countInput.parse(input)
    await db
        .insert(rechargeEntry)
        .values({ id: v.id, collectorId, kind: "count", provider: v.provider, stock: v.stock, date: v.date, at: new Date(v.at), amount: v.counted, note: v.note ?? null })
        .onConflictDoNothing({ target: rechargeEntry.id })
    await reopenFrom(collectorId, v.date)
}

const paybackInput = z.object({ id: entryId, personId: z.string().max(80), date: isoDate, at, amount: money, newPerson, online: z.boolean().optional() })

export async function rechargePayback(input: z.input<typeof paybackInput>) {
    const collectorId = await actionCollectorId()
    const v = paybackInput.parse(input)
    const personId = await resolvePerson(collectorId, v.personId, v.newPerson)
    await db
        .insert(rechargeEntry)
        .values({ id: v.id, collectorId, kind: "payback", date: v.date, at: new Date(v.at), amount: v.amount, personId, online: !!v.online })
        .onConflictDoNothing({ target: rechargeEntry.id })
}

/** Removes a mistaken entry (a wrong chip, a wrong purchase). Already gone is fine. */
export async function rechargeRemove(input: { id: string }) {
    const collectorId = await actionCollectorId()
    const id = entryId.parse(input.id)
    const [gone] = await db
        .delete(rechargeEntry)
        .where(and(eq(rechargeEntry.collectorId, collectorId), eq(rechargeEntry.id, id)))
        .returning({ date: rechargeEntry.date })
    if (gone) await reopenFrom(collectorId, gone.date)
}
