"use server"

import { z } from "zod"
import { cookies } from "next/headers"
import { db, and, eq, sql, asc, inArray } from "@repo/db"
import { collectorSettings, holiday, collectionEntry } from "@repo/db/schema"
import { adDayOfWeek } from "@repo/calendar"
import { actionCollectorId } from "@/lib/session"
import { getSettings } from "@/lib/collection/server"

export interface SettingsView {
    language: "ne" | "en"
    workingDays: number[]
    bankDeadlineDay: number | null
    reminderDaysBefore: number
    defaultRatePer100: number
    compoundingEnabled: boolean
    interestBasis: "balance" | "principal"
    holidays: { id: string; date: string; label: string | null }[]
}

export async function fetchSettings(): Promise<SettingsView> {
    const collectorId = await actionCollectorId()
    const [s, hs] = await Promise.all([
        getSettings(collectorId),
        db
            .select({ id: holiday.id, date: holiday.date, label: holiday.label })
            .from(holiday)
            .where(eq(holiday.collectorId, collectorId))
            .orderBy(asc(holiday.date)),
    ])
    return {
        language: s.language,
        workingDays: s.workingDays,
        bankDeadlineDay: s.bankDeadlineDay,
        reminderDaysBefore: s.reminderDaysBefore,
        defaultRatePer100: s.defaultRatePer100,
        compoundingEnabled: s.compoundingEnabled,
        interestBasis: s.interestBasis,
        holidays: hs,
    }
}

const settingsPatch = z
    .object({
        language: z.enum(["ne", "en"]),
        workingDays: z.array(z.number().int().min(0).max(6)).max(7),
        bankDeadlineDay: z.number().int().min(1).max(32).nullable(),
        reminderDaysBefore: z.number().int().min(0).max(15),
        defaultRatePer100: z.number().min(0).max(100),
        compoundingEnabled: z.boolean(),
        interestBasis: z.enum(["balance", "principal"]),
    })
    .partial()

export async function updateSettings(patch: z.input<typeof settingsPatch>): Promise<{ ok: true }> {
    const collectorId = await actionCollectorId()
    const p = settingsPatch.parse(patch)
    await getSettings(collectorId)
    await db.update(collectorSettings).set(p).where(eq(collectorSettings.userId, collectorId))
    if (p.language) {
        const jar = await cookies()
        jar.set("sajilo.lang", p.language, { path: "/", maxAge: 31536000, sameSite: "lax" })
    }
    if (p.workingDays) await resyncWorkingDays(collectorId, p.workingDays)
    return { ok: true }
}

// Only untouched days change. Anything he already marked stays as he marked it.
async function resyncWorkingDays(collectorId: string, workingDays: number[]) {
    const holidays = new Set(
        (await db.select({ date: holiday.date }).from(holiday).where(eq(holiday.collectorId, collectorId))).map((h) => h.date),
    )
    const rows = await db
        .select({ id: collectionEntry.id, date: collectionEntry.date, status: collectionEntry.status })
        .from(collectionEntry)
        .where(
            and(
                eq(collectionEntry.collectorId, collectorId),
                sql`${collectionEntry.status} in ('pending', 'holiday')`,
                eq(collectionEntry.amountReceived, 0),
                sql`${collectionEntry.markedAt} is null`,
            ),
        )
    const toHoliday: string[] = []
    const toPending: string[] = []
    for (const r of rows) {
        const off = !workingDays.includes(adDayOfWeek(r.date)) || holidays.has(r.date)
        if (off && r.status === "pending") toHoliday.push(r.id)
        if (!off && r.status === "holiday") toPending.push(r.id)
    }
    const ops = []
    if (toHoliday.length) ops.push(db.update(collectionEntry).set({ status: "holiday" }).where(inArray(collectionEntry.id, toHoliday)))
    if (toPending.length) ops.push(db.update(collectionEntry).set({ status: "pending" }).where(inArray(collectionEntry.id, toPending)))
    if (ops.length) await db.batch(ops as [(typeof ops)[number], ...(typeof ops)[number][]])
}

export async function addHoliday(date: string, label?: string): Promise<{ ok: true }> {
    const collectorId = await actionCollectorId()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("invalid date")
    await db.batch([
        db
            .insert(holiday)
            .values({ collectorId, date, label: label?.trim() || null })
            .onConflictDoNothing(),
        db
            .update(collectionEntry)
            .set({ status: "holiday" })
            .where(
                and(
                    eq(collectionEntry.collectorId, collectorId),
                    eq(collectionEntry.date, date),
                    eq(collectionEntry.status, "pending"),
                    eq(collectionEntry.amountReceived, 0),
                ),
            ),
    ])
    return { ok: true }
}

export async function removeHoliday(id: string): Promise<{ ok: true }> {
    const collectorId = await actionCollectorId()
    const h = await db.query.holiday.findFirst({ where: and(eq(holiday.id, id), eq(holiday.collectorId, collectorId)) })
    if (!h) return { ok: true }
    const s = await getSettings(collectorId)
    const working = s.workingDays.includes(adDayOfWeek(h.date))
    await db.batch([
        db.delete(holiday).where(eq(holiday.id, id)),
        ...(working
            ? [
                  db
                      .update(collectionEntry)
                      .set({ status: "pending" })
                      .where(
                          and(
                              eq(collectionEntry.collectorId, collectorId),
                              eq(collectionEntry.date, h.date),
                              eq(collectionEntry.status, "holiday"),
                              sql`${collectionEntry.markedAt} is null`,
                          ),
                      ),
              ]
            : []),
    ])
    return { ok: true }
}
