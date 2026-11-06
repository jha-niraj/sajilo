"use client"

import { useMemo, useState } from "react"
import { useLiveQuery } from "dexie-react-hooks"
import { RECHARGE_KINDS, type RechargeOp } from "@/lib/offline/ops"
import { idb } from "@/lib/offline/store"
import { poolOf, type RechargeEvent } from "@/lib/recharge/ledger"
import type { RechargeData, RechargePerson } from "@/lib/recharge/server"

/** Recharge ops still on the phone, oldest first. */
export function usePendingRechargeOps(): RechargeOp[] {
    return useLiveQuery(() => idb().outbox.where("kind").anyOf([...RECHARGE_KINDS]).sortBy("createdAt"), [], []) as RechargeOp[]
}

/**
 * Ops stay shown after they leave the outbox until fresh server data replaces them, so a sale never
 * blinks out between "sent" and "page refreshed".
 */
export function useShownOps(data: RechargeData): RechargeOp[] {
    const live = usePendingRechargeOps()
    const [kept] = useState(() => ({ data, map: new Map<string, RechargeOp>() }))
    return useMemo(() => {
        if (kept.data !== data) {
            kept.data = data
            kept.map = new Map()
        }
        for (const op of live) kept.map.set(op.opId, op)
        return [...kept.map.values()]
    }, [live, data, kept])
}

export interface MergedRecharge {
    events: RechargeEvent[]
    people: RechargePerson[]
    /** entry ids saved on this phone and not yet on the server */
    unsent: Set<string>
}

/** Server entries plus what is still on the phone: the same numbers with or without signal. */
export function mergeRecharge(data: RechargeData, ops: RechargeOp[], hidden: Set<string>): MergedRecharge {
    const known = new Map(data.events.map((e) => [e.id, e]))
    const removed = new Set([...hidden, ...ops.filter((o) => o.kind === "rechargeRemove").map((o) => o.id)])
    const extra: RechargeEvent[] = []
    const unsent = new Set<string>()
    const people = data.people.map((p) => ({ ...p }))
    const delta = new Map<string, number>()
    const add = (id: string, n: number) => delta.set(id, (delta.get(id) ?? 0) + n)

    for (const o of ops) {
        if (o.kind === "rechargeRemove" || known.has(o.id)) continue
        unsent.add(o.id)
        if (o.kind === "rechargeSale") {
            const personId = o.newPerson && people.some((p) => p.phone && p.phone === o.newPerson?.phone) ? people.find((p) => p.phone === o.newPerson?.phone)!.id : o.personId
            extra.push({ type: "sell", id: o.id, pool: poolOf(o.provider, o.stock), date: o.date, at: o.at, amount: o.amount, personId })
            if (o.newPerson && personId === o.newPerson.id && !people.some((p) => p.id === o.newPerson!.id)) {
                people.push({ id: o.newPerson.id, name: o.newPerson.name, phone: o.newPerson.phone, customerId: o.newPerson.customerId, owed: 0 })
            }
            if (personId && !removed.has(o.id)) add(personId, o.amount)
        } else if (o.kind === "rechargeBuy") {
            extra.push({ type: "buy", id: o.id, pool: poolOf(o.provider, o.stock), date: o.date, at: o.at, face: o.face, paid: o.paid })
        } else if (o.kind === "rechargeCount") {
            extra.push({ type: "count", id: o.id, pool: poolOf(o.provider, o.stock), date: o.date, at: o.at, stock: o.counted })
        } else if (o.kind === "rechargePayback") {
            extra.push({ type: "payback", id: o.id, personId: o.personId, date: o.date, at: o.at, amount: o.amount })
            if (!removed.has(o.id)) add(o.personId, -o.amount)
        }
    }
    for (const id of removed) {
        const e = known.get(id)
        if (e?.type === "sell" && e.personId) add(e.personId, -e.amount)
        if (e?.type === "payback") add(e.personId, e.amount)
    }
    for (const p of people) p.owed = Math.round((p.owed + (delta.get(p.id) ?? 0)) * 100) / 100

    return { events: [...data.events, ...extra].filter((e) => !removed.has(e.id)), people, unsent }
}

/** A person's name as he knows them: their own name, their customer's name, else their phone. */
export function personLabel(p: Pick<RechargePerson, "name" | "phone" | "customerId">, customers: RechargeData["customers"]): string {
    if (p.name) return p.name
    const c = p.customerId ? customers.find((x) => x.id === p.customerId) : null
    return c?.name ?? p.phone ?? "-"
}

export function useMerged(data: RechargeData, ops: RechargeOp[], hidden: Set<string>) {
    return useMemo(() => mergeRecharge(data, ops, hidden), [data, ops, hidden])
}
