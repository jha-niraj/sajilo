"use client"

import { memo } from "react"
import { Check, Store, Ban, CircleAlert } from "lucide-react"
import { cn } from "@repo/ui/lib/utils"
import { useI18n } from "@/lib/i18n"
import type { DayRow } from "./use-day"

export const CustomerRow = memo(function CustomerRow({
    row,
    locked,
    onTick,
    onOpen,
}: {
    row: DayRow
    locked: boolean
    onTick: (row: DayRow) => void
    onOpen: (row: DayRow) => void
}) {
    const { t, money, num } = useI18n()
    const { customer, status, view, flagged } = row
    const paid = status === "paid"
    const missed = status === "shop_closed" || status === "no_money"
    const holiday = status === "holiday"

    const extraOld = paid && view.toOld > 0
    const differs = paid && view.received !== view.expected && !extraOld

    return (
        <div
            className={cn(
                "flex items-stretch gap-3 rounded-[22px] bg-card p-3 pl-3.5 ring-1 transition-colors duration-200",
                paid ? "ring-paid/25" : missed ? "ring-miss/20" : flagged ? "outline outline-2 outline-flag ring-0 animate-flag" : "ring-line",
                holiday && "opacity-60",
            )}
        >
            <button
                type="button"
                onClick={() => onOpen(row)}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
            >
                <span
                    className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[15px] font-semibold tabular",
                        paid ? "bg-paid-soft text-paid" : flagged ? "bg-flag-soft text-[#8a5a08]" : "bg-paper-2 text-ink-2",
                    )}
                >
                    {num(row.index + 1)}
                </span>
                <span className="min-w-0 flex-1">
                    <span className="block truncate text-[16px] font-semibold leading-snug text-ink">{customer.name}</span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[14px] leading-snug">
                        {flagged && (
                            <span className="inline-flex items-center gap-1 font-medium text-[#8a5a08]">
                                <CircleAlert className="h-4 w-4" /> {t("forgot")}
                            </span>
                        )}
                        {missed && (
                            <span className="font-medium text-miss">{status === "shop_closed" ? t("shopClosed") : t("noMoney")}</span>
                        )}
                        {holiday && <span className="text-ink-3">{t("holiday")}</span>}
                        {extraOld && (
                            <span className="font-medium text-late">
                                + {money(view.toOld)} {t("paidLate")}
                            </span>
                        )}
                        {view.arrears > 0 && (
                            <span className="font-medium text-late">
                                {t("dueOld", { amount: money(view.arrears), days: view.arrearsDays })}
                            </span>
                        )}
                        {view.arrears === 0 && view.advance > 0 && (
                            <span className="font-medium text-paid">{t("advance", { amount: money(view.advance) })}</span>
                        )}
                        {differs && view.todayOutstanding > 0 && (
                            <span className="text-ink-3">
                                {t("stillDue")} {money(view.todayOutstanding)}
                            </span>
                        )}
                    </span>
                </span>
                <span className={cn("shrink-0 text-right text-[16px] font-semibold tabular", paid ? "text-paid" : "text-ink-2")}>
                    {money(paid ? view.received : view.expected)}
                </span>
            </button>

            <button
                type="button"
                disabled={locked}
                onClick={() => onTick(row)}
                aria-label={paid ? t("undo") : t("received")}
                aria-pressed={paid}
                className={cn(
                    "flex h-12 w-12 shrink-0 items-center justify-center self-center rounded-full transition-colors duration-200 disabled:opacity-50",
                    paid
                        ? "bg-paid text-white"
                        : missed
                          ? "bg-miss-soft text-miss"
                          : "border-[2.5px] border-dashed border-ink-3/60 text-transparent active:bg-paid-soft",
                )}
            >
                {paid ? (
                    <Check className="h-8 w-8 animate-tick" strokeWidth={3} />
                ) : status === "shop_closed" ? (
                    <Store className="h-6 w-6" />
                ) : status === "no_money" ? (
                    <Ban className="h-6 w-6" />
                ) : (
                    <Check className="h-7 w-7" />
                )}
            </button>
        </div>
    )
})
