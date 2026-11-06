import type { Metadata } from "next"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { adToBs, bsMonthRange, formatBs, formatBsMonth, toNepaliDigits } from "@repo/calendar"
import { ScrollArea } from "@repo/ui/components/ui/scroll-area"
import { fetchRecharge } from "@/actions/recharge.action"
import { getSession } from "@/lib/session"
import { nepalToday } from "@/lib/today"
import { formatMoney, translate } from "@/lib/format"
import type { Lang } from "@/lib/dict"
import { POOLS, runLedger, splitPool, type Pool, type RechargeEvent } from "@/lib/recharge/ledger"
import { PrintButton } from "../month/print-button"

export const metadata: Metadata = { title: "Recharge report" }

const PROVIDER_NAME = { ntc: "NTC", ncell: "Ncell" } as const

/**
 * The month's recharge on portrait A4: the totals, each of the four stocks from start to end,
 * every day, every purchase, and who still owes udharo. Recharge only, never collection money.
 */
export default async function PrintRechargePage({ searchParams }: { searchParams: Promise<{ y?: string; m?: string }> }) {
    const session = await getSession()
    if (!session) redirect("/api/session/clear")
    const sp = await searchParams
    const lang: Lang = (await cookies()).get("sajilo.lang")?.value === "ne" ? "ne" : "en"
    const today = nepalToday()
    const now = adToBs(today)
    const year = Number(sp.y) || now.year
    const month = Number(sp.m) || now.month
    const data = await fetchRecharge(year, month)
    const t = (k: Parameters<typeof translate>[1], v?: Parameters<typeof translate>[2]) => translate(lang, k, v)
    const money = (v: number) => formatMoney(v, lang)
    const range = bsMonthRange(year, month)

    const before = data.events.filter((e) => e.date < data.from)
    const inMonth = data.events.filter((e) => e.date >= data.from && e.date <= data.to)
    const opening = runLedger(data.start, before).state
    const { state: closing, days } = runLedger(opening, inMonth)
    const stockName = (p: Pool) => {
        const s = splitPool(p)
        return `${PROVIDER_NAME[s.provider]} ${s.stock === "eload" ? t("rcEload") : t("rcCard")}`
    }

    const dayRows = [...days.entries()].sort(([a], [b]) => (a < b ? -1 : 1))
    const sum = (f: (d: (typeof dayRows)[number][1]) => number) => dayRows.reduce((s, [, d]) => s + f(d), 0)
    const totals = {
        bought: sum((d) => d.bought),
        paid: sum((d) => d.paid),
        sold: sum((d) => d.sold),
        profit: Math.round(sum((d) => d.profit) * 100) / 100,
        credit: sum((d) => d.credit),
        paidBack: sum((d) => d.paidBack),
        cash: sum((d) => d.cash),
    }
    const usedPools = POOLS.filter((p) => opening[p].stock !== 0 || closing[p].stock !== 0 || dayRows.some(([, d]) => d.pools[p].sold || d.pools[p].bought))
    const purchases = inMonth.filter((e): e is Extract<RechargeEvent, { type: "buy" }> => e.type === "buy").sort((a, b) => (a.date === b.date ? a.at - b.at : a.date < b.date ? -1 : 1))
    const owed = data.people
        .filter((p) => p.owed > 0)
        .map((p) => ({ ...p, label: p.name || data.customers.find((c) => c.id === p.customerId)?.name || p.phone || "-" }))
        .sort((a, b) => b.owed - a.owed)
    const d = (ad: string) => formatBs(adToBs(ad), lang, false)
    const pct = (face: number, paid: number) => {
        const v = String(Math.round(((face - paid) / face) * 1000) / 10)
        return `${lang === "ne" ? toNepaliDigits(v) : v}%`
    }

    return (
        <main className="report mx-auto my-6 max-w-[794px] rounded-xl bg-white px-8 py-6 text-[12px] text-black shadow-[0_10px_40px_-20px_rgb(42_33_24/0.4)] print:my-0 print:rounded-none print:shadow-none">
            <style>{`
                @page { size: A4 portrait; margin: 10mm; }
                @media print {
                    html, body { background: #fff !important; }
                    .report { width: 100%; max-width: none; padding: 0; }
                    .report tr { page-break-inside: avoid; }
                    .report thead { display: table-header-group; }
                    .report section { page-break-inside: avoid; }
                }
                .report th, .report td { border-bottom: 1px solid #e3ddd1; padding: 5px 6px; }
                .report th { background: #f3efe6; font-weight: 700; text-align: left; }
            `}</style>

            <div className="no-print mb-5 flex items-center justify-between gap-3">
                <a href="/recharge" className="rounded-xl bg-paper-2 px-4 py-2.5 font-semibold text-ink">
                    ← {t("back")}
                </a>
                <p className="text-[13px] text-ink-3">A4</p>
                <PrintButton label={t("printPdf")} />
            </div>

            <header className="mb-4 flex items-end justify-between gap-6">
                <div>
                    <h1 className="text-[20px] font-bold leading-tight">{t("rcReportTitle")}</h1>
                    <p>
                        {formatBsMonth(year, month, lang)} · {formatBs(adToBs(range.start), lang)} - {formatBs(adToBs(data.to), lang)}
                    </p>
                </div>
                <div className="text-right leading-snug">
                    <p>
                        <b>{session.user.name}</b>
                    </p>
                    <p>
                        {lang === "ne" ? "छापेको मिति" : "Printed"}: {formatBs(now, lang)}
                    </p>
                </div>
            </header>

            <section className="mb-5 grid grid-cols-4 gap-2">
                {[
                    [t("rcSold"), money(totals.sold)],
                    [t("rcProfit"), money(totals.profit)],
                    [t("rcCash"), money(totals.cash)],
                    [t("rcBoughtFace"), money(totals.bought)],
                    [t("rcPaidDealer"), money(totals.paid)],
                    [t("rcUdharoGiven"), money(totals.credit)],
                    [t("rcUdharoBack"), money(totals.paidBack)],
                    [t("rcStillOwed"), money(owed.reduce((s, p) => s + p.owed, 0))],
                ].map(([label, value]) => (
                    <div key={label} className="rounded-lg border border-[#e3ddd1] px-3 py-2">
                        <p className="text-[11px] text-neutral-600">{label}</p>
                        <p className="text-[15px] font-bold tabular-nums">{value}</p>
                    </div>
                ))}
            </section>

            <section className="mb-5">
                <h2 className="mb-1.5 text-[14px] font-bold">{t("rcByStock")}</h2>
                <ScrollArea orientation="horizontal" className="print:overflow-visible">
                    <table className="w-full min-w-[560px] border-collapse tabular-nums print:min-w-0">
                        <thead>
                            <tr>
                                <th>{t("rcTitle")}</th>
                                <th className="!text-right">{t("rcStockStart")}</th>
                                <th className="!text-right">{t("rcBought")}</th>
                                <th className="!text-right">{t("rcSold")}</th>
                                <th className="!text-right">{t("rcProfit")}</th>
                                <th className="!text-right">{t("rcStockEnd")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {usedPools.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="text-center text-neutral-500">
                                        {t("rcNoneThisMonth")}
                                    </td>
                                </tr>
                            )}
                            {usedPools.map((p) => {
                                const bought = dayRows.reduce((s, [, x]) => s + x.pools[p].bought, 0)
                                const sold = dayRows.reduce((s, [, x]) => s + x.pools[p].sold, 0)
                                const profit = Math.round(dayRows.reduce((s, [, x]) => s + x.pools[p].profit, 0) * 100) / 100
                                return (
                                    <tr key={p}>
                                        <td className="font-semibold">{stockName(p)}</td>
                                        <td className="text-right">{money(opening[p].stock)}</td>
                                        <td className="text-right">{money(bought)}</td>
                                        <td className="text-right">{money(sold)}</td>
                                        <td className="text-right">{money(profit)}</td>
                                        <td className="text-right font-semibold">{money(closing[p].stock)}</td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </ScrollArea>
            </section>

            <section className="mb-5">
                <h2 className="mb-1.5 text-[14px] font-bold">{t("rcByDay")}</h2>
                <ScrollArea orientation="horizontal" className="print:overflow-visible">
                    <table className="w-full min-w-[560px] border-collapse tabular-nums print:min-w-0">
                        <thead>
                            <tr>
                                <th>{lang === "ne" ? "मिति" : "Date"}</th>
                                <th className="!text-right">{t("rcSold")}</th>
                                <th className="!text-right">{t("rcProfit")}</th>
                                <th className="!text-right">{t("rcUdharoGiven")}</th>
                                <th className="!text-right">{t("rcUdharoBack")}</th>
                                <th className="!text-right">{t("rcCash")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {dayRows.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="text-center text-neutral-500">
                                        {t("rcNoneThisMonth")}
                                    </td>
                                </tr>
                            )}
                            {dayRows.map(([date, x]) => (
                                <tr key={date}>
                                    <td>{d(date)}</td>
                                    <td className="text-right">{money(x.sold)}</td>
                                    <td className="text-right">{money(x.profit)}</td>
                                    <td className="text-right">{x.credit ? money(x.credit) : ""}</td>
                                    <td className="text-right">{x.paidBack ? money(x.paidBack) : ""}</td>
                                    <td className="text-right font-semibold">{money(x.cash)}</td>
                                </tr>
                            ))}
                            {dayRows.length > 0 && (
                                <tr className="font-bold">
                                    <td>{lang === "ne" ? "जम्मा" : "Total"}</td>
                                    <td className="text-right">{money(totals.sold)}</td>
                                    <td className="text-right">{money(totals.profit)}</td>
                                    <td className="text-right">{money(totals.credit)}</td>
                                    <td className="text-right">{money(totals.paidBack)}</td>
                                    <td className="text-right">{money(totals.cash)}</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </ScrollArea>
            </section>

            <div className="grid grid-cols-2 gap-6">
                <section>
                    <h2 className="mb-1.5 text-[14px] font-bold">{t("rcPurchases")}</h2>
                    <table className="w-full border-collapse tabular-nums">
                        <tbody>
                            {purchases.length === 0 && (
                                <tr>
                                    <td className="text-neutral-500">{t("rcNoneThisMonth")}</td>
                                </tr>
                            )}
                            {purchases.map((e) => (
                                <tr key={e.id}>
                                    <td>{d(e.date)}</td>
                                    <td>{stockName(e.pool)}</td>
                                    <td className="text-right">{money(e.face)}</td>
                                    <td className="text-right text-neutral-600">
                                        {money(e.paid)} · {pct(e.face, e.paid)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </section>
                <section>
                    <h2 className="mb-1.5 text-[14px] font-bold">{t("rcStillOwed")}</h2>
                    <table className="w-full border-collapse tabular-nums">
                        <tbody>
                            {owed.length === 0 && (
                                <tr>
                                    <td className="text-neutral-500">{t("rcNobodyOwes")}</td>
                                </tr>
                            )}
                            {owed.map((p) => (
                                <tr key={p.id}>
                                    <td className="font-semibold">{p.label}</td>
                                    <td className="text-neutral-600">{p.phone ? p.phone.replace("+977", "") : ""}</td>
                                    <td className="text-right font-semibold">{money(p.owed)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </section>
            </div>
        </main>
    )
}
