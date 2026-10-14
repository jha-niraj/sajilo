import type { Metadata } from "next"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { adToBs, formatBs, formatBsMonth } from "@repo/calendar"
import { fetchMonthReport } from "@/actions/report.action"
import { getSession } from "@/lib/session"
import { nepalToday } from "@/lib/today"
import { formatMoney, translate } from "@/lib/format"
import type { Lang } from "@/lib/dict"
import { PrintButton } from "./print-button"

export const metadata: Metadata = { title: "Report" }

export default async function PrintMonthPage({ searchParams }: { searchParams: Promise<{ y?: string; m?: string }> }) {
    if (!(await getSession())) redirect("/api/session/clear")
    const sp = await searchParams
    const lang: Lang = (await cookies()).get("sajilo.lang")?.value === "ne" ? "ne" : "en"
    const today = nepalToday()
    const bs = adToBs(today)
    const r = await fetchMonthReport(Number(sp.y) || bs.year, Number(sp.m) || bs.month)
    const t = (k: Parameters<typeof translate>[1]) => translate(lang, k)
    const money = (n: number) => formatMoney(n, lang)
    const paid = r.customers.filter((c) => c.received > 0 || c.isActive)

    return (
        <main className="mx-auto max-w-[800px] bg-white px-8 py-8 text-[13px] text-black print:p-0">
            <div className="no-print mb-6 flex items-center justify-between gap-3">
                <a href="/month" className="rounded-xl bg-paper-2 px-4 py-2.5 font-semibold text-ink">
                    ← {t("back")}
                </a>
                <PrintButton label={t("printPdf")} />
            </div>

            <header className="flex items-start justify-between border-b-2 border-black pb-3">
                <div>
                    <h1 className="text-[20px] font-bold">
                        {lang === "ne" ? "मासिक दैनिक बचत संकलन विवरण" : "Monthly Daily Savings Collection"}
                    </h1>
                    <p className="mt-1 text-[14px]">
                        {formatBsMonth(r.year, r.month, lang)} ({formatBs(adToBs(r.start), lang)} - {formatBs(adToBs(r.end), lang)})
                    </p>
                </div>
                <div className="text-right text-[13px]">
                    <p>
                        {lang === "ne" ? "संकलनकर्ता" : "Collector"}: <b>{r.collectorName}</b>
                    </p>
                    <p>
                        {lang === "ne" ? "मिति" : "Date"}: {formatBs(bs, lang)}
                    </p>
                </div>
            </header>

            <table className="mt-4 w-full border-collapse">
                <thead>
                    <tr className="border-b border-black text-left">
                        <th className="py-1.5 pr-2">#</th>
                        <th className="py-1.5 pr-2">{t("name")}</th>
                        <th className="py-1.5 pr-2">{t("bankAccount")}</th>
                        <th className="py-1.5 pr-2 text-right">{t("dailyAmount")}</th>
                        <th className="py-1.5 pr-2 text-right">{lang === "ne" ? "दिन" : "Days"}</th>
                        <th className="py-1.5 text-right">{lang === "ne" ? "जम्मा" : "Total"}</th>
                    </tr>
                </thead>
                <tbody>
                    {paid.map((c, i) => (
                        <tr key={c.id} className="border-b border-neutral-300 break-inside-avoid">
                            <td className="py-1.5 pr-2">{i + 1}</td>
                            <td className="py-1.5 pr-2">{c.name}</td>
                            <td className="py-1.5 pr-2">{c.bankAccountNo ?? ""}</td>
                            <td className="py-1.5 pr-2 text-right tabular">{money(c.defaultAmount)}</td>
                            <td className="py-1.5 pr-2 text-right tabular">{c.daysPaid}</td>
                            <td className="py-1.5 text-right font-semibold tabular">{money(c.received)}</td>
                        </tr>
                    ))}
                </tbody>
                <tfoot>
                    <tr className="border-t-2 border-black text-[15px]">
                        <td colSpan={5} className="py-2 font-bold">
                            {t("grandTotal")}
                        </td>
                        <td className="py-2 text-right font-bold tabular">{money(r.grandTotal)}</td>
                    </tr>
                </tfoot>
            </table>

            <h2 className="mt-8 border-b border-black pb-1 text-[15px] font-bold">{t("perDay")}</h2>
            <div className="mt-2 grid grid-cols-3 gap-x-6 gap-y-1">
                {r.days.map((d) => (
                    <div key={d.date} className="flex justify-between border-b border-neutral-200 py-1 break-inside-avoid">
                        <span>{formatBs(adToBs(d.date), lang, false)}</span>
                        <span className="tabular">{money(d.total)}</span>
                    </div>
                ))}
            </div>

            <footer className="mt-12 grid grid-cols-2 gap-16 text-[13px]">
                <div className="border-t border-black pt-1">{lang === "ne" ? "संकलनकर्ताको दस्तखत" : "Collector signature"}</div>
                <div className="border-t border-black pt-1">{lang === "ne" ? "बैंकको दस्तखत" : "Bank signature"}</div>
            </footer>
        </main>
    )
}
