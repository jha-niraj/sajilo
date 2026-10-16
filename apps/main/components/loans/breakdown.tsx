"use client"

import { cn } from "@repo/ui/lib/utils"
import { useI18n } from "@/lib/i18n"
import type { LoanStatement } from "@/lib/money/interest"

/** The interest maths in plain words, one line per month / part-month / repayment. */
export function Breakdown({ statement, className }: { statement: LoanStatement; className?: string }) {
    const { t, money, date } = useI18n()
    if (statement.rows.length === 0) return null
    return (
        <ol className={cn("divide-y divide-line", className)}>
            {statement.rows.map((r, i) => {
                if (r.kind === "interest") {
                    return (
                        <li key={i} className="flex items-start justify-between gap-3 py-2.5">
                            <div className="min-w-0">
                                <p className="text-[15px] text-ink">
                                    {date(r.from)} - {date(r.to)}
                                </p>
                                <p className="text-[13px] text-ink-3">
                                    {r.fullMonth ? t("fullMonth") : t("partMonth", { days: r.days, total: r.periodDays })} · {money(r.base)}
                                </p>
                            </div>
                            <span className="shrink-0 text-[15px] font-semibold text-ink tabular">+ {money(r.interest)}</span>
                        </li>
                    )
                }
                if (r.kind === "compound") {
                    return (
                        <li key={i} className="flex items-center justify-between gap-3 py-2.5 text-late">
                            <span className="min-w-0 text-[14px]">
                                {date(r.date)} · {t("compoundedRow")}
                            </span>
                            <span className="shrink-0 text-[14px] font-semibold tabular">{money(r.amount)}</span>
                        </li>
                    )
                }
                return (
                    <li key={i} className="py-2.5 text-paid">
                        <div className="flex items-center justify-between gap-3">
                            <span className="min-w-0 text-[15px] font-medium">
                                {date(r.date)} · {t("repaymentRow", { amount: money(r.amount) })}
                            </span>
                            <span className="shrink-0 text-[15px] font-semibold tabular">- {money(r.amount)}</span>
                        </div>
                        <p className="text-[13px] opacity-80">
                            {t("toInterest", { amount: money(r.toInterest) })} · {t("toPrincipal", { amount: money(r.toPrincipal) })}
                        </p>
                    </li>
                )
            })}
        </ol>
    )
}

export function StatementTotals({ statement, big }: { statement: LoanStatement; big?: boolean }) {
    const { t, money } = useI18n()
    return (
        <div className="space-y-1.5">
            <div className="flex items-baseline justify-between">
                <span className="text-[15px] text-ink-2">{t("principalLeft")}</span>
                <span className="text-[15px] font-semibold text-ink tabular">{money(statement.principalLeft)}</span>
            </div>
            <div className="flex items-baseline justify-between">
                <span className="text-[15px] text-ink-2">{t("interestDue")}</span>
                <span className="text-[15px] font-semibold text-saffron tabular">{money(statement.interestDue)}</span>
            </div>
            <div className="flex items-baseline justify-between border-t border-line pt-2">
                <span className="text-[16px] font-semibold text-ink">{t("totalOwed")}</span>
                <span className={cn("font-semibold text-ink tabular", big ? "text-[24px]" : "text-[18px]")}>{money(statement.total)}</span>
            </div>
        </div>
    )
}
