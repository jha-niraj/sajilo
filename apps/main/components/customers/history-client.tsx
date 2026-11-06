"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "@/components/app-link"
import { Pencil, Phone } from "lucide-react"
import { cn } from "@repo/ui/lib/utils"
import { adDayOfWeek, adToBs, bsMonthRange, toNepaliDigits, WEEKDAYS_EN, WEEKDAYS_NE } from "@repo/calendar"
import { PageTop } from "@/components/shell/page-top"
import { MonthPicker } from "@/components/month/month-picker"
import { useI18n } from "@/lib/i18n"
import { displayPhone } from "@/lib/phone"
import { fetchCustomerHistory, type CustomerHistory, type CustomerHistoryDay } from "@/actions/collection.action"
import { isOnline } from "@/lib/offline/network"
import { toast } from "sonner"
import { CustomerEditSheet } from "./customer-edit-sheet"

type Tone = "paid" | "late" | "miss" | "holiday" | "today" | "future" | "part" | "none"

function toneOf(d: CustomerHistoryDay | undefined, ad: string, today: string): Tone {
    if (!d) return ad > today ? "future" : "none"
    if (d.status === "holiday" || d.expected === 0) return "holiday"
    if (d.paidLate && d.outstanding === 0) return "late"
    if (d.outstanding === 0) return "paid"
    if (d.date === today) return "today"
    return d.received > 0 || d.paidLate ? "part" : "miss"
}

const TONE_CLASS: Record<Tone, string> = {
    paid: "bg-paid text-white",
    late: "bg-late text-white",
    miss: "bg-miss-soft text-miss ring-1 ring-miss/30",
    part: "bg-flag-soft text-[#8a5a08] ring-1 ring-flag/40",
    holiday: "bg-paper-2 text-ink-3",
    today: "bg-card text-ink ring-2 ring-saffron",
    future: "bg-transparent text-ink-3/50",
    none: "bg-transparent text-ink-3/60",
}

