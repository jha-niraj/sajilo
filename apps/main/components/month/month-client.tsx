"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { FileSpreadsheet, Printer, Share2 } from "lucide-react"
import { cn } from "@repo/ui/lib/utils"
import { toCsv } from "@repo/core/csv"
import { downloadCsv } from "@repo/core/documents"
import { PageTop } from "@/components/shell/page-top"
import { useI18n } from "@/lib/i18n"
import { fetchMonthReport, type MonthReport } from "@/actions/report.action"
import { MonthPicker } from "./month-picker"

export function MonthClient({
    initial,
    max,
    deadlineSlot,
}: {
    initial: MonthReport
    max: { year: number; month: number }
    deadlineSlot?: React.ReactNode
}) {
    const { t, money, num, date, weekday, month: monthLabel, lang } = useI18n()
    const [report, setReport] = useState(initial)
    const [tab, setTab] = useState<"customers" | "days">("customers")
    const [pending, startTransition] = useTransition()

    const change = (v: { year: number; month: number }) => {
        startTransition(async () => {
            try {
                setReport(await fetchMonthReport(v.year, v.month))
            } catch {
                toast.error(t("somethingWrong"))
            }
        })
    }

    const title = monthLabel(report.year, report.month)
    const maxDay = Math.max(1, ...report.days.map((d) => d.total))

    const summaryText = () => {
        const lines = [
            `${t("appName")} - ${title}`,
            `${t("grandTotal")}: ${money(report.grandTotal)}`,
            "",
            ...report.customers
                .filter((c) => c.received > 0)
                .map((c, i) => `${num(i + 1)}. ${c.name}${c.bankAccountNo ? ` (${c.bankAccountNo})` : ""} - ${money(c.received)}`),
        ]
        return lines.join("\n")
    }

    const share = async () => {
        const text = summaryText()
        try {
            if (navigator.share) await navigator.share({ title, text })
            else {
                await navigator.clipboard.writeText(text)
                toast.success("Copied")
            }
        } catch {
            // share sheet dismissed
        }
    }

    const exportCsv = () => {
        const rows = report.customers.map((c, i) => ({ ...c, n: i + 1 }))
        const csv = toCsv(rows, [
            { header: "#", value: (r) => r.n },
            { header: lang === "ne" ? "नाम" : "Name", value: (r) => r.name },
            { header: lang === "ne" ? "खाता नं." : "Account No.", value: (r) => r.bankAccountNo },
            { header: lang === "ne" ? "दैनिक रकम" : "Daily amount", value: (r) => r.defaultAmount },
            { header: lang === "ne" ? "तिरेको दिन" : "Days paid", value: (r) => r.daysPaid },
            { header: lang === "ne" ? "यो महिना जम्मा" : "Collected this month", value: (r) => r.received },
            { header: lang === "ne" ? "बाँकी" : "Due now", value: (r) => r.dueNow },
        ])
        const total = `\r\n,,,,${lang === "ne" ? "जम्मा" : "Total"},${report.grandTotal},${report.totalDueNow}`
        downloadCsv(csv + total, `sajilo-${report.year}-${String(report.month).padStart(2, "0")}.csv`)
    }

    return (
        <>
            <PageTop title={t("monthTitle")} />
            {deadlineSlot}

            <div className="space-y-4 px-4 pt-4">
                <MonthPicker year={report.year} month={report.month} max={max} onChange={change} disabled={pending} />

                <section className={cn("rounded-[26px] bg-ink p-5 text-paper transition-opacity", pending && "opacity-60")}>
                    <p className="text-[15px] text-paper/70">
                        {t("grandTotal")} · {title}
                    </p>
                    <p className="mt-1 text-[40px] font-semibold leading-none tabular">{money(report.grandTotal)}</p>
                    {report.totalDueNow > 0 && (
                        <p className="mt-3 text-[15px] text-paper/80">
                            {t("totalDue")}: <span className="font-semibold tabular">{money(report.totalDueNow)}</span>
                        </p>
                    )}
                    <div className="mt-4 grid grid-cols-3 gap-2">
                        <Link
                            href={`/print/month?y=${report.year}&m=${report.month}`}
                            target="_blank"
                            className="flex h-12 items-center justify-center gap-1.5 rounded-2xl bg-paper/10 text-[14px] font-semibold"
                        >
                            <Printer className="h-5 w-5" /> PDF
                        </Link>
                        <button type="button" onClick={share} className="flex h-12 items-center justify-center gap-1.5 rounded-2xl bg-paper/10 text-[14px] font-semibold">
                            <Share2 className="h-5 w-5" /> {t("share")}
                        </button>
                        <button type="button" onClick={exportCsv} className="flex h-12 items-center justify-center gap-1.5 rounded-2xl bg-paper/10 text-[14px] font-semibold">
                            <FileSpreadsheet className="h-5 w-5" /> CSV
                        </button>
                    </div>
                </section>

                <div className="grid grid-cols-2 rounded-2xl bg-paper-2 p-1 text-[15px] font-semibold">
                    {(["customers", "days"] as const).map((k) => (
                        <button
                            key={k}
                            type="button"
                            onClick={() => setTab(k)}
                            className={cn("h-11 rounded-xl transition-colors", tab === k ? "bg-card text-ink shadow-sm" : "text-ink-3")}
                        >
                            {k === "customers" ? t("perCustomer") : t("perDay")}
                        </button>
                    ))}
                </div>

                {tab === "customers" ? (
                    <ul className={cn("divide-y divide-line overflow-hidden rounded-[22px] bg-card ring-1 ring-line", pending && "opacity-60")}>
                        {report.customers.map((c, i) => (
                            <li key={c.id}>
                                <Link
                                    href={`/customers/${c.id}?y=${report.year}&m=${report.month}`}
                                    className="flex items-center gap-3 px-4 py-3 active:bg-paper-2"
                                >
                                    <span className="w-7 text-[14px] text-ink-3 tabular">{num(i + 1)}</span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-[17px] font-semibold text-ink">{c.name}</span>
                                        <span className="block text-[13px] text-ink-3">
                                            {c.bankAccountNo ? `${t("accountNo")} ${c.bankAccountNo} · ` : ""}
                                            {num(c.daysPaid)} {t("days")}
                                            {c.dueNow > 0 && <span className="text-late"> · {t("dueOldShort", { amount: money(c.dueNow) })}</span>}
                                        </span>
                                    </span>
                                    <span className="text-[17px] font-semibold text-ink tabular">{money(c.received)}</span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <ul className={cn("divide-y divide-line overflow-hidden rounded-[22px] bg-card ring-1 ring-line", pending && "opacity-60")}>
                        {[...report.days].reverse().map((d) => (
                            <li key={d.date} className="px-4 py-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-[16px] text-ink">
                                        {date(d.date)} <span className="text-ink-3">· {weekday(d.date)}</span>
                                    </span>
                                    <span className="text-[16px] font-semibold text-ink tabular">{money(d.total)}</span>
                                </div>
                                <div className="mt-1.5 flex items-center gap-2">
                                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-paper-2">
                                        <div className="h-full rounded-full bg-saffron/70" style={{ width: `${(d.total / maxDay) * 100}%` }} />
                                    </div>
                                    <span className="w-14 text-right text-[13px] text-ink-3 tabular">{num(d.people)}</span>
                                </div>
                            </li>
                        ))}
                        {report.days.length === 0 && <li className="px-4 py-8 text-center text-ink-3">-</li>}
                    </ul>
                )}
            </div>
        </>
    )
}
