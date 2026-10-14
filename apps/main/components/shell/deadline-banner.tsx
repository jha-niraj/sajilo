"use client"

import { useEffect } from "react"
import Link from "next/link"
import { Landmark } from "lucide-react"
import { cn } from "@repo/ui/lib/utils"
import { useI18n } from "@/lib/i18n"
import type { DeadlineInfo } from "@/actions/report.action"

/** Shown from N days before the bank deposit day (N in Settings). Also sets the app-icon badge. */
export function DeadlineBanner({ info }: { info: DeadlineInfo | null }) {
    const { t, money, date } = useI18n()

    useEffect(() => {
        const nav = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> }
        if (!info || !nav.setAppBadge) return
        if (info.remind) void nav.setAppBadge(Math.max(1, info.daysLeft)).catch(() => {})
        else void nav.clearAppBadge?.().catch(() => {})
    }, [info])

    if (!info?.remind) return null
    const urgent = info.daysLeft <= 1
    return (
        <Link
            href="/month"
            className={cn(
                "no-print mx-4 mt-3 flex items-center gap-3 rounded-2xl px-4 py-3 ring-1",
                urgent ? "bg-miss-soft text-miss ring-miss/20" : "bg-flag-soft text-[#7a4f06] ring-flag/25",
            )}
        >
            <Landmark className="h-6 w-6 shrink-0" />
            <div className="min-w-0 flex-1 leading-snug">
                <p className="text-[15px] font-semibold">
                    {info.daysLeft === 0 ? t("bankDeadlineToday") : t("bankDeadlineIn", { days: info.daysLeft })}
                    <span className="font-normal opacity-80"> · {date(info.deadline)}</span>
                </p>
                <p className="text-[14px] opacity-90">{t("toDeposit", { amount: money(info.monthTotal) })}</p>
            </div>
        </Link>
    )
}
