"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import Link from "@/components/app-link"
import { toast } from "sonner"
import { ChevronLeft, ChevronRight, Download, Printer, Share2 } from "lucide-react"
import { ScrollArea } from "@repo/ui/components/ui/scroll-area"
import { DotmSquare11 } from "@repo/ui/components/ui/dotm-square-11"
import { cn } from "@repo/ui/lib/utils"
import { bsMonthName, bsMonthRange, formatBs, adToBs, type BsDate } from "@repo/calendar"
import { PageTop } from "@/components/shell/page-top"
import { useI18n } from "@/lib/i18n"
import { POOLS, runLedger, splitPool, type Pool } from "@/lib/recharge/ledger"
import type { RechargeData } from "@/lib/recharge/server"
import { calLang } from "@/lib/dict"
import { downloadBlob, reportPdf, sharePdf } from "@/lib/reports/pdf"
import { BatchCard, PROVIDER_NAME } from "@/components/recharge/recharge-client"
import { personLabel } from "@/components/recharge/use-recharge"

const pad = (n: number) => String(n).padStart(2, "0")
const monthParam = (y: number, m: number) => `/reports/recharge?m=${y}-${pad(m)}`

/**
 * One month of recharge, read on the phone, with Print, Download PDF and Share. The A4 page that
 * prints (and becomes the PDF) is drawn off-screen from the same numbers.
 */