export function HistoryClient({
    initial,
    today,
    max,
    backHref,
    rechargeOwed = 0,
}: {
    initial: CustomerHistory
    /** Recharge udharo on the same profile (plan/phase-4-recharge.md), kept apart from collection */
    rechargeOwed?: number
    today: string
    max: { year: number; month: number }
    backHref: string
}) {
    const { t, money, lang, date } = useI18n()
    const [h, setH] = useState(initial)
    const [pending, startTransition] = useTransition()
    const [picked, setPicked] = useState<string | null>(null)
    const [editing, setEditing] = useState(false)
    const router = useRouter()

    const range = bsMonthRange(h.year, h.month)
    const byDate = new Map(h.days.map((d) => [d.date, d]))
    const firstDow = adDayOfWeek(range.start)
    const cells: (string | null)[] = Array.from({ length: firstDow }, () => null)
    for (let i = 0; i < range.days; i++) {
        const d = new Date(range.start + "T12:00:00")
        d.setDate(d.getDate() + i)
        cells.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`)
    }

    const change = (v: { year: number; month: number }) => {
        if (!isOnline()) return void toast(t("needsInternet"))
        startTransition(async () => {
            try {
                const next = await fetchCustomerHistory(h.customer.id, v.year, v.month)
                if (next) setH(next)
                setPicked(null)
            } catch {
                toast.error(t("somethingWrong"))
            }
        })
    }

    const pickedDay = picked ? byDate.get(picked) : undefined

    return (
        <>
            <PageTop
                title={h.customer.name}
                subtitle={`${money(h.customer.defaultAmount)} / ${lang === "ne" ? "दिन" : "day"}`}
                backHref={backHref}
                right={
                    <button
                        type="button"
                        onClick={() => setEditing(true)}
                        className="flex h-10 items-center gap-1.5 rounded-full bg-paper-2 px-3.5 text-[14px] font-semibold text-ink-2 active:bg-line"
                    >
                        <Pencil className="h-4 w-4" /> {t("edit")}
                    </button>
                }
            />

            <div className="space-y-4 px-4 pt-4">
                <div className="grid grid-cols-2 gap-2.5">
                    <Stat label={t("collected")} value={money(h.monthReceived)} />
                    <Stat
                        label={h.arrears === 0 && h.advance > 0 ? t("extraPart") : t("stillDue")}
                        value={money(h.arrears > 0 ? h.arrears : h.advance)}
                        tone={h.arrears > 0 ? "late" : "paid"}
                    />
                </div>

                <MonthPicker year={h.year} month={h.month} max={max} onChange={change} disabled={pending} />

                <section className={cn("rounded-[24px] bg-card p-3 ring-1 ring-line transition-opacity", pending && "opacity-50")}>
                    <div className="grid grid-cols-7 gap-1.5 text-center text-[12px] font-medium text-ink-3">
                        {(lang === "ne" ? WEEKDAYS_NE : WEEKDAYS_EN).map((w) => (
                            <span key={w} className="py-1">
                                {w}
                            </span>
                        ))}
                    </div>
                    <div className="mt-1 grid grid-cols-7 gap-1.5">
                        {cells.map((ad, i) => {
                            if (!ad) return <span key={`e${i}`} />
                            const tone = toneOf(byDate.get(ad), ad, today)
                            const day = adToBs(ad).day
                            return (
                                <button
                                    key={ad}
                                    type="button"
                                    disabled={tone === "future" || tone === "none"}
                                    onClick={() => setPicked(ad === picked ? null : ad)}
                                    className={cn(
                                        "flex aspect-square items-center justify-center rounded-xl text-[15px] font-semibold tabular transition-transform active:scale-95",
                                        TONE_CLASS[tone],
                                        picked === ad && "outline outline-2 outline-offset-2 outline-ink",
                                    )}
                                >
                                    {lang === "ne" ? toNepaliDigits(day) : day}
                                </button>
                            )
                        })}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 px-1 text-[13px] text-ink-2">
                        <Legend className="bg-paid" label={t("paid")} />
                        <Legend className="bg-late" label={t("paidLate")} />
                        <Legend className="bg-miss-soft ring-1 ring-miss/30" label={t("missed")} />
                        <Legend className="bg-paper-2" label={t("holiday")} />
                    </div>
                </section>

                {pickedDay && (
                    <section className="rounded-[22px] bg-card p-4 ring-1 ring-line">
                        <p className="text-[16px] font-semibold text-ink">{date(pickedDay.date, true)}</p>
                        <div className="mt-2 space-y-1 text-[15px] text-ink-2">
                            <Row label={t("todaysPart")} value={money(pickedDay.expected)} />
                            <Row label={t("received")} value={money(pickedDay.received)} />
                            {pickedDay.toOldDays > 0 && <Row label={t("toOldDays")} value={money(pickedDay.toOldDays)} tone="late" />}
                            {pickedDay.paidLate && pickedDay.settledOn && (
                                <p className="text-late">{t("paidLateOn", { date: date(pickedDay.settledOn) })}</p>
                            )}
                            {pickedDay.outstanding > 0 && <Row label={t("stillDue")} value={money(pickedDay.outstanding)} tone="miss" />}
                            {pickedDay.status === "shop_closed" && <p className="text-miss">{t("shopClosed")}</p>}
                            {pickedDay.status === "no_money" && <p className="text-miss">{t("noMoney")}</p>}
                        </div>
                    </section>
                )}

                {rechargeOwed > 0 && (
                    <Link href="/recharge" className="flex items-center justify-between gap-3 rounded-[22px] bg-flag-soft px-4 py-3 text-[15px] text-[#8a5a08]">
                        <span className="min-w-0">
                            {t("rcTitle")} · {t("rcUdharo")}
                        </span>
                        <span className="shrink-0 font-semibold tabular">{money(rechargeOwed)}</span>
                    </Link>
                )}

                {(h.customer.phone || h.customer.bankAccountNo) && (
                    <section className="space-y-2 rounded-[22px] bg-card p-4 text-[15px] ring-1 ring-line">
                        {h.customer.phone && (
                            <a href={`tel:${h.customer.phone}`} className="flex items-center gap-2 text-ink">
                                <Phone className="h-4 w-4 text-ink-3" /> {displayPhone(h.customer.phone)}
                            </a>
                        )}
                        {h.customer.bankAccountNo && (
                            <p className="text-ink-2">
                                {t("bankAccount")}: <span className="font-semibold text-ink">{h.customer.bankAccountNo}</span>
                            </p>
                        )}
                        <p className="text-ink-3">
                            {t("startDate")}: {date(h.customer.startDate, true)}
                            {h.arrears > 0 && ` · ${t("dueOld", { amount: money(h.arrears), days: h.arrearsDays })}`}
                        </p>
                    </section>
                )}
            </div>
            <CustomerEditSheet
                customer={editing ? h.customer : null}
                today={today}
                onClose={() => setEditing(false)}
                onDone={(synced) => {
                    if (!synced) return
                    void fetchCustomerHistory(h.customer.id, h.year, h.month).then((next) => next && setH(next))
                    router.refresh()
                }}
            />
        </>
    )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "late" | "paid" }) {
    return (
        <div className="rounded-[22px] bg-card p-4 ring-1 ring-line">
            <p className="text-[14px] text-ink-3">{label}</p>
            <p className={cn("mt-0.5 text-[21px] font-semibold tabular", tone === "late" ? "text-late" : tone === "paid" ? "text-paid" : "text-ink")}>
                {value}
            </p>
        </div>
    )
}

function Legend({ className, label }: { className: string; label: string }) {
    return (
        <span className="inline-flex items-center gap-1.5">
            <span className={cn("h-3 w-3 rounded", className)} /> {label}
        </span>
    )
}

function Row({ label, value, tone }: { label: string; value: string; tone?: "late" | "miss" }) {
    return (
        <div className={cn("flex justify-between", tone === "late" && "text-late", tone === "miss" && "text-miss")}>
            <span>{label}</span>
            <span className="font-semibold tabular">{value}</span>
        </div>
    )
}
