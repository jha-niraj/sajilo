"use client"

import { useMemo, useState } from "react"
import Link from "@/components/app-link"
import { Calculator, Camera, HandCoins, Plus, Wallet } from "lucide-react"
import { cn } from "@repo/ui/lib/utils"
import { PageTop } from "@/components/shell/page-top"
import { useI18n } from "@/lib/i18n"
import type { LoanView } from "@/lib/lending/server"
import { pendingNewLoans, usePendingLoanOps, withPendingRepayments, type ShownLoan } from "@/lib/offline/pending-loans"
import { PendingBadge } from "@/components/shell/pending-badge"

export function LoansClient({
    loans: serverLoans,
    today,
    basis,
    defaultCompounding,
}: {
    loans: LoanView[]
    today: string
    basis: "balance" | "principal"
    defaultCompounding: boolean
}) {
    const { t, money } = useI18n()
    const [tab, setTab] = useState<"active" | "closed">("active")
    const ops = usePendingLoanOps()
    const loans: ShownLoan[] = useMemo(
        () => [...pendingNewLoans(serverLoans, ops, today, basis, defaultCompounding), ...serverLoans.map((l) => withPendingRepayments(l, ops, today, basis))],
        [serverLoans, ops, today, basis, defaultCompounding],
    )

    const active = useMemo(
        () =>
            loans
                .filter((l) => l.status === "active")
                .sort((a, b) => (a.dueInDays ?? 9999) - (b.dueInDays ?? 9999)),
        [loans],
    )
    const closed = useMemo(() => loans.filter((l) => l.status === "closed"), [loans])
    const list = tab === "active" ? active : closed
    const out = active.reduce((s, l) => s + l.statement.principalLeft, 0)
    const interest = active.reduce((s, l) => s + l.statement.interestDue, 0)

    return (
        <>
            <PageTop title={t("loansTitle")} backHref="/more" />
            <div className="space-y-4 px-4 pt-4">
                <section className="rounded-[22px] bg-ink p-4 text-paper">
                    <p className="text-[15px] text-paper/70">{t("owedToday")}</p>
                    <p className="mt-1 text-[28px] font-semibold leading-none tabular">{money(out + interest)}</p>
                    <p className="mt-2 text-[15px] text-paper/80">
                        {t("principalLeft")} {money(out)} · {t("interestDue")} <span className="text-[#ffc58f]">{money(interest)}</span>
                    </p>
                    <div className="mt-4 grid grid-cols-3 gap-2">
                        <Link href="/loans/new" className="flex h-11 items-center justify-center gap-1 rounded-2xl bg-saffron whitespace-nowrap px-1 text-[13px] font-semibold text-white">
                            <Plus className="h-4 w-4 shrink-0" /> {t("newLoanShort")}
                        </Link>
                        <Link href="/loans/calculator" className="flex h-11 items-center justify-center gap-1 rounded-2xl bg-paper/10 whitespace-nowrap px-1 text-[13px] font-semibold">
                            <Calculator className="h-4 w-4 shrink-0" /> {t("calcShort")}
                        </Link>
                        <Link href="/cash" className="flex h-11 items-center justify-center gap-1 rounded-2xl bg-paper/10 whitespace-nowrap px-1 text-[13px] font-semibold">
                            <Wallet className="h-4 w-4 shrink-0" /> {t("cashShort")}
                        </Link>
                    </div>
                </section>

                <div className="grid grid-cols-2 rounded-2xl bg-paper-2 p-1 text-[15px] font-semibold">
                    {(["active", "closed"] as const).map((k) => (
                        <button
                            key={k}
                            type="button"
                            onClick={() => setTab(k)}
                            className={cn("h-11 rounded-xl transition-colors", tab === k ? "bg-card text-ink shadow-sm" : "text-ink-3")}
                        >
                            {k === "active" ? `${t("active")} · ${active.length}` : `${t("closed")} · ${closed.length}`}
                        </button>
                    ))}
                </div>

                {list.length === 0 ? (
                    <div className="flex flex-col items-center rounded-[22px] bg-card px-6 py-10 text-center ring-1 ring-line">
                        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-saffron-soft text-saffron">
                            <HandCoins className="h-8 w-8" />
                        </span>
                        <h2 className="mt-4 text-xl font-semibold text-ink">{t("noLoans")}</h2>
                        <p className="mt-1 text-ink-2">{t("noLoansSub")}</p>
                        <Link href="/scan?kind=loans" className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-paper-2 px-5 py-3 font-semibold text-ink">
                            <Camera className="h-5 w-5" /> {t("scanLoans")}
                        </Link>
                    </div>
                ) : (
                    <ul className="space-y-2.5">
                        {list.map((l) => (
                            <LoanCard key={l.id} loan={l} />
                        ))}
                    </ul>
                )}
            </div>
        </>
    )
}

function LoanCard({ loan }: { loan: ShownLoan }) {
    const { t, money, date } = useI18n()
    const overdue = loan.status === "active" && loan.dueInDays !== null && loan.dueInDays < 0
    const soon = loan.status === "active" && loan.dueInDays !== null && loan.dueInDays >= 0 && loan.dueInDays <= 7
    const e = loan.statement.elapsed
    const unsynced = loan.pending || (loan.pendingRepaymentIds?.length ?? 0) > 0
    const className = cn("block rounded-[22px] bg-card p-4 ring-1 active:bg-paper-2", overdue ? "ring-2 ring-miss/50" : soon ? "ring-2 ring-flag/60" : "ring-line")
    const body = (
        <>
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="truncate text-[16px] font-semibold text-ink">{loan.borrowerName}</p>
                    <p className="text-[14px] text-ink-3">
                        {money(loan.principal)} · {date(loan.startDate, true)} · {t("rateShort", { rate: loan.ratePer100 })}
                    </p>
                </div>
                <div className="shrink-0 whitespace-nowrap text-right">
                    <p className="text-[16px] font-semibold text-ink tabular">{money(loan.statement.total)}</p>
                    <p className="text-[13px] text-saffron tabular">+ {money(loan.statement.interestDue)}</p>
                </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px]">
                <span className="rounded-full bg-paper-2 px-2.5 py-1 text-ink-2">{t("running", { months: e.months, days: e.days })}</span>
                {overdue && <span className="rounded-full bg-miss-soft px-2.5 py-1 font-semibold text-miss">{t("overdue")}</span>}
                {soon && (
                    <span className="rounded-full bg-flag-soft px-2.5 py-1 font-semibold text-[#8a5a08]">
                        {t("dueSoon")} · {date(loan.dueDate!)}
                    </span>
                )}
                {loan.status === "closed" && <span className="rounded-full bg-paid-soft px-2.5 py-1 font-semibold text-paid">{t("closed")}</span>}
                {unsynced && <PendingBadge />}
            </div>
        </>
    )
    return (
        <li>
            {loan.pending ? (
                <div className={className}>{body}</div>
            ) : (
                <Link href={`/loans/${loan.id}`} className={className}>
                    {body}
                </Link>
            )}
        </li>
    )
}