export function RechargeReport({ data, year, month, now, name }: { data: RechargeData; year: number; month: number; now: BsDate; name: string }) {
    const { t, money, date, month: monthLabel, lang } = useI18n()
    const docRef = useRef<HTMLDivElement>(null)
    const [mounted, setMounted] = useState(false)
    const [busy, setBusy] = useState<null | "pdf" | "share">(null)
    useEffect(() => setMounted(true), [])

    const r = useMemo(() => {
        const before = data.events.filter((e) => e.date < data.from)
        const inMonth = data.events.filter((e) => e.date >= data.from && e.date <= data.to)
        const opening = runLedger(data.start, before).state
        const { state: closing, days, batches } = runLedger(opening, inMonth)
        const dayRows = [...days.entries()].sort(([a], [b]) => (a < b ? -1 : 1))
        const sum = (f: (d: (typeof dayRows)[number][1]) => number) => Math.round(dayRows.reduce((s, [, d]) => s + f(d), 0) * 100) / 100
        const pools = POOLS.filter((p) => opening[p].stock !== 0 || closing[p].stock !== 0 || dayRows.some(([, d]) => d.pools[p].sold || d.pools[p].bought)).map((p) => ({
            pool: p,
            start: opening[p].stock,
            end: closing[p].stock,
            bought: sum((d) => d.pools[p].bought),
            sold: sum((d) => d.pools[p].sold),
            profit: sum((d) => d.pools[p].profit),
        }))
        const owed = data.people
            .filter((p) => p.owed > 0)
            .map((p) => ({ ...p, label: personLabel(p, data.customers) }))
            .sort((a, b) => b.owed - a.owed)
        return {
            dayRows,
            pools,
            batches: [...batches].reverse(),
            owed,
            totals: {
                sold: sum((d) => d.sold),
                profit: sum((d) => d.profit),
                cash: sum((d) => d.cash),
                bought: sum((d) => d.bought),
                paid: sum((d) => d.paid),
                credit: sum((d) => d.credit),
                paidBack: sum((d) => d.paidBack),
                owed: Math.round(owed.reduce((s, p) => s + p.owed, 0) * 100) / 100,
            },
        }
    }, [data])

    const stockName = (p: Pool) => {
        const s = splitPool(p)
        return `${PROVIDER_NAME[s.provider]} ${s.stock === "eload" ? t("rcEload") : t("rcCard")}`
    }
    const range = bsMonthRange(year, month)
    const title = `${t("rcReportTitle")} - ${monthLabel(year, month)}`
    const fileName = `recharge-${bsMonthName(month, "en").toLowerCase()}-${year}-made-${now.year}-${pad(now.month)}-${pad(now.day)}.pdf`
    const prev = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 }
    const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 }
    const hasNext = next.y * 12 + next.m <= now.year * 12 + now.month
    const tiles: [string, number, string?][] = [
        [t("rcSold"), r.totals.sold],
        [t("rcProfit"), r.totals.profit, "text-paid"],
        [t("rcCashToHave"), r.totals.cash],
        [t("rcBoughtFace"), r.totals.bought],
        [t("rcPaidDealer"), r.totals.paid],
        [t("rcUdharoGiven"), r.totals.credit, "text-[#8a5a08]"],
        [t("rcUdharoBack"), r.totals.paidBack],
        [t("rcStillOwed"), r.totals.owed, "text-[#8a5a08]"],
    ]

    const makePdf = async (kind: "pdf" | "share") => {
        if (!docRef.current || busy) return
        setBusy(kind)
        const loading = toast.loading(t("rpMaking"))
        try {
            const blob = await reportPdf(docRef.current)
            if (kind === "share" && (await sharePdf(blob, fileName, title))) return
            downloadBlob(blob, fileName)
        } catch (e) {
            console.error("[report] pdf", e)
            toast.error(t("rpFailed"))
        } finally {
            toast.dismiss(loading)
            setBusy(null)
        }
    }

    return (
        <>
            <PageTop title={t("rcReportTitle")} backHref="/reports" />
            <div className="space-y-4 px-4 pb-8 pt-3">
                <div className="flex items-center justify-between gap-2 rounded-2xl bg-card p-1.5 ring-1 ring-line">
                    <Link href={monthParam(prev.y, prev.m)} aria-label={t("rcPrevMonth")} className="flex h-11 w-11 items-center justify-center rounded-xl text-ink-2 active:bg-paper-2">
                        <ChevronLeft className="h-5 w-5" />
                    </Link>
                    <div className="min-w-0 text-center">
                        <p className="text-[17px] font-semibold text-ink">{monthLabel(year, month)}</p>
                        <p className="text-[12px] text-ink-3">
                            {date(range.start)} - {date(data.to)}
                        </p>
                    </div>
                    {hasNext ? (
                        <Link href={monthParam(next.y, next.m)} aria-label={t("rcNextMonth")} className="flex h-11 w-11 items-center justify-center rounded-xl text-ink-2 active:bg-paper-2">
                            <ChevronRight className="h-5 w-5" />
                        </Link>
                    ) : (
                        <span className="h-11 w-11" />
                    )}
                </div>

                <div className="grid grid-cols-3 gap-2">
                    <ActionButton icon={Printer} label={t("rpPrint")} onClick={() => window.print()} />
                    <ActionButton icon={Download} label={t("rpDownload")} busy={busy === "pdf"} onClick={() => void makePdf("pdf")} />
                    <ActionButton icon={Share2} label={t("rpShare")} busy={busy === "share"} onClick={() => void makePdf("share")} primary />
                </div>

                <section className="grid grid-cols-2 gap-2">
                    {tiles.map(([label, value, tone]) => (
                        <div key={label} className="rounded-2xl bg-card px-3.5 py-2.5 ring-1 ring-line">
                            <p className="truncate text-[13px] text-ink-3">{label}</p>
                            <p className={cn("text-[18px] font-semibold text-ink tabular", tone)}>{money(value)}</p>
                        </div>
                    ))}
                </section>

                <Section title={t("rcByStock")}>
                    {r.pools.length === 0 ? (
                        <Empty text={t("rcNoneThisMonth")} />
                    ) : (
                        <ul className="divide-y divide-line">
                            {r.pools.map((p) => (
                                <li key={p.pool} className="px-4 py-3">
                                    <div className="flex items-baseline justify-between gap-3">
                                        <span className="text-[15px] font-semibold text-ink">{stockName(p.pool)}</span>
                                        <span className="text-[13px] text-ink-3 tabular">
                                            {money(p.start)} → <b className="text-ink">{money(p.end)}</b>
                                        </span>
                                    </div>
                                    <div className="mt-1 grid grid-cols-3 gap-2 text-[13px]">
                                        <Stat label={t("rcBought")} value={money(p.bought)} />
                                        <Stat label={t("rcSold")} value={money(p.sold)} />
                                        <Stat label={t("rcProfit")} value={money(p.profit)} tone="text-paid" />
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </Section>

                <Section title={t("rcBatches")}>
                    {r.batches.length === 0 ? (
                        <Empty text={t("rcNoneThisMonth")} />
                    ) : (
                        <ScrollArea orientation="vertical" viewportClassName="max-h-[360px]">
                            <ul className="space-y-2 px-3 pb-3">
                                {r.batches.map((b) => (
                                    <BatchCard key={b.id} b={b} what={stockName(b.pool)} />
                                ))}
                            </ul>
                        </ScrollArea>
                    )}
                </Section>

                <Section title={t("rcDays")}>
                    {r.dayRows.length === 0 ? (
                        <Empty text={t("rcNoneThisMonth")} />
                    ) : (
                        <ScrollArea orientation="horizontal">
                            <ScrollArea orientation="vertical" viewportClassName="max-h-[360px]">
                                <table className="w-full min-w-[560px] border-collapse whitespace-nowrap text-[13px] tabular">
                                    <thead className="sticky top-0 bg-paper-2 text-ink-2">
                                        <tr>
                                            {["", t("rcOpening"), t("rcBought"), t("rcSold"), t("rcClosing"), t("rcProfit"), t("rcCashToHave")].map((h, i) => (
                                                <th key={i} className={cn("px-2.5 py-2 font-semibold", i === 0 ? "text-left" : "text-right")}>
                                                    {h}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-line">
                                        {r.dayRows.map(([d, x]) => (
                                            <tr key={d}>
                                                <td className="whitespace-nowrap px-2.5 py-2 text-ink">{date(d)}</td>
                                                <td className="px-2.5 py-2 text-right text-ink-2">{money(x.opening)}</td>
                                                <td className="px-2.5 py-2 text-right text-ink-2">{x.bought ? money(x.bought) : "-"}</td>
                                                <td className="px-2.5 py-2 text-right text-ink">{money(x.sold)}</td>
                                                <td className="px-2.5 py-2 text-right font-semibold text-ink">{money(x.closing)}</td>
                                                <td className="px-2.5 py-2 text-right text-paid">{money(x.profit)}</td>
                                                <td className="px-2.5 py-2 text-right text-ink">{money(x.cash)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </ScrollArea>
                        </ScrollArea>
                    )}
                </Section>

                <Section title={t("rcStillOwed")}>
                    {r.owed.length === 0 ? (
                        <Empty text={t("rcNobodyOwes")} />
                    ) : (
                        <ScrollArea orientation="vertical" viewportClassName="max-h-[280px]">
                            <ul className="divide-y divide-line">
                                {r.owed.map((p) => (
                                    <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                                        <span className="min-w-0">
                                            <span className="block truncate text-[15px] font-medium text-ink">{p.label}</span>
                                            {p.phone && <span className="block text-[13px] text-ink-3 tabular">{p.phone.replace("+977", "")}</span>}
                                        </span>
                                        <span className="shrink-0 text-[15px] font-semibold text-[#8a5a08] tabular">{money(p.owed)}</span>
                                    </li>
                                ))}
                            </ul>
                        </ScrollArea>
                    )}
                </Section>
            </div>

            {mounted &&
                createPortal(
                    <div id="rc-print-root">
                        <style>{`
                            #rc-print-root .rc-offscreen { position: fixed; left: -10000px; top: 0; }
                            @media print {
                                @page { size: A4 portrait; margin: 8mm; }
                                html, body { background: #fff !important; height: auto !important; overflow: visible !important; }
                                body > *:not(#rc-print-root) { display: none !important; }
                                #rc-print-root .rc-offscreen { position: static; }
                                #rc-print-root .rc-doc { width: 100% !important; padding: 0 !important; }
                                #rc-print-root tr { page-break-inside: avoid; }
                            }
                            #rc-print-root th, #rc-print-root td { border-bottom: 1px solid #e3ddd1; padding: 5px 6px; }
                            #rc-print-root th { background: #f3efe6; font-weight: 700; text-align: left; }
                        `}</style>
                        <div className="rc-offscreen" aria-hidden>
                            <div ref={docRef} className="rc-doc w-[794px] bg-white px-10 py-8 text-[12px] text-black">
                                <header className="mb-4 flex items-end justify-between gap-6" data-pdf-row>
                                    <div>
                                        <h1 className="text-[20px] font-bold leading-tight">{t("rcReportTitle")}</h1>
                                        <p>
                                            {monthLabel(year, month)} · {formatBs(adToBs(range.start), calLang(lang))} - {formatBs(adToBs(data.to), calLang(lang))}
                                        </p>
                                    </div>
                                    <div className="text-right leading-snug">
                                        <p>
                                            <b>{name}</b>
                                        </p>
                                        <p>{t("rpMade", { date: formatBs(now, calLang(lang)) })}</p>
                                    </div>
                                </header>

                                <div className="mb-5 grid grid-cols-4 gap-2" data-pdf-row>
                                    {tiles.map(([label, value]) => (
                                        <div key={label} className="rounded-lg border border-[#e3ddd1] px-3 py-2">
                                            <p className="text-[11px] text-neutral-600">{label}</p>
                                            <p className="text-[15px] font-bold tabular-nums">{money(value)}</p>
                                        </div>
                                    ))}
                                </div>

                                <DocTable
                                    title={t("rcByStock")}
                                    head={[t("rcTitle"), t("rcOpening"), t("rcBought"), t("rcSold"), t("rcProfit"), t("rcClosing")]}
                                    rows={r.pools.map((p) => [stockName(p.pool), money(p.start), money(p.bought), money(p.sold), money(p.profit), money(p.end)])}
                                    empty={t("rcNoneThisMonth")}
                                />
                                <DocTable
                                    title={t("rcBatches")}
                                    head={["", t("rcTitle"), t("rcReceived"), t("rcYouPaid"), t("rcSold"), t("rcLeft"), t("rcProfit")]}
                                    rows={[...r.batches].reverse().map((b) => [
                                        b.date ? date(b.date) : t("rcOpening"),
                                        stockName(b.pool),
                                        money(b.face),
                                        money(b.paid),
                                        money(b.sold),
                                        b.left <= 0 ? t("rcSoldOut") : money(b.left) + (b.missing > 0 ? ` (${t("rcMissing", { amount: money(b.missing) })})` : ""),
                                        money(b.profit),
                                    ])}
                                    empty={t("rcNoneThisMonth")}
                                    textCols={2}
                                />
                                <DocTable
                                    title={t("rcDays")}
                                    head={["", t("rcOpening"), t("rcBought"), t("rcSold"), t("rcClosing"), t("rcProfit"), t("rcUdharoGiven"), t("rcUdharoBack"), t("rcCashToHave")]}
                                    rows={r.dayRows.map(([d, x]) => [
                                        date(d),
                                        money(x.opening),
                                        x.bought ? money(x.bought) : "",
                                        money(x.sold),
                                        money(x.closing),
                                        money(x.profit),
                                        x.credit ? money(x.credit) : "",
                                        x.paidBack ? money(x.paidBack) : "",
                                        money(x.cash),
                                    ])}
                                    total={
                                        r.dayRows.length
                                            ? [t("total"), "", money(r.totals.bought), money(r.totals.sold), "", money(r.totals.profit), money(r.totals.credit), money(r.totals.paidBack), money(r.totals.cash)]
                                            : undefined
                                    }
                                    empty={t("rcNoneThisMonth")}
                                />
                                <DocTable
                                    title={t("rcStillOwed")}
                                    head={[t("name"), t("phone"), t("rcOwes", { amount: "" }).trim()]}
                                    rows={r.owed.map((p) => [p.label, p.phone ? p.phone.replace("+977", "") : "", money(p.owed)])}
                                    empty={t("rcNobodyOwes")}
                                    textCols={2}
                                />
                            </div>
                        </div>
                    </div>,
                    document.body,
                )}
        </>
    )
}

function ActionButton({ icon: Icon, label, onClick, busy, primary }: { icon: typeof Printer; label: string; onClick: () => void; busy?: boolean; primary?: boolean }) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={busy}
            className={cn(
                "flex h-16 flex-col items-center justify-center gap-1 rounded-2xl text-[13px] font-semibold transition-colors",
                primary ? "bg-ink text-paper active:opacity-90" : "bg-card text-ink ring-1 ring-line active:bg-paper-2",
            )}
        >
            {busy ? <DotmSquare11 size={18} dotSize={2} speed={1.5} /> : <Icon className="h-5 w-5" />}
            {label}
        </button>
    )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="overflow-hidden rounded-[22px] bg-card ring-1 ring-line">
            <h2 className="px-4 pb-2 pt-3.5 text-[15px] font-semibold text-ink">{title}</h2>
            {children}
        </section>
    )
}

const Empty = ({ text }: { text: string }) => <p className="px-4 pb-4 text-[14px] text-ink-3">{text}</p>

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
    return (
        <span>
            <span className="block text-ink-3">{label}</span>
            <b className={cn("text-ink tabular", tone)}>{value}</b>
        </span>
    )
}

/** One table of the A4 page: the first column left, the numbers right; each row may start a new page. */
function DocTable({ title, head, rows, total, empty, textCols = 1 }: { title: string; head: string[]; rows: string[][]; total?: string[]; empty: string; textCols?: number }) {
    return (
        <section className="mb-5">
            <h2 className="mb-1.5 text-[14px] font-bold" data-pdf-row>
                {title}
            </h2>
            <table className="w-full border-collapse tabular-nums">
                <thead>
                    <tr data-pdf-row>
                        {head.map((h, i) => (
                            <th key={i} className={i >= textCols ? "!text-right" : undefined}>
                                {h}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.length === 0 && (
                        <tr data-pdf-row>
                            <td colSpan={head.length} className="text-center text-neutral-500">
                                {empty}
                            </td>
                        </tr>
                    )}
                    {rows.map((row, k) => (
                        <tr key={k} data-pdf-row>
                            {row.map((c, i) => (
                                <td key={i} className={cn(i === 0 && "font-semibold", i >= textCols && "text-right")}>
                                    {c}
                                </td>
                            ))}
                        </tr>
                    ))}
                    {total && (
                        <tr className="font-bold" data-pdf-row>
                            {total.map((c, i) => (
                                <td key={i} className={i > 0 ? "text-right" : undefined}>
                                    {c}
                                </td>
                            ))}
                        </tr>
                    )}
                </tbody>
            </table>
        </section>
    )
}
