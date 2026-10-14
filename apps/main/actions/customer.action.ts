"use server"

import { z } from "zod"
import { db, and, eq, asc, sql, inArray } from "@repo/db"
import { customer, collectionEntry } from "@repo/db/schema"
import { actionCollectorId } from "@/lib/session"
import { nepalToday } from "@/lib/today"

const customerInput = z.object({
    name: z.string().trim().min(1).max(120),
    defaultAmount: z.coerce.number().int().min(1).max(10_000_000),
    phone: z.string().trim().max(20).optional().nullable(),
    bankAccountNo: z.string().trim().max(40).optional().nullable(),
    startDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
    note: z.string().trim().max(500).optional().nullable(),
})

export type CustomerInput = z.input<typeof customerInput>

export interface CustomerRow {
    id: string
    name: string
    phone: string | null
    bankAccountNo: string | null
    defaultAmount: number
    routeOrder: number
    startDate: string
    isActive: boolean
    note: string | null
}

export async function listCustomers(): Promise<CustomerRow[]> {
    const collectorId = await actionCollectorId()
    return db
        .select({
            id: customer.id,
            name: customer.name,
            phone: customer.phone,
            bankAccountNo: customer.bankAccountNo,
            defaultAmount: customer.defaultAmount,
            routeOrder: customer.routeOrder,
            startDate: customer.startDate,
            isActive: customer.isActive,
            note: customer.note,
        })
        .from(customer)
        .where(eq(customer.collectorId, collectorId))
        .orderBy(asc(customer.routeOrder), asc(customer.createdAt))
}

async function nextRouteOrder(collectorId: string): Promise<number> {
    const [row] = await db
        .select({ max: sql<number>`coalesce(max(${customer.routeOrder}), 0)` })
        .from(customer)
        .where(eq(customer.collectorId, collectorId))
    return Number(row?.max ?? 0) + 1
}

export async function createCustomers(inputs: CustomerInput[]): Promise<{ count: number }> {
    const collectorId = await actionCollectorId()
    const parsed = inputs.map((i) => customerInput.parse(i))
    if (parsed.length === 0) return { count: 0 }
    const start = await nextRouteOrder(collectorId)
    const today = nepalToday()
    await db.insert(customer).values(
        parsed.map((p, i) => ({
            collectorId,
            name: p.name,
            defaultAmount: p.defaultAmount,
            phone: p.phone || null,
            bankAccountNo: p.bankAccountNo || null,
            note: p.note || null,
            startDate: p.startDate ?? today,
            routeOrder: start + i,
        })),
    )
    return { count: parsed.length }
}

export async function updateCustomer(id: string, input: CustomerInput): Promise<{ ok: true }> {
    const collectorId = await actionCollectorId()
    const p = customerInput.parse(input)
    const today = nepalToday()
    await db.batch([
        db
            .update(customer)
            .set({
                name: p.name,
                defaultAmount: p.defaultAmount,
                phone: p.phone || null,
                bankAccountNo: p.bankAccountNo || null,
                note: p.note || null,
                ...(p.startDate ? { startDate: p.startDate } : {}),
            })
            .where(and(eq(customer.id, id), eq(customer.collectorId, collectorId))),
        // A new daily amount applies from today on; past days keep what was expected then.
        db
            .update(collectionEntry)
            .set({ expectedAmount: p.defaultAmount })
            .where(
                and(
                    eq(collectionEntry.customerId, id),
                    eq(collectionEntry.collectorId, collectorId),
                    sql`${collectionEntry.date} >= ${today}`,
                ),
            ),
    ])
    return { ok: true }
}

export async function setCustomerActive(id: string, isActive: boolean): Promise<{ ok: true }> {
    const collectorId = await actionCollectorId()
    const today = nepalToday()
    await db.batch([
        db
            .update(customer)
            .set({ isActive })
            .where(and(eq(customer.id, id), eq(customer.collectorId, collectorId))),
        // Stopping removes today's untouched row so it doesn't become a due.
        ...(isActive
            ? []
            : [
                  db
                      .delete(collectionEntry)
                      .where(
                          and(
                              eq(collectionEntry.customerId, id),
                              eq(collectionEntry.collectorId, collectorId),
                              sql`${collectionEntry.date} >= ${today}`,
                              eq(collectionEntry.amountReceived, 0),
                          ),
                      ),
              ]),
    ])
    return { ok: true }
}

export async function reorderCustomers(orderedIds: string[]): Promise<{ ok: true }> {
    const collectorId = await actionCollectorId()
    if (orderedIds.length === 0) return { ok: true }
    const owned = await db
        .select({ id: customer.id })
        .from(customer)
        .where(and(eq(customer.collectorId, collectorId), inArray(customer.id, orderedIds)))
    const ownedSet = new Set(owned.map((o) => o.id))
    const cases = orderedIds
        .filter((id) => ownedSet.has(id))
        .map((id, i) => sql`when ${customer.id} = ${id} then ${i + 1}`)
    if (cases.length === 0) return { ok: true }
    await db
        .update(customer)
        .set({ routeOrder: sql`case ${sql.join(cases, sql` `)} else ${customer.routeOrder} end` })
        .where(and(eq(customer.collectorId, collectorId), inArray(customer.id, [...ownedSet])))
    return { ok: true }
}
