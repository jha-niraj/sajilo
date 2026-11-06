import { ScrollArea } from "@repo/ui/components/ui/scroll-area"
import type { Metadata } from "next"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { adToBs, formatBs, formatBsMonth, toNepaliDigits, WEEKDAYS_EN, WEEKDAYS_NE } from "@repo/calendar"
import { fetchMonthRegister } from "@/actions/report.action"
import { getSession } from "@/lib/session"
import { nepalToday } from "@/lib/today"
import { formatMoney, groupIndian, translate } from "@/lib/format"
import { langFrom, type Lang } from "@/lib/dict"
import { PrintButton } from "./print-button"

export const metadata: Metadata = { title: "Register" }

/**
 * The bank's monthly register on one landscape A4: customers down the side, every day of the
 * BS month across the top, each cell the cash received that day, totals on both edges.
 */
export default async function PrintMonthPage({ searchParams }: { searchParams: Promise<{ y?: string; m?: string }> }) {
    if (!(await getSession())) redirect("/api/session/clear")
    const sp = await searchParams
    const lang: Lang = langFrom((await cookies()).get("sajilo.lang")?.value)
    const today = nepalToday()
    const bs = adToBs(today)
    const { report: r, days, cells } = await fetchMonthRegister(Number(sp.y) || bs.year, Number(sp.m) || bs.month)
    const t = (k: Parameters<typeof translate>[1]) => translate(lang, k)
    const n = (v: number) => (lang === "ne" ? toNepaliDigits(groupIndian(v)) : groupIndian(v))
    const money = (v: number) => formatMoney(v, lang)
    const wd = lang === "ne" ? WEEKDAYS_NE : WEEKDAYS_EN
    const rows = r.customers
    const dayTotal = (date: string) => rows.reduce((s, c) => s + (cells[c.id]?.[date] ?? 0), 0)

    return (
        <main className="register mx-auto my-6 max-w-[1123px] rounded-xl bg-white px-8 py-6 text-black shadow-[0_10px_40px_-20px_rgb(42_33_24/0.4)] print:my-0 print:rounded-none print:shadow-none">
            <style>{`
                @page { size: A4 landscape; margin: 8mm; }
                @media print {
                    html, body { background: #fff !important; }
                    .register { width: 100%; max-width: none; padding: 0; }
                    .register table { page-break-inside: auto; }
                    .register tr { page-break-inside: avoid; }
                    .register thead { display: table-header-group; }
                    .register tfoot { display: table-footer-group; }
                }
                .register th, .register td { border: 1px solid #c9c2b4; }
            `}</style>

            <div className="no-print mb-5 flex items-center justify-between gap-3">
                <a href="/month" className="rounded-xl bg-paper-2 px-4 py-2.5 font-semibold text-ink">
                    ← {t("back")}
                </a>
                <p className="text-[13px] text-ink-3">A4 landscape</p>
                <PrintButton label={t("printPdf")} />
            </div>

            <header className="mb-3 flex items-end justify-between gap-6">
                <div>
                    <h1 className="text-[18px] font-bold leading-tight">
                        {lang === "ne" ? "दैनिक बचत संकलन रजिस्टर" : "Daily Savings Collection Register"}
                    </h1>
                    <p className="text-[12px]">
                        {formatBsMonth(r.year, r.month, lang)} · {formatBs(adToBs(r.start), lang)} - {formatBs(adToBs(r.end), lang)}
                    </p>
                </div>
                <div className="text-right text-[12px] leading-snug">
                    <p>
                        {lang === "ne" ? "संकलनकर्ता" : "Collector"}: <b>{r.collectorName}</b>
                    </p>
                    <p>
                        {lang === "ne" ? "छापेको मिति" : "Printed"}: {formatBs(bs, lang)}
                    </p>
                </div>
            </header>

            {/* On a phone the A4 register is wider than the screen: it scrolls sideways there, and prints whole. */}
            <ScrollArea orientation="horizontal" className="print:overflow-visible">
                <table className="w-full min-w-[960px] border-collapse text-[8.5px] leading-tight tabular print:min-w-0">
                    <thead>
                        <tr className="bg-[#f3efe6]">
                            <th className="w-[18px] px-0.5 py-1 text-center">#</th>
                            <th className="min-w-[90px] px-1 py-1 text-left">{t("name")}</th>
                            <th className="px-1 py-1 text-left">{t("accountNo")}</th>
                            {days.map((d) => (
                                <th key={d.date} className={`w-[2.4%] px-0 py-0.5 text-center ${d.weekday === 6 ? "bg-[#e9e2d3]" : ""}`}>
                                    <div className="font-bold">{lang === "ne" ? toNepaliDigits(d.day) : d.day}</div>
                                    <div className="font-normal opacity-60">{wd[d.weekday]!.slice(0, 2)}</div>
                                </th>
                            ))}
                            <th className="px-1 py-1 text-right">{lang === "ne" ? "जम्मा" : "Total"}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((c, i) => (
                            <tr key={c.id}>
                                <td className="px-0.5 py-[3px] text-center">{lang === "ne" ? toNepaliDigits(i + 1) : i + 1}</td>
                                <td className="max-w-[120px] truncate px-1 py-[3px] font-semibold">{c.name}</td>
                                <td className="max-w-[90px] truncate px-1 py-[3px]">{c.bankAccountNo ?? ""}</td>
                                {days.map((d) => {
                                    const v = cells[c.id]?.[d.date]
                                    return (
                                        <td key={d.date} className={`px-0 py-[3px] text-center ${d.weekday === 6 ? "bg-[#f6f2ea]" : ""} ${d.date > today ? "bg-[#fafafa]" : ""}`}>
                                            {v ? n(v) : ""}
                                        </td>
                                    )
                                })}
                                <td className="px-1 py-[3px] text-right font-bold">{n(c.received)}</td>
                            </tr>
                        ))}
                        {rows.length === 0 && (
                            <tr>
                                <td colSpan={days.length + 4} className="py-6 text-center text-[11px] text-neutral-500">
                                    {lang === "ne" ? "यो महिना कुनै संकलन छैन" : "No collections this month"}
                                </td>
                            </tr>
                        )}
                    </tbody>
                    <tfoot>
                        <tr className="bg-[#f3efe6] font-bold">
                            <td colSpan={3} className="px-1 py-1">
                                {lang === "ne" ? "दैनिक जम्मा" : "Day total"}
                            </td>
                            {days.map((d) => {
                                const v = dayTotal(d.date)
                                return (
                                    <td key={d.date} className="px-0 py-1 text-center text-[7.5px]">
                                        {v ? n(v) : ""}
                                    </td>
                                )
                            })}
                            <td className="px-1 py-1 text-right text-[10px]">{n(r.grandTotal)}</td>
                        </tr>
                    </tfoot>
                </table>
            </ScrollArea>

            <section className="mt-4 flex items-start justify-between gap-8 text-[12px]">
                <div className="space-y-0.5">
                    <p>
                        {lang === "ne" ? "ग्राहक संख्या" : "Customers"}: <b>{lang === "ne" ? toNepaliDigits(rows.length) : rows.length}</b>
                    </p>
                    <p>
                        {t("grandTotal")}: <b className="text-[14px]">{money(r.grandTotal)}</b>
                    </p>
                </div>
                <div className="grid flex-1 grid-cols-2 gap-12 pt-8">
                    <div className="border-t border-black pt-1">{lang === "ne" ? "संकलनकर्ताको दस्तखत" : "Collector signature"}</div>
                    <div className="border-t border-black pt-1">{lang === "ne" ? "बैंकको दस्तखत / छाप" : "Bank signature / stamp"}</div>
                </div>
            </section>
        </main>
    )
}
