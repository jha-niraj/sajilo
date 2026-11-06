"use client"

import { useCallback, useEffect, useMemo, useState, useTransition } from "react"
import { toast } from "sonner"
import { AlertTriangle, CalendarDays, ChevronDown, ClipboardCheck, FileText, HandCoins, PackagePlus, X } from "lucide-react"
import { useConfirm } from "@repo/ui/components/ui/use-confirm"
import { cn } from "@repo/ui/lib/utils"
import { adToBs, toNepaliDigits } from "@repo/calendar"
import { PageTop } from "@/components/shell/page-top"
import { DayPicker } from "@/components/day-picker"
import { BottomSheet } from "@/components/bottom-sheet"
import { useI18n } from "@/lib/i18n"
import { fetchRecharge } from "@/actions/recharge.action"
import { newOpId, queueOp } from "@/lib/offline/sync"
import { idb } from "@/lib/offline/store"
import { RECHARGE_KINDS } from "@/lib/offline/ops"
import { PROVIDERS, STOCKS, poolOf, runLedger, splitPool, suggestPaid, sumDays, type Pool, type Provider, type RechargeEvent } from "@/lib/recharge/ledger"
import type { RechargeData, RechargePerson } from "@/lib/recharge/server"
import { AmountChips, SELL_CHIPS } from "./chips"
import { AmountPad } from "./amount-pad"
import { BuySheet, CountSheet, PersonSheet, UdharoSheet, type PersonPick } from "./sheets"
import { personLabel, useMerged, useShownOps } from "./use-recharge"

const PROVIDER_NAME: Record<Provider, string> = { ntc: "NTC", ncell: "Ncell" }
const PROVIDER_DOT: Record<Provider, string> = { ntc: "bg-[#1d5fb8]", ncell: "bg-[#8e5bb5]" }
const POOL_KEY = "sajilo.rechargePool"

function savedPool(): Pool {
    try {
        const v = localStorage.getItem(POOL_KEY)
        if (v && /^(ntc|ncell):(eload|card)$/.test(v)) return v as Pool
    } catch {
        // storage blocked (private mode): start on the default
    }
    return "ncell:eload"
}

