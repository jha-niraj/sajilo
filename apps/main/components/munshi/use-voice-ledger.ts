"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { queueOp, newOpId } from "@/lib/offline/sync"
import { addCard, confirmAll, editCard, handle, initialState, type Effect, type EngineState, type Step, type VoiceBook, type VoiceCard } from "@/lib/voice/engine"
import { loadBook, personFor, syncBook } from "@/lib/voice/book"
import type { RechargeData } from "@/lib/recharge/server"
import type { VoiceLang, Who } from "@/lib/voice/parse"
import type { QueuedOp } from "@/lib/offline/ops"

type NewOp = QueuedOp extends infer T ? (T extends { opId: string } ? Omit<T, "opId"> : never) : never

/** One save he can take back: the ops that put things back as they were. */
interface SavedGroup {
    label: string
    undo: NewOp[]
    at: number
}

export const UNDO_MS = 10_000

const label = (c: VoiceCard) => `${c.who?.name ?? c.heard}${c.amount !== null ? ` ${c.amount.toLocaleString("en-IN")}` : ""}`

/**
 * The voice ledger: runs each sentence through the engine (lib/voice/engine.ts) and saves what he
 * confirms through the offline queue, so a tick by voice is the same as a tick on Today.
 */
export function useVoiceLedger({ today, lang }: { today: string; lang: VoiceLang }) {
    const [state, setState] = useState<EngineState>(() => initialState(lang))
    const [book, setBook] = useState<VoiceBook | null>(null)
    const [last, setLast] = useState<SavedGroup | null>(null)
    const stateRef = useRef(state)
    stateRef.current = state
    const rechargeRef = useRef<RechargeData | null>(null)
    const lastRef = useRef(last)
    lastRef.current = last

    const reload = useCallback(async () => {
        const loaded = await loadBook(today, lastRef.current?.label ?? null)
        rechargeRef.current = loaded.recharge
        setBook(loaded.book)
        return loaded.book
    }, [today])

    useEffect(() => {
        void reload().then(() => syncBook(today).then(reload))
        const onSynced = () => void reload()
        window.addEventListener("sajilo:synced", onSynced)
        return () => window.removeEventListener("sajilo:synced", onSynced)
    }, [reload, today])

    const run = useCallback(
        async (effects: Effect[], b: VoiceBook) => {
            for (const e of effects) {
                if (e.type === "save") {
                    const undo: NewOp[] = []
                    for (const c of e.cards) {
                        const who = c.who!
                        const at = Date.now()
                        if (c.kind === "deposit" || c.kind === "shop_closed" || c.kind === "no_money") {
                            const prev = c.date === b.today ? b.marks[who.id] : undefined
                            const paid = c.kind === "deposit"
                            const amountReceived = paid ? (prev?.status === "paid" ? prev.amount : 0) + (c.amount ?? 0) : 0
                            await queueOp({ kind: "mark", customerId: who.id, date: c.date, status: paid ? "paid" : c.kind, amountReceived, markedAt: new Date().toISOString() } as NewOp)
                            undo.push({ kind: "mark", customerId: who.id, date: c.date, status: (prev?.status ?? "pending") as "pending", amountReceived: prev?.amount ?? 0, markedAt: new Date().toISOString() } as NewOp)
                        } else if (c.kind === "credit") {
                            const id = newOpId()
                            const p = personFor(who, rechargeRef.current)
                            await queueOp({ kind: "rechargeSale", id, provider: c.provider!, stock: c.stock!, date: c.date, at, amount: c.amount!, personId: p.personId, newPerson: p.newPerson })
                            undo.push({ kind: "rechargeRemove", id, date: c.date })
                        } else if (c.kind === "payback") {
                            const id = newOpId()
                            const p = personFor(who, rechargeRef.current)
                            await queueOp({ kind: "rechargePayback", id, personId: p.personId, date: c.date, at, amount: c.amount!, newPerson: p.newPerson })
                            undo.push({ kind: "rechargeRemove", id, date: c.date })
                        }
                    }
                    setLast({ label: e.cards.map(label).join(", "), undo, at: Date.now() })
                } else if (e.type === "undo") {
                    const g = lastRef.current
                    if (g) {
                        // Undo ops run newest first, so a customer marked twice ends where he started.
                        for (const op of [...g.undo].reverse()) {
                            const fresh = op.kind === "mark" ? { ...op, markedAt: new Date().toISOString() } : op
                            await queueOp(fresh as NewOp)
                        }
                        setLast(null)
                        lastRef.current = null
                    }
                } else if (e.type === "close") {
                    await queueOp({ kind: "closeDay", date: e.date, countedCash: e.counted })
                } else if (e.type === "alias") {
                    await queueOp({ kind: "customerAlias", customerId: e.customerId, alias: e.alias })
                }
            }
            if (effects.length) await reload()
        },
        [reload],
    )

    const apply = useCallback(
        async (step: { state: EngineState; effects: Effect[] }, b: VoiceBook) => {
            setState(step.state)
            stateRef.current = step.state
            await run(step.effects, b)
        },
        [run],
    )

    /** One sentence he said. `handled: false` means it was not about the ledger. */
    const hear = useCallback(
        async (text: string): Promise<Step> => {
            const b = book ?? (await reload())
            const step = handle(stateRef.current, text, { ...b, lastSaved: lastRef.current?.label ?? null })
            if (step.handled) await apply(step, b)
            return step
        },
        [apply, book, reload],
    )

    const edit = useCallback(
        async (id: string, patch: Partial<VoiceCard> | "remove") => {
            if (!book) return ""
            const out = editCard(stateRef.current, id, patch, book)
            await apply(out, book)
            return out.say
        },
        [apply, book],
    )

    const add = useCallback(
        async (who: Who, amount: number) => {
            if (!book) return ""
            const out = addCard(stateRef.current, who, amount, book)
            await apply(out, book)
            return out.say
        },
        [apply, book],
    )

    const confirm = useCallback(async () => {
        if (!book) return ""
        const step = confirmAll(stateRef.current, book)
        await apply(step, book)
        return step.say
    }, [apply, book])

    const undo = useCallback(async () => {
        if (!book) return
        await run([{ type: "undo" }], book)
    }, [book, run])

    const clear = useCallback(() => {
        const next = { ...stateRef.current, cards: [], awaiting: null }
        setState(next)
        stateRef.current = next
    }, [])

    return { state, book, last, hear, edit, add, confirm, undo, clear, reload }
}
