"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Lock, Search, UserPlus, CheckCheck, Coffee, CalendarDays, ChevronDown } from "lucide-react"
import { cn } from "@repo/ui/lib/utils"
import { Skeleton } from "@repo/ui/components/ui/skeleton"
import { PageTop } from "@/components/shell/page-top"
import { DayPicker } from "@/components/day-picker"
import { useI18n } from "@/lib/i18n"
import type { EntryStatus } from "@/lib/collection/types"
import { useDay, useNepalToday, type DayRow } from "./use-day"
import { CustomerRow } from "./customer-row"
import { RowSheet } from "./row-sheet"

export function TodayClient({ deadlineSlot }: { deadlineSlot?: React.ReactNode }) {
    const { t, money, num, date: fmtDate, weekday } = useI18n()
    const today = useNepalToday()
    const [day, setDay] = useState(today)
    const isToday = day === today
    const { snapshot, rows, totals, loading, failed, mark } = useDay(day)
    const [query, setQuery] = useState("")
    const [sheet, setSheet] = useState<{ row: DayRow; seq: number } | null>(null)
    const [sheetOpen, setSheetOpen] = useState(false)
    const scrolled = useRef(false)
    const router = useRouter()

    // Server-rendered bits (deposit banner total) catch up once marks reach the server.
    useEffect(() => {
        const onSynced = () => router.refresh()
        window.addEventListener("sajilo:synced", onSynced)
        return () => window.removeEventListener("sajilo:synced", onSynced)
    }, [router])

    const locked = Boolean(snapshot?.lockedAt)
    const carryBy = useMemo(() => new Map(snapshot?.carry.map((c) => [c.customerId, c]) ?? []), [snapshot])

    const visible = useMemo(() => {
        const q = query.trim().toLowerCase()
        return q ? rows.filter((r) => r.customer.name.toLowerCase().includes(q)) : rows
    }, [rows, query])

    useEffect(() => {
        if (scrolled.current || rows.length === 0) return
        scrolled.current = true
        const firstPending = rows.find((r) => r.status === "pending")
        if (firstPending && firstPending.index > 2) {
            requestAnimationFrame(() =>
                document.getElementById(`row-${firstPending.customer.id}`)?.scrollIntoView({ block: "center", behavior: "smooth" }),
            )
        }
    }, [rows])

    const setStatus = useCallback(
        (row: DayRow, status: EntryStatus, amount: number) => {
            const prev = { status: row.status, amount: row.entry?.amountReceived ?? 0 }
            void mark(row.customer.id, status, amount)
            if ("vibrate" in navigator) navigator.vibrate?.(status === "paid" ? 15 : 8)
            if (status === "pending") return
            const label =
                status === "paid" ? money(amount) : status === "shop_closed" ? t("shopClosed") : status === "no_money" ? t("noMoney") : ""
            toast(t("markedPaid", { name: row.customer.name, amount: label }), {
                duration: 3500,
                action: { label: t("undo"), onClick: () => void mark(row.customer.id, prev.status, prev.amount) },
            })
        },
        [mark, money, t],
    )

    const onTick = useCallback(
        (row: DayRow) => {
            if (row.status === "paid") {
                setSheet({ row, seq: Date.now() })
                setSheetOpen(true)
                return
            }
            setStatus(row, "paid", row.entry?.expectedAmount ?? row.customer.defaultAmount)
        },
        [setStatus],
    )

    const onOpen = useCallback((row: DayRow) => {
        setSheet({ row, seq: Date.now() })
        setSheetOpen(true)
    }, [])

    const progress = totals.expected > 0 ? Math.min(100, (totals.collected / totals.expected) * 100) : 0
    const allDone = totals.total > 0 && totals.done === totals.total
    const offDay = snapshot && !snapshot.isWorkingDay

    return (
        <>
            <PageTop
                title={isToday ? t("todayTitle") : t("pastDayTitle")}
                subtitle={
                    <DayPicker value={day} onChange={setDay} max={today}>
                        <button
                            type="button"
                            className="-ml-1 mt-0.5 inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[15px] text-ink-2 transition-colors active:bg-paper-2"
                        >
                            <CalendarDays className="h-4 w-4 text-saffron" />
                            {weekday(day)}, {fmtDate(day, true)}
                            <ChevronDown className="h-4 w-4 text-ink-3" />
                        </button>
                    </DayPicker>
                }
            />
            {isToday ? (
                deadlineSlot
            ) : (
                <div className="mx-4 mt-3 flex items-center justify-between gap-3 rounded-2xl bg-late-soft px-4 py-3 text-late">
                    <span className="text-[14px] font-medium">{t("viewingDay", { date: fmtDate(day, true) })}</span>
                    <button type="button" onClick={() => setDay(today)} className="shrink-0 rounded-full bg-late px-3 py-1.5 text-[13px] font-semibold text-white">
                        {t("backToToday")}
                    </button>
                </div>
            )}

            <section className="sticky top-[var(--offline-bar,0px)] z-30 bg-paper/95 px-4 pb-3 pt-3 backdrop-blur">
                <div className="rounded-[22px] bg-ink p-4 text-paper shadow-[0_10px_30px_-12px_rgb(42_33_24/0.5)]">
                    <div className="flex items-end justify-between gap-3">
                        <div>
                            <p className="text-[14px] text-paper/70">{t("collected")}</p>
                            <p className="text-[28px] font-semibold leading-none tabular">{money(totals.collected)}</p>
                        </div>
                        <div className="text-right text-[14px] text-paper/70">
                            <p className="tabular">
                                {t("of")} {money(totals.expected)}
                            </p>
                            <p className="mt-0.5 tabular">{t("peopleDone", { done: totals.done, total: totals.total })}</p>
                        </div>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-paper/15">
                        <div
                            className="h-full rounded-full bg-[#7fd3a1] transition-[width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    {rows.length > 0 && isToday && (
                        <Link
                            href="/today/finish"
                            className={cn(
                                "mt-3 flex h-12 items-center justify-center gap-2 rounded-2xl text-[16px] font-semibold transition-colors",
                                locked ? "bg-paper/10 text-paper/80" : allDone ? "bg-saffron text-white" : "bg-paper/10 text-paper",
                            )}
                        >
                            {locked ? <Lock className="h-5 w-5" /> : <CheckCheck className="h-5 w-5" />}
                            {locked ? t("dayLocked") : t("finishDay")}
                        </Link>
                    )}
                </div>
            </section>

            {offDay && (
                <div className="mx-4 mb-3 flex items-center gap-3 rounded-2xl bg-paper-2 px-4 py-3 text-ink-2">
                    <Coffee className="h-6 w-6 shrink-0" />
                    <div>
                        <p className="font-semibold text-ink">{t("notWorkingDay")}</p>
                        <p className="text-[14px]">{t("notWorkingDaySub")}</p>
                    </div>
                </div>
            )}

            {rows.length > 12 && (
                <div className="px-4 pb-3">
                    <label className="flex h-12 items-center gap-2 rounded-2xl bg-card px-4 ring-1 ring-line focus-within:ring-2 focus-within:ring-saffron">
                        <Search className="h-5 w-5 text-ink-3" />
                        <input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder={t("searchCustomer")}
                            className="h-full w-full bg-transparent text-[15px] outline-none placeholder:text-ink-3"
                        />
                    </label>
                </div>
            )}

            {!snapshot && (loading || !failed) ? (
                <ul className="space-y-2.5 px-4">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <li key={i}>
                            <Skeleton className="h-[78px] rounded-[22px] bg-paper-2" />
                        </li>
                    ))}
                </ul>
            ) : !snapshot ? (
                <div className="mx-4 rounded-2xl bg-miss-soft p-4 text-center text-miss">{t("somethingWrong")}</div>
            ) : rows.length === 0 ? (
                <div className="mx-4 mt-6 flex flex-col items-center rounded-[22px] bg-card px-6 py-10 text-center ring-1 ring-line">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-saffron-soft text-saffron">
                        <UserPlus className="h-8 w-8" />
                    </span>
                    <h2 className="mt-4 text-xl font-semibold text-ink">{t("noCustomersYet")}</h2>
                    <p className="mt-1 text-ink-2">{t("addFirstCustomers")}</p>
                    <Link href="/manage" className="mt-5 rounded-2xl bg-ink px-6 py-4 text-[16px] font-semibold text-paper">
                        {t("addCustomers")}
                    </Link>
                </div>
            ) : (
                <ul className="space-y-2.5 px-4">
                    {visible.map((row) => (
                        <li key={row.customer.id} id={`row-${row.customer.id}`} className="scroll-mt-48">
                            <CustomerRow row={row} locked={locked} onTick={onTick} onOpen={onOpen} />
                        </li>
                    ))}
                    {allDone && (
                        <li className="py-6 text-center text-[15px] font-medium text-paid">
                            {t("allDone")} · {num(totals.done)}
                        </li>
                    )}
                </ul>
            )}

            {sheet && (
                <RowSheet
                    key={sheet.seq}
                    open={sheetOpen}
                    row={rows.find((r) => r.customer.id === sheet.row.customer.id) ?? sheet.row}
                    carry={carryBy.get(sheet.row.customer.id)}
                    locked={locked}
                    onClose={() => setSheetOpen(false)}
                    onMark={setStatus}
                />
            )}
        </>
    )
}
