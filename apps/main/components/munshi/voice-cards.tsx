"use client"

import { useEffect, useMemo, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { AlertTriangle, Check, Hand, RotateCcw, X } from "lucide-react"
import { cn } from "@repo/ui/lib/utils"
import { Input } from "@repo/ui/components/ui/input"
import { ScrollArea } from "@repo/ui/components/ui/scroll-area"
import { BottomSheet } from "@/components/bottom-sheet"
import { Keypad } from "@/components/keypad"
import { useI18n } from "@/lib/i18n"
import { cardNeed, cardWarn, type VoiceBook, type VoiceCard } from "@/lib/voice/engine"
import type { EntryKind, Who } from "@/lib/voice/parse"
import { UNDO_MS } from "./use-voice-ledger"

const KIND_KEY: Record<EntryKind, "vcDeposit" | "vcCredit" | "vcPayback" | "vcShopClosed" | "vcNoMoney"> = {
    deposit: "vcDeposit",
    credit: "vcCredit",
    payback: "vcPayback",
    shop_closed: "vcShopClosed",
    no_money: "vcNoMoney",
}
const NETWORKS = [
    { provider: "ntc", stock: "eload", label: "NTC", dot: "bg-[#1d5fb8]" },
    { provider: "ntc", stock: "card", label: "NTC", dot: "bg-[#1d5fb8]" },
    { provider: "ncell", stock: "eload", label: "Ncell", dot: "bg-[#8e5bb5]" },
    { provider: "ncell", stock: "card", label: "Ncell", dot: "bg-[#8e5bb5]" },
] as const

/**
 * The cards the voice loop is holding: what he said, as it will be saved. Every question the voice
 * asks (which name, deposit or payback, which network, how much) can also be answered with a tap.
 */
export function VoiceCards({
    cards,
    book,
    busy,
    onEdit,
    onConfirm,
    onCancel,
}: {
    cards: VoiceCard[]
    book: VoiceBook
    busy?: boolean
    onEdit: (id: string, patch: Partial<VoiceCard> | "remove") => void
    onConfirm: () => void
    onCancel: () => void
}) {
    const { t } = useI18n()
    const [picking, setPicking] = useState<string | null>(null)
    const [typing, setTyping] = useState<string | null>(null)
    const ready = cards.every((c) => !cardNeed(c, book))

    if (!cards.length) return null
    return (
        <div className="w-full space-y-2.5">
            <AnimatePresence initial={false}>
                {cards.map((c) => (
                    <CardRow key={c.id} c={c} book={book} onEdit={onEdit} onPick={() => setPicking(c.id)} onType={() => setTyping(c.id)} />
                ))}
            </AnimatePresence>
            <div className="grid grid-cols-[1fr_2fr] gap-2">
                <button type="button" disabled={busy} onClick={onCancel} className="flex h-14 items-center justify-center gap-1.5 rounded-2xl bg-paper-2 text-[16px] font-semibold text-ink-2 disabled:opacity-50">
                    <X className="h-5 w-5" /> {t("cancel")}
                </button>
                <button
                    type="button"
                    disabled={busy || !ready}
                    onClick={onConfirm}
                    className="flex h-14 items-center justify-center gap-1.5 rounded-2xl bg-paid text-[17px] font-semibold text-white disabled:opacity-40"
                >
                    <Check className="h-5 w-5" strokeWidth={3} /> {cards.length > 1 ? t("vcSaveAll", { count: cards.length }) : t("vcSave")}
                </button>
            </div>
            <PeopleSheet
                open={picking !== null}
                onOpenChange={(o) => !o && setPicking(null)}
                people={book.people}
                onPick={(who) => {
                    if (picking) onEdit(picking, { who })
                    setPicking(null)
                }}
            />
            <AmountSheet
                open={typing !== null}
                onOpenChange={(o) => !o && setTyping(null)}
                initial={cards.find((c) => c.id === typing)?.amount ?? null}
                onDone={(amount) => {
                    if (typing) onEdit(typing, { amount })
                    setTyping(null)
                }}
            />
        </div>
    )
}

function CardRow({ c, book, onEdit, onPick, onType }: { c: VoiceCard; book: VoiceBook; onEdit: (id: string, patch: Partial<VoiceCard> | "remove") => void; onPick: () => void; onType: () => void }) {
    const { t, money } = useI18n()
    const need = cardNeed(c, book)
    const warn = cardWarn(c, book)
    const pool = c.provider && c.stock ? (`${c.provider}:${c.stock}` as const) : null
    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className={cn("overflow-hidden rounded-[22px] bg-card ring-1", need ? "ring-saffron/60" : warn ? "ring-miss/40" : "ring-line")}
        >
            <div className="flex items-start gap-3 p-4">
                <div className="min-w-0 flex-1">
                    <button type="button" onClick={onPick} className="block max-w-full truncate text-left text-[20px] font-semibold leading-tight text-ink">
                        {c.who?.name ?? <span className="text-saffron">{c.heard || t("vcWhoPaid")}</span>}
                    </button>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {c.kind && <span className="rounded-full bg-saffron-soft px-2.5 py-0.5 text-[13px] font-semibold text-saffron">{t(KIND_KEY[c.kind])}</span>}
                        {pool && (
                            <span className="rounded-full bg-paper-2 px-2.5 py-0.5 text-[13px] font-medium text-ink-2">
                                {c.provider === "ntc" ? "NTC" : "Ncell"} · {c.stock === "eload" ? t("rcEload") : t("rcCard")}
                            </span>
                        )}
                        {c.date !== book.today && <span className="rounded-full bg-paper-2 px-2.5 py-0.5 text-[13px] font-medium text-ink-2">{t("vcYesterday")}</span>}
                    </div>
                </div>
                {c.amount !== null ? (
                    <button type="button" onClick={onType} className="shrink-0 text-right text-[30px] font-bold leading-none tabular-nums text-ink">
                        {money(c.amount)}
                    </button>
                ) : null}
                <button type="button" aria-label={t("cancel")} onClick={() => onEdit(c.id, "remove")} className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-3 active:bg-paper-2">
                    <X className="h-4 w-4" />
                </button>
            </div>

            {warn && !need && (
                <p className="flex items-center gap-2 border-t border-line bg-miss-soft px-4 py-2 text-[14px] font-medium text-miss">
                    <AlertTriangle className="h-4 w-4 shrink-0" /> {warn === "duplicate" ? t("vcAlready") : t("vcUnusual")}
                </p>
            )}

            {need && (
                <div className="border-t border-line bg-saffron-soft/40 px-4 py-3">
                    {need === "name" && (
                        <>
                            <p className="mb-2 text-[14px] font-medium text-ink-2">{c.options.length ? t("vcWhich") : t("vcNotInList", { name: c.heard })}</p>
                            <div className="grid grid-cols-2 gap-2">
                                {c.options.map((o) => (
                                    <button key={o.id} type="button" onClick={() => onEdit(c.id, { who: o })} className="min-h-12 rounded-xl bg-card px-3 text-[15px] font-semibold text-ink ring-1 ring-line active:bg-paper-2">
                                        {o.name}
                                    </button>
                                ))}
                                <button type="button" onClick={onPick} className="min-h-12 rounded-xl bg-ink px-3 text-[15px] font-semibold text-paper">
                                    {t("vcPick")}
                                </button>
                            </div>
                        </>
                    )}
                    {need === "kind" && (
                        <div className="grid grid-cols-2 gap-2">
                            {(["deposit", "payback"] as const).map((k) => (
                                <button key={k} type="button" onClick={() => onEdit(c.id, { kind: k })} className="min-h-12 rounded-xl bg-card px-3 text-[15px] font-semibold text-ink ring-1 ring-line active:bg-paper-2">
                                    {t(KIND_KEY[k])}
                                </button>
                            ))}
                        </div>
                    )}
                    {need === "network" && (
                        <>
                            <p className="mb-2 text-[14px] font-medium text-ink-2">{t("vcNetwork")}</p>
                            <div className="grid grid-cols-2 gap-2">
                                {NETWORKS.map((n) => (
                                    <button
                                        key={`${n.provider}:${n.stock}`}
                                        type="button"
                                        onClick={() => onEdit(c.id, { provider: n.provider, stock: n.stock })}
                                        className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-card px-3 text-[15px] font-semibold text-ink ring-1 ring-line active:bg-paper-2"
                                    >
                                        <span className={cn("h-2.5 w-2.5 rounded-full", n.dot)} />
                                        {n.label} · {n.stock === "eload" ? t("rcEload") : t("rcCard")}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                    {need === "amount" && (
                        <button type="button" onClick={onType} className="min-h-12 w-full rounded-xl bg-ink px-3 text-[15px] font-semibold text-paper">
                            {t("vcEnterAmount")}
                        </button>
                    )}
                    {need === "stock" && pool && <p className="text-[14px] font-medium text-miss">{t("vcStockLeft", { amount: money(book.stock[pool] ?? 0) })}</p>}
                </div>
            )}
        </motion.div>
    )
}

/** Shown for ten seconds after a save: what was saved, and a way to take it back. */
export function UndoBar({ label, at, onUndo }: { label: string; at: number; onUndo: () => void }) {
    const { t } = useI18n()
    const [now, setNow] = useState(() => Date.now())
    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 250)
        return () => clearInterval(id)
    }, [])
    const left = Math.max(0, UNDO_MS - (now - at))
    if (!left) return null
    return (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="relative w-full overflow-hidden rounded-2xl bg-ink text-paper">
            <div className="flex items-center gap-3 px-4 py-3">
                <Check className="h-5 w-5 shrink-0 text-paid" strokeWidth={3} />
                <p className="min-w-0 flex-1 truncate text-[15px] font-medium">{t("vcSavedLabel", { what: label })}</p>
                <button type="button" onClick={onUndo} className="flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-paper/15 px-3.5 text-[14px] font-semibold">
                    <RotateCcw className="h-4 w-4" /> {t("vcUndo")}
                </button>
            </div>
            <span className="absolute bottom-0 left-0 h-0.5 bg-saffron transition-[width] duration-200" style={{ width: `${(left / UNDO_MS) * 100}%` }} />
        </motion.div>
    )
}

export function PeopleSheet({ open, onOpenChange, people, onPick }: { open: boolean; onOpenChange: (o: boolean) => void; people: Who[]; onPick: (who: Who) => void }) {
    const { t } = useI18n()
    const [q, setQ] = useState("")
    const shown = useMemo(() => people.filter((p) => p.name.toLowerCase().includes(q.trim().toLowerCase())), [people, q])
    return (
        <BottomSheet open={open} onOpenChange={onOpenChange} title={t("vcWhoPaid")} half>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchCustomer")} className="mb-3 h-12 rounded-xl text-[16px]" />
            <ScrollArea orientation="vertical" viewportClassName="max-h-[45dvh]">
                <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-card ring-1 ring-line">
                    {shown.map((p) => (
                        <li key={`${p.kind}:${p.id}`}>
                            <button type="button" onClick={() => onPick(p)} className="flex min-h-14 w-full items-center justify-between gap-3 px-4 text-left active:bg-paper-2">
                                <span className="truncate text-[16px] font-medium text-ink">{p.name}</span>
                                {p.kind === "person" && <span className="shrink-0 text-[12px] text-ink-3">{t("vcCredit")}</span>}
                            </button>
                        </li>
                    ))}
                </ul>
            </ScrollArea>
        </BottomSheet>
    )
}

export function AmountSheet({
    open,
    onOpenChange,
    initial,
    onDone,
    doneLabel,
}: {
    open: boolean
    onOpenChange: (o: boolean) => void
    initial: number | null
    onDone: (amount: number) => void
    doneLabel?: string
}) {
    const { t, money } = useI18n()
    const [value, setValue] = useState("")
    useEffect(() => {
        if (open) setValue(initial ? String(initial) : "")
    }, [open, initial])
    const n = Number(value) || 0
    return (
        <BottomSheet open={open} onOpenChange={onOpenChange} title={t("vcEnterAmount")}>
            <p className="mb-3 text-center text-[36px] font-bold tabular-nums text-ink">{money(n)}</p>
            <Keypad compact extraKey="00" onKey={(k) => setValue((v) => (k === "del" ? v.slice(0, -1) : (v + k).replace(/^0+/, "").slice(0, 8)))} />
            <button type="button" disabled={!n} onClick={() => onDone(n)} className="mt-3 flex h-14 w-full items-center justify-center rounded-2xl bg-ink text-[17px] font-semibold text-paper disabled:opacity-40">
                {doneLabel ?? t("vcSave")}
            </button>
        </BottomSheet>
    )
}

/** After two misheard tries: pick the person from the list and type the amount. */
export function ByHandSheet({ open, onOpenChange, people, onAdd }: { open: boolean; onOpenChange: (o: boolean) => void; people: Who[]; onAdd: (who: Who, amount: number) => void }) {
    const { t } = useI18n()
    const [who, setWho] = useState<Who | null>(null)
    useEffect(() => {
        if (!open) setWho(null)
    }, [open])
    return (
        <>
            <PeopleSheet open={open && !who} onOpenChange={onOpenChange} people={people} onPick={setWho} />
            <AmountSheet
                open={open && !!who}
                onOpenChange={(o) => !o && onOpenChange(false)}
                initial={who?.daily ?? null}
                doneLabel={t("vcAdd")}
                onDone={(amount) => {
                    if (who) onAdd(who, amount)
                    onOpenChange(false)
                }}
            />
        </>
    )
}

export function ByHandButton({ onClick }: { onClick: () => void }) {
    const { t } = useI18n()
    return (
        <button type="button" onClick={onClick} className="flex h-11 items-center gap-2 rounded-full bg-card px-4 text-[14px] font-semibold text-ink-2 ring-1 ring-line active:bg-paper-2">
            <Hand className="h-4 w-4" /> {t("vcByHand")}
        </button>
    )
}