export function RechargeClient({ initial }: { initial: RechargeData }) {
    const { t, money, date, weekday, month: monthLabel, lang } = useI18n()
    const { confirm, confirmDialog } = useConfirm()
    const [data, setData] = useState(initial)
    const [day, setDay] = useState(initial.today)
    const [pool, setPoolState] = useState<Pool>("ncell:eload")
    const [sheet, setSheet] = useState<null | "other" | "udharo" | "buy" | "count">(null)
    const [personId, setPersonId] = useState<string | null>(null)
    const [asking, setAsking] = useState<{ amount: number; who?: PersonPick } | null>(null)
    const [hidden, setHidden] = useState<Set<string>>(() => new Set())
    const [loading, startTransition] = useTransition()

    useEffect(() => setPoolState(savedPool()), [])
    const setPool = (p: Pool) => {
        setPoolState(p)
        try {
            localStorage.setItem(POOL_KEY, p)
        } catch {
            // storage blocked: the choice lasts for this visit only
        }
    }

    const reload = useCallback((d: string) => {
        const bs = adToBs(d)
        startTransition(async () => {
            const next = await fetchRecharge(bs.year, bs.month).catch(() => null)
            if (next) {
                setData(next)
                setHidden(new Set())
            }
        })
    }, [])

    // A day in another month needs that month's entries.
    useEffect(() => {
        const a = adToBs(day)
        const b = adToBs(data.from)
        if (a.year !== b.year || a.month !== b.month) reload(day)
    }, [day, data.from, reload])

    useEffect(() => {
        const onSynced = () => reload(day)
        window.addEventListener("sajilo:synced", onSynced)
        return () => window.removeEventListener("sajilo:synced", onSynced)
    }, [day, reload])

    const ops = useShownOps(data)
    const merged = useMerged(data, ops, hidden)
    const { state: now, days } = useMemo(() => runLedger(data.start, merged.events), [data.start, merged.events])
    const dayState = useMemo(() => (day >= data.to ? now : runLedger(data.start, merged.events.filter((e) => e.date <= day)).state), [day, data.to, data.start, merged.events, now])
    const summary = days.get(day)
    const month = sumDays(days, data.from, data.to)
    const { provider, stock } = splitPool(pool)
    const what = t("rcStockOf", { provider: PROVIDER_NAME[provider], stock: stock === "eload" ? t("rcEload") : t("rcCard") })
    const whatOf = (p: Pool) => {
        const s = splitPool(p)
        return t("rcStockOf", { provider: PROVIDER_NAME[s.provider], stock: s.stock === "eload" ? t("rcEload") : t("rcCard") })
    }
    const isToday = day === data.today
    const nameOf = (id: string | null) => {
        const p = id ? merged.people.find((x) => x.id === id) : null
        return p ? personLabel(p, data.customers) : "-"
    }

    const sell = async (amount: number, who?: PersonPick) => {
        const id = newOpId()
        await queueOp({
            kind: "rechargeSale",
            id,
            provider,
            stock,
            date: day,
            at: Date.now(),
            amount,
            personId: who?.id ?? null,
            newPerson: who?.newPerson ?? null,
        })
        toast(who ? t("rcUdharoMsg", { amount: money(amount), name: who.label }) : t("rcSoldMsg", { amount: money(amount), what }), {
            duration: 3000,
            action: { label: t("undo"), onClick: () => void remove(id, day) },
        })
    }

    /** Every sale is asked first (a stray tap must not sell), and never more than is in hand. */
    const trySell = (amount: number, who?: PersonPick) => {
        const inHand = dayState[pool].stock
        if (amount > inHand) {
            toast.error(t("rcNoStock", { amount: money(Math.max(0, inHand)), what }), {
                duration: 5000,
                action: { label: t("rcBought"), onClick: () => setSheet("buy") },
            })
            return
        }
        setAsking({ amount, who })
    }

    const remove = async (id: string, date: string) => {
        const queued = await idb()
            .outbox.where("kind")
            .anyOf([...RECHARGE_KINDS])
            .filter((o) => (o as { id?: string }).id === id)
            .toArray()
        setHidden((h) => new Set(h).add(id))
        if (queued.length) await idb().outbox.bulkDelete(queued.map((o) => o.opId))
        else await queueOp({ kind: "rechargeRemove", id, date })
    }

    const askRemove = async (e: RechargeEvent) => {
        const label = e.type === "sell" ? t("rcSale") : e.type === "buy" ? t("rcBought") : e.type === "count" ? t("rcCount") : t("rcPaidBack")
        const amount = e.type === "buy" ? e.face : e.type === "count" ? e.stock : e.amount
        if (!(await confirm({ title: t("rcRemoveTitle", { what: `${label} ${money(amount)}` }), destructive: true, confirmText: t("yes"), cancelText: t("no") }))) return
        await remove(e.id, e.date)
    }

    const buy = async (face: number, paid: number) => {
        await queueOp({ kind: "rechargeBuy", id: newOpId(), provider, stock, date: day, at: Date.now(), face, paid })
        toast(t("rcBoughtMsg", { amount: money(face), what }))
    }
    const count = async (counted: number) => {
        await queueOp({ kind: "rechargeCount", id: newOpId(), provider, stock, date: day, at: Date.now(), counted })
        toast(t("rcCountMsg", { what, amount: money(counted) }))
    }
    const payback = async (p: RechargePerson, amount: number) => {
        await queueOp({ kind: "rechargePayback", id: newOpId(), personId: p.id, date: day, at: Date.now(), amount, newPerson: null })
        toast(t("rcPaidBackMsg", { name: personLabel(p, data.customers), amount: money(amount) }))
    }

    const dayEvents = merged.events.filter((e) => e.date === day).sort((a, b) => b.at - a.at)
    const owing = merged.people.filter((p) => p.owed > 0).sort((a, b) => b.owed - a.owed)
    const person = personId ? (merged.people.find((p) => p.id === personId) ?? null) : null
    const personHistory = person
        ? merged.events
              .filter((e): e is Extract<RechargeEvent, { type: "sell" | "payback" }> => (e.type === "sell" || e.type === "payback") && e.personId === person.id)
              .sort((a, b) => b.at - a.at)
              .map((e) => ({ id: e.id, date: e.date, amount: e.amount, kind: e.type }))
        : []
    const time = (at: number) => {
        const s = new Date(at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
        return lang === "ne" ? toNepaliDigits(s) : s
    }
    const bs = adToBs(data.from)

    return (
        <>
            <PageTop
                title={t("rcTitle")}
                subtitle={
                    <DayPicker value={day} onChange={setDay} max={data.today}>
                        <button type="button" className="-ml-1 mt-0.5 inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[15px] text-ink-2 transition-colors active:bg-paper-2">
                            <CalendarDays className="h-4 w-4 text-saffron" />
                            {weekday(day)}, {date(day, true)}
                            <ChevronDown className="h-4 w-4 text-ink-3" />
                        </button>
                    </DayPicker>
                }
            />

            <div className={cn("space-y-4 px-4 pb-6 pt-3 transition-opacity", loading && "opacity-60")}>
                {!isToday && (
                    <div className="flex items-center justify-between gap-3 rounded-2xl bg-late-soft px-4 py-3 text-late">
                        <span className="min-w-0 text-[14px] font-medium">{t("rcAddingTo", { date: date(day, true) })}</span>
                        <button type="button" onClick={() => setDay(data.today)} className="shrink-0 rounded-full bg-late px-3 py-1.5 text-[13px] font-semibold text-white">
                            {t("rcBackToToday")}
                        </button>
                    </div>
                )}

                <div className="flex items-center gap-2">
                    {PROVIDERS.map((p) => (
                        <button
                            key={p}
                            type="button"
                            onClick={() => setPool(poolOf(p, stock))}
                            aria-pressed={provider === p}
                            className={cn(
                                "inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-[15px] font-semibold transition-colors",
                                provider === p ? "bg-ink text-paper" : "bg-card text-ink-2 ring-1 ring-line active:bg-paper-2",
                            )}
                        >
                            <span className={cn("h-2 w-2 rounded-full", PROVIDER_DOT[p])} />
                            {PROVIDER_NAME[p]}
                        </button>
                    ))}
                    <div className="ml-auto grid grid-cols-2 rounded-full bg-paper-2 p-1">
                        {STOCKS.map((s) => (
                            <button
                                key={s}
                                type="button"
                                onClick={() => setPool(poolOf(provider, s))}
                                aria-pressed={stock === s}
                                className={cn("h-8 rounded-full px-3 text-[14px] font-semibold transition-colors", stock === s ? "bg-card text-ink shadow-sm" : "text-ink-3")}
                            >
                                {s === "eload" ? t("rcEload") : t("rcCard")}
                            </button>
                        ))}
                    </div>
                </div>

                <section className="rounded-[22px] bg-ink p-4 text-paper">
                    <p className="text-[14px] text-paper/70">{what}</p>
                    <p className="text-[30px] font-semibold leading-tight tabular">
                        {money(dayState[pool].stock)} <span className="text-[15px] font-normal text-paper/70">{t("rcInHand")}</span>
                    </p>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                        <Tile label={t("rcSold")} value={money(summary?.sold ?? 0)} />
                        <Tile label={t("rcProfit")} value={money(summary?.profit ?? 0)} accent />
                        <Tile label={t("rcCash")} value={money(summary?.cash ?? 0)} />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                        {(Object.keys(dayState) as Pool[])
                            .filter((p) => p !== pool)
                            .map((p) => (
                                <button key={p} type="button" onClick={() => setPool(p)} className="rounded-full bg-paper/10 px-2.5 py-1 text-[12px] text-paper/80 tabular active:bg-paper/20">
                                    {whatOf(p)} {money(dayState[p].stock)}
                                </button>
                            ))}
                    </div>
                </section>

                {dayState[pool].stock < 0 && (
                    <button type="button" onClick={() => setSheet("buy")} className="flex w-full items-center gap-2 rounded-2xl bg-miss-soft px-4 py-3 text-left text-[14px] font-medium text-miss">
                        <AlertTriangle className="h-5 w-5 shrink-0" /> {t("rcBelowZero")}
                    </button>
                )}

                <section className="space-y-2">
                    <p className="text-[14px] text-ink-2">{t("rcTapToSell")}</p>
                    <AmountChips amounts={SELL_CHIPS[stock]} short={(a) => a > dayState[pool].stock} onPick={(a) => trySell(a)} onOther={() => setSheet("other")} />
                </section>

                <div className="grid grid-cols-3 gap-2">
                    <Action icon={HandCoins} label={t("rcUdharo")} onClick={() => setSheet("udharo")} tone="late" />
                    <Action icon={PackagePlus} label={t("rcBought")} onClick={() => setSheet("buy")} />
                    <Action icon={ClipboardCheck} label={t("rcCount")} onClick={() => setSheet("count")} />
                </div>

                <section className="rounded-[22px] bg-card ring-1 ring-line">
                    <h2 className="px-4 pb-1 pt-3.5 text-[15px] font-semibold text-ink">{t("rcDayList")}</h2>
                    {dayEvents.length === 0 ? (
                        <p className="px-4 pb-4 pt-1 text-[14px] text-ink-3">{t("rcNoEntries")}</p>
                    ) : (
                        <ul className="divide-y divide-line">
                            {dayEvents.map((e) => (
                                <EntryRow
                                    key={e.id}
                                    e={e}
                                    time={time(e.at)}
                                    nameOf={nameOf}
                                    gap={e.type === "count" ? (summary?.pools[e.pool].gap ?? null) : null}
                                    unsent={merged.unsent.has(e.id)}
                                    onRemove={() => void askRemove(e)}
                                />
                            ))}
                        </ul>
                    )}
                </section>

                <section className="rounded-[22px] bg-card ring-1 ring-line">
                    <h2 className="px-4 pb-1 pt-3.5 text-[15px] font-semibold text-ink">{t("rcWhoOwes")}</h2>
                    {owing.length === 0 ? (
                        <p className="px-4 pb-4 pt-1 text-[14px] text-ink-3">{t("rcNobodyOwes")}</p>
                    ) : (
                        <ul className="divide-y divide-line">
                            {owing.map((p) => (
                                <li key={p.id}>
                                    <button type="button" onClick={() => setPersonId(p.id)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left active:bg-paper-2">
                                        <span className="min-w-0">
                                            <span className="block truncate text-[16px] font-medium text-ink">{personLabel(p, data.customers)}</span>
                                            {p.phone && <span className="block text-[13px] text-ink-3 tabular">{p.phone.replace("+977", "")}</span>}
                                        </span>
                                        <span className="shrink-0 text-[16px] font-semibold text-[#8a5a08] tabular">{money(p.owed)}</span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>

                <section className="rounded-[22px] bg-saffron-soft p-4">
                    <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                            <p className="text-[14px] text-[#7a3d10]">{t("rcMonthProfit", { month: monthLabel(bs.year, bs.month) })}</p>
                            <p className="text-[13px] text-[#7a3d10]/80">
                                {t("rcSold")} {money(month.sold)}
                            </p>
                        </div>
                        <p className="shrink-0 text-[22px] font-semibold text-[#7a3d10] tabular">{money(month.profit)}</p>
                    </div>
                    <a
                        href={`/print/recharge?y=${bs.year}&m=${bs.month}`}
                        className="mt-3 flex h-12 items-center justify-center gap-2 rounded-2xl bg-card text-[15px] font-semibold text-[#7a3d10] ring-1 ring-saffron/20 active:bg-paper-2"
                    >
                        <FileText className="h-5 w-5" /> {t("rcMonthReport")}
                    </a>
                </section>
            </div>

            <BottomSheet open={sheet === "other"} onOpenChange={(o) => setSheet(o ? "other" : null)} title={t("rcOtherTitle")} description={what}>
                <div className="pb-2">
                    {sheet === "other" && (
                        <AmountPad
                            label={t("rcSold")}
                            submitLabel={t("rcSold")}
                            onSubmit={(n) => {
                                setSheet(null)
                                trySell(n)
                            }}
                        />
                    )}
                </div>
            </BottomSheet>
            <UdharoSheet
                open={sheet === "udharo"}
                onOpenChange={(o) => setSheet(o ? "udharo" : null)}
                what={what}
                amounts={SELL_CHIPS[stock]}
                short={(a) => a > dayState[pool].stock}
                people={merged.people}
                customers={data.customers}
                onSell={(who, amount) => trySell(amount, who)}
            />
            <BuySheet open={sheet === "buy"} onOpenChange={(o) => setSheet(o ? "buy" : null)} what={what} suggest={(face) => suggestPaid(now, pool, face)} onSave={(f, p) => void buy(f, p)} />
            <CountSheet open={sheet === "count"} onOpenChange={(o) => setSheet(o ? "count" : null)} what={what} expected={dayState[pool].stock} onSave={(n) => void count(n)} />
            <PersonSheet
                person={person}
                label={person ? personLabel(person, data.customers) : ""}
                history={personHistory}
                onOpenChange={(o) => !o && setPersonId(null)}
                onPaid={(n) => person && void payback(person, n)}
            />
            <BottomSheet
                open={!!asking}
                onOpenChange={(o) => !o && setAsking(null)}
                title={asking ? (asking.who ? t("rcConfirmUdharo", { amount: money(asking.amount), name: asking.who.label }) : t("rcConfirmSell", { amount: money(asking.amount) })) : ""}
                description={what}
            >
                {asking && (
                    <div className="flex flex-col gap-3 pb-2">
                        <div className="grid grid-cols-2 gap-2">
                            <div className="rounded-2xl bg-card px-4 py-3 ring-1 ring-line">
                                <p className="text-[13px] text-ink-3">{t("rcInHandNow")}</p>
                                <p className="text-[18px] font-semibold text-ink tabular">{money(dayState[pool].stock)}</p>
                            </div>
                            <div className="rounded-2xl bg-card px-4 py-3 ring-1 ring-line">
                                <p className="text-[13px] text-ink-3">{t("rcAfterThis")}</p>
                                <p className="text-[18px] font-semibold text-ink tabular">{money(dayState[pool].stock - asking.amount)}</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-[1fr_2fr] gap-2">
                            <button type="button" onClick={() => setAsking(null)} className="h-14 rounded-2xl bg-card text-[16px] font-semibold text-ink-2 ring-1 ring-line active:bg-paper-2">
                                {t("cancel")}
                            </button>
                            <button
                                type="button"
                                autoFocus
                                onClick={() => {
                                    const a = asking
                                    setAsking(null)
                                    void sell(a.amount, a.who)
                                }}
                                className={cn("h-14 rounded-2xl text-[17px] font-semibold active:opacity-90", asking.who ? "bg-flag text-white" : "bg-ink text-paper")}
                            >
                                {asking.who ? t("rcGiveUdharo") : `${t("rcSellButton")} ${money(asking.amount)}`}
                            </button>
                        </div>
                    </div>
                )}
            </BottomSheet>
            {confirmDialog}
        </>
    )
}

function Tile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
    return (
        <div className="min-w-0 rounded-xl bg-paper/10 px-2.5 py-2">
            <p className="text-[12px] text-paper/70">{label}</p>
            <p className={cn("truncate text-[16px] font-semibold tabular", accent && "text-[#7fd3a1]")}>{value}</p>
        </div>
    )
}

function Action({ icon: Icon, label, onClick, tone }: { icon: typeof HandCoins; label: string; onClick: () => void; tone?: "late" }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                "flex h-16 flex-col items-center justify-center gap-1 rounded-2xl text-[14px] font-semibold transition-colors",
                tone === "late" ? "bg-flag-soft text-[#8a5a08] active:bg-flag/25" : "bg-card text-ink ring-1 ring-line active:bg-paper-2",
            )}
        >
            <Icon className="h-5 w-5" />
            {label}
        </button>
    )
}

/** Where an entry came from, on the left of every row: which provider and which stock. */
function SourceBadge({ pool }: { pool: Pool | null }) {
    const { t } = useI18n()
    if (!pool)
        return (
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-paid-soft text-paid">
                <HandCoins className="h-5 w-5" />
            </span>
        )
    const { provider, stock } = splitPool(pool)
    return (
        <span className="flex h-11 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-paper-2 leading-none">
            <span className="flex items-center gap-1 text-[12px] font-bold text-ink">
                <span className={cn("h-1.5 w-1.5 rounded-full", PROVIDER_DOT[provider])} />
                {PROVIDER_NAME[provider]}
            </span>
            <span className="mt-1 text-[11px] text-ink-3">{stock === "eload" ? t("rcEload") : t("rcCard")}</span>
        </span>
    )
}

function EntryRow({
    e,
    time,
    nameOf,
    gap,
    unsent,
    onRemove,
}: {
    e: RechargeEvent
    time: string
    nameOf: (id: string | null) => string
    gap: number | null
    unsent: boolean
    onRemove: () => void
}) {
    const { t, money, lang } = useI18n()
    let title = ""
    let sub = time
    let amount = ""
    let tone = "text-ink"
    if (e.type === "sell") {
        title = e.personId ? nameOf(e.personId) : t("rcSold")
        if (e.personId) sub += ` · ${t("rcUdharo")}`
        amount = money(e.amount)
        tone = e.personId ? "text-[#8a5a08]" : "text-ink"
    } else if (e.type === "buy") {
        title = t("rcBought")
        const pct = e.face > 0 ? Math.round(((e.face - e.paid) / e.face) * 1000) / 10 : 0
        sub += ` · ${t("rcYouPaid")} ${money(e.paid)} · ${t("rcMargin", { pct: lang === "ne" ? toNepaliDigits(String(pct)) : String(pct) })}`
        amount = `+ ${money(e.face)}`
        tone = "text-paid"
    } else if (e.type === "count") {
        title = t("rcCount")
        if (gap !== null) sub += ` · ${gap === 0 ? t("rcGapNone") : gap > 0 ? t("rcGapLess", { amount: money(gap) }) : t("rcGapMore", { amount: money(-gap) })}`
        amount = money(e.stock)
        tone = "text-ink-2"
    } else {
        title = nameOf(e.personId)
        sub += ` · ${t("rcPaidBack")}`
        amount = money(e.amount)
        tone = "text-paid"
    }
    return (
        <li className="flex items-center gap-3 py-2.5 pl-3 pr-1.5">
            <SourceBadge pool={e.type === "payback" ? null : e.pool} />
            <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-medium text-ink">{title}</span>
                <span className="block truncate text-[13px] text-ink-3 tabular">
                    {sub}
                    {unsent && <span className="text-saffron"> · {t("rcUnsynced")}</span>}
                </span>
            </span>
            <span className={cn("shrink-0 text-[15px] font-semibold tabular", tone)}>{amount}</span>
            <button type="button" onClick={onRemove} aria-label={t("delete")} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-3 active:bg-paper-2">
                <X className="h-4 w-4" />
            </button>
        </li>
    )
}
