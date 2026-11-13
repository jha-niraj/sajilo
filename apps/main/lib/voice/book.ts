"use client"

/**
 * What the voice loop knows, read from the phone: today's collection snapshot, a copy of today's
 * recharge book, and everything still waiting in the outbox. Works the same offline.
 */
import { voiceRecharge } from "@/actions/voice.action"
import { idb } from "@/lib/offline/store"
import { ensureLocalDay, isOnline, refreshDay } from "@/lib/offline/sync"
import { RECHARGE_KINDS, type RechargeOp } from "@/lib/offline/ops"
import { mergeRecharge, personLabel } from "@/components/recharge/use-recharge"
import { runLedger } from "@/lib/recharge/ledger"
import type { RechargeData } from "@/lib/recharge/server"
import type { Pool, VoiceBook } from "./engine"
import type { Who } from "./parse"

const RECHARGE_KEY = "voiceRecharge"

export interface LoadedBook {
    book: VoiceBook
    recharge: RechargeData | null
}

/** Pull fresh copies when there is signal; otherwise use what the phone saved last time. */
export async function syncBook(today: string): Promise<void> {
    if (!isOnline()) return
    await Promise.all([
        refreshDay(today),
        voiceRecharge()
            .then((data) => idb().meta.put({ key: RECHARGE_KEY, value: data }))
            .catch(() => {}),
    ])
}

export async function loadBook(today: string, lastSaved: string | null): Promise<LoadedBook> {
    await ensureLocalDay(today)
    const db = idb()
    const [snap, meta, ops] = await Promise.all([
        db.snapshots.get(today),
        db.meta.get(RECHARGE_KEY),
        db.outbox.where("kind").anyOf([...RECHARGE_KINDS]).sortBy("createdAt") as Promise<RechargeOp[]>,
    ])
    const saved = meta?.value as RechargeData | undefined
    const recharge = saved && saved.today === today ? saved : saved ? { ...saved, today } : null

    const stock: Record<Pool, number> = { "ntc:eload": 0, "ntc:card": 0, "ncell:eload": 0, "ncell:card": 0 }
    let rechargeCashToday = 0
    let people: { id: string; name: string | null; phone: string | null; customerId: string | null; owed: number }[] = []
    if (recharge) {
        const merged = mergeRecharge(recharge, ops, new Set())
        const run = runLedger(recharge.start, merged.events)
        for (const p of Object.keys(stock) as Pool[]) stock[p] = run.state[p]?.stock ?? 0
        rechargeCashToday = run.days.get(today)?.cash ?? 0
        people = merged.people
    }

    const customers = snap?.customers ?? []
    const owedByCustomer = new Map(people.filter((p) => p.customerId).map((p) => [p.customerId!, p.owed]))
    const who: Who[] = [
        ...customers.map((c) => ({ kind: "customer" as const, id: c.id, name: c.name, aliases: c.aliases ?? [], daily: c.defaultAmount, owes: owedByCustomer.get(c.id) ?? 0 })),
        ...people
            .filter((p) => !p.customerId && (p.name || p.phone))
            .map((p) => ({ kind: "person" as const, id: p.id, name: personLabel(p, recharge?.customers ?? []), owes: p.owed })),
    ]

    const entries = snap?.entries ?? []
    const marks = Object.fromEntries(entries.map((e) => [e.customerId, { status: e.status, amount: e.amountReceived }]))
    const unpaid = snap?.isWorkingDay === false ? [] : customers.filter((c) => !marks[c.id] || marks[c.id]!.status === "pending").map((c) => c.name)

    return {
        recharge,
        book: {
            today,
            lockedToday: Boolean(snap?.lockedAt),
            people: who,
            marks,
            unpaid,
            collectionToday: entries.reduce((s, e) => s + (e.amountReceived || 0), 0),
            rechargeCashToday,
            stock,
            lastSaved,
        },
    }
}

/** The recharge person a sale or payback goes to: an existing profile, else one made for this customer. */
export function personFor(who: Who, recharge: RechargeData | null) {
    if (who.kind === "person") return { personId: who.id, newPerson: null }
    const existing = recharge?.people.find((p) => p.customerId === who.id)
    if (existing) return { personId: existing.id, newPerson: null }
    const id = `cust:${who.id}`
    return { personId: id, newPerson: { id, name: who.name, phone: null, customerId: who.id } }
}
