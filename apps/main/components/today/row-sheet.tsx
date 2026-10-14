"use client"

import { useState } from "react"
import Link from "next/link"
import { Ban, Check, History, Store, Undo2 } from "lucide-react"
import { cn } from "@repo/ui/lib/utils"
import { BottomSheet } from "@/components/bottom-sheet"
import { Keypad } from "@/components/keypad"
import { useI18n } from "@/lib/i18n"
import { computeTodayView } from "@/lib/collection/today-view"
import type { CarryIn, EntryStatus } from "@/lib/collection/types"
import type { DayRow } from "./use-day"

export function RowSheet({
    open,
    row,
    carry,
    locked,
    onClose,
    onMark,
}: {
    open: boolean
    row: DayRow
    carry: CarryIn | undefined
    locked: boolean
    onClose: () => void
    onMark: (row: DayRow, status: EntryStatus, amount: number) => void
}) {
    const { t, money, num } = useI18n()
    const [amount, setAmount] = useState(() => (row.status === "paid" ? String(row.view.received) : ""))

    const expected = row.entry?.expectedAmount ?? row.customer.defaultAmount
    const typed = Number(amount || 0)
    const preview = computeTodayView(carry, expected, "paid", typed)
    const before = computeTodayView(carry, expected, "pending", 0)
    const allDue = expected + before.arrears

    const onKey = (k: string) => {
        if (k === "del") return setAmount((a) => a.slice(0, -1))
        setAmount((a) => (a + k).replace(/^0+(?=\d)/, "").slice(0, 7))
    }

    const done = (status: EntryStatus, value: number) => {
        onMark(row, status, value)
        onClose()
    }

    return (
        <BottomSheet
            open={open}
            onOpenChange={(o) => !o && onClose()}
            title={row.customer.name}
            description={
                before.arrears > 0
                    ? `${t("todaysPart")} ${money(expected)} · ${t("dueOld", { amount: money(before.arrears), days: before.arrearsDays })}`
                    : `${t("todaysPart")} ${money(expected)}`
            }
        >
            <div className="grid grid-cols-2 gap-2.5">
                <QuickButton
                    tone="paid"
                    icon={<Check className="h-6 w-6" strokeWidth={3} />}
                    label={money(expected)}
                    sub={t("todaysPart")}
                    disabled={locked}
                    onClick={() => done("paid", expected)}
                />
                {before.arrears > 0 ? (
                    <QuickButton
                        tone="late"
                        icon={<Check className="h-6 w-6" strokeWidth={3} />}
                        label={money(allDue)}
                        sub={`${t("todaysPart")} + ${num(before.arrearsDays)} ${t("days")}`}
                        disabled={locked}
                        onClick={() => done("paid", allDue)}
                    />
                ) : (
                    <span />
                )}
                <QuickButton
                    tone="miss"
                    icon={<Store className="h-6 w-6" />}
                    label={t("shopClosed")}
                    disabled={locked}
                    onClick={() => done("shop_closed", 0)}
                />
                <QuickButton
                    tone="miss"
                    icon={<Ban className="h-6 w-6" />}
                    label={t("noMoney")}
                    disabled={locked}
                    onClick={() => done("no_money", 0)}
                />
            </div>

            <div className="mt-5 rounded-[22px] bg-card p-4 ring-1 ring-line">
                <p className="text-[15px] font-medium text-ink-2">{t("otherAmount")}</p>
                <p className={cn("mt-1 text-[40px] font-semibold leading-tight tabular", amount ? "text-ink" : "text-ink-3/50")}>
                    {money(typed)}
                </p>
                {typed > 0 && (
                    <div className="mt-2 space-y-1 text-[15px]">
                        <Line label={t("todaysPart")} value={money(preview.toToday)} />
                        {preview.toOld > 0 && (
                            <Line label={t("oldDuePart", { days: preview.oldDaysSettled })} value={money(preview.toOld)} className="text-late" />
                        )}
                        {preview.toAdvance > 0 && <Line label={t("extraPart")} value={money(preview.toAdvance)} className="text-paid" />}
                        {preview.todayOutstanding + preview.arrears > 0 && (
                            <Line label={t("stillDue")} value={money(preview.todayOutstanding + preview.arrears)} className="text-miss" />
                        )}
                    </div>
                )}
            </div>

            <Keypad className="mt-4" onKey={onKey} extraKey="00" disabled={locked} />

            <button
                type="button"
                disabled={locked || typed <= 0}
                onClick={() => done("paid", typed)}
                className="mt-4 flex h-16 w-full items-center justify-center rounded-2xl bg-ink text-lg font-semibold text-paper disabled:opacity-30"
            >
                {t("save")}
            </button>

            <div className="mt-4 flex items-center justify-between">
                <Link
                    href={`/customers/${row.customer.id}`}
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[15px] font-medium text-ink-2 active:bg-paper-2"
                >
                    <History className="h-5 w-5" /> {t("history")}
                </Link>
                {row.status !== "pending" && row.status !== "holiday" && !locked && (
                    <button
                        type="button"
                        onClick={() => done("pending", 0)}
                        className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[15px] font-medium text-miss active:bg-miss-soft"
                    >
                        <Undo2 className="h-5 w-5" /> {t("undo")}
                    </button>
                )}
            </div>
        </BottomSheet>
    )
}

function Line({ label, value, className }: { label: string; value: string; className?: string }) {
    return (
        <div className={cn("flex items-center justify-between text-ink-2", className)}>
            <span>{label}</span>
            <span className="font-semibold tabular">{value}</span>
        </div>
    )
}

function QuickButton({
    tone,
    icon,
    label,
    sub,
    disabled,
    onClick,
}: {
    tone: "paid" | "late" | "miss"
    icon: React.ReactNode
    label: string
    sub?: string
    disabled?: boolean
    onClick: () => void
}) {
    return (
        <button
            type="button"
            disabled={disabled}
            onClick={onClick}
            className={cn(
                "flex min-h-[76px] flex-col items-start justify-center gap-1 rounded-[20px] px-4 py-3 text-left transition-colors disabled:opacity-40",
                tone === "paid" && "bg-paid text-white active:bg-paid/90",
                tone === "late" && "bg-late-soft text-late active:bg-late-soft/70",
                tone === "miss" && "bg-miss-soft text-miss active:bg-miss-soft/70",
            )}
        >
            <span className="flex items-center gap-2 text-[18px] font-semibold leading-tight">
                {icon}
                {label}
            </span>
            {sub && <span className="text-[13px] opacity-85">{sub}</span>}
        </button>
    )
}
