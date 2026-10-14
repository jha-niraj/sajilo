"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Ban, Check, CheckCircle2, Lock, LockOpen, Store } from "lucide-react"
import { cn } from "@repo/ui/lib/utils"
import { PageTop } from "@/components/shell/page-top"
import { ScrollArea } from "@repo/ui/components/ui/scroll-area"
import { Keypad } from "@/components/keypad"
import { useI18n } from "@/lib/i18n"
import { closeDay, reopenDay } from "@/actions/collection.action"
import { flush, refreshDay } from "@/lib/offline/sync"
import { useDay, useNepalToday } from "./use-day"

export function FinishClient() {
    const { t, money, date: fmtDate } = useI18n()
    const router = useRouter()
    const today = useNepalToday()
    const { snapshot, rows, totals, mark } = useDay(today)
    const [cash, setCash] = useState("")
    const [busy, setBusy] = useState(false)

    const locked = Boolean(snapshot?.lockedAt)
    const pending = rows.filter((r) => r.status === "pending")
    const counted = cash === "" ? null : Number(cash)
    const diff = counted === null ? 0 : counted - totals.collected

    const onKey = (k: string) => {
        if (k === "del") return setCash((c) => c.slice(0, -1))
        setCash((c) => (c + k).replace(/^0+(?=\d)/, "").slice(0, 8))
    }

    const lock = async () => {
        setBusy(true)
        try {
            await flush()
            await closeDay(today, counted ?? snapshot?.countedCash ?? null)
            await refreshDay(today)
            toast.success(t("dayClosedMsg"))
            router.push("/today")
        } catch {
            toast.error(t("somethingWrong"))
        } finally {
            setBusy(false)
        }
    }

    const unlock = async () => {
        setBusy(true)
        try {
            await reopenDay(today)
            await refreshDay(today)
        } finally {
            setBusy(false)
        }
    }

    return (
        <>
            <PageTop title={t("finishTitle")} subtitle={fmtDate(today, true)} backHref="/today" />

            <div className="space-y-4 px-4 pt-4">
                <section className="rounded-[24px] bg-card p-4 ring-1 ring-line">
                    {pending.length === 0 ? (
                        <p className="flex items-center gap-2 text-[15px] font-semibold text-paid">
                            <CheckCircle2 className="h-6 w-6" /> {t("allMarked")}
                        </p>
                    ) : (
                        <>
                            <p className="text-[15px] font-semibold text-ink">
                                {t("notMarked")} · {pending.length}
                            </p>
                            <ScrollArea orientation="vertical" className="mt-2" viewportClassName="max-h-[248px]">
                            <ul className="divide-y divide-line pr-2">
                                {pending.map((r) => (
                                    <li key={r.customer.id} className="flex items-center gap-2 py-2.5">
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-[15px] font-medium text-ink">{r.customer.name}</span>
                                            <span className="block text-[12px] text-ink-3 tabular">{money(r.view.expected)}</span>
                                        </span>
                                        <IconBtn
                                            label={t("received")}
                                            tone="paid"
                                            disabled={locked}
                                            onClick={() => void mark(r.customer.id, "paid", r.view.expected)}
                                        >
                                            <Check className="h-5 w-5" strokeWidth={3} />
                                        </IconBtn>
                                        <IconBtn
                                            label={t("shopClosed")}
                                            tone="miss"
                                            disabled={locked}
                                            onClick={() => void mark(r.customer.id, "shop_closed", 0)}
                                        >
                                            <Store className="h-5 w-5" />
                                        </IconBtn>
                                        <IconBtn
                                            label={t("noMoney")}
                                            tone="miss"
                                            disabled={locked}
                                            onClick={() => void mark(r.customer.id, "no_money", 0)}
                                        >
                                            <Ban className="h-5 w-5" />
                                        </IconBtn>
                                    </li>
                                ))}
                            </ul>
                            </ScrollArea>
                            {!locked && (
                                <button
                                    type="button"
                                    onClick={() => pending.forEach((r) => void mark(r.customer.id, "no_money", 0))}
                                    className="mt-3 w-full rounded-2xl bg-miss-soft py-3 text-[15px] font-semibold text-miss"
                                >
                                    {t("markRestAsMissed")}
                                </button>
                            )}
                        </>
                    )}
                </section>

                <section className="rounded-[24px] bg-card p-4 ring-1 ring-line">
                    <div className="flex items-center justify-between text-[16px] text-ink-2">
                        <span>{t("appSays")}</span>
                        <span className="text-[19px] font-semibold text-ink tabular">{money(totals.collected)}</span>
                    </div>
                    <div className="mt-3">
                        <p className="text-[16px] text-ink-2">{t("countedCash")}</p>
                        <p className={cn("text-[30px] font-semibold leading-tight tabular", cash ? "text-ink" : "text-ink-3/40")}>
                            {money(counted ?? snapshot?.countedCash ?? 0)}
                        </p>
                    </div>
                    <p
                        className={cn(
                            "mt-2 flex h-12 items-center justify-center rounded-2xl px-4 text-center text-[16px] font-semibold",
                            counted === null ? "bg-paper-2 text-[14px] font-medium text-ink-3" : diff === 0 ? "bg-paid-soft text-paid" : "bg-flag-soft text-[#8a5a08]",
                        )}
                    >
                        {counted === null
                            ? t("countHint")
                            : diff === 0
                              ? `✓ ${t("matched")}`
                              : diff < 0
                                ? t("short", { amount: money(-diff) })
                                : t("over", { amount: money(diff) })}
                    </p>
                    {!locked && <Keypad className="mt-3" compact onKey={onKey} extraKey="00" />}
                </section>

                {locked ? (
                    <button
                        type="button"
                        disabled={busy}
                        onClick={unlock}
                        className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-paper-2 text-[16px] font-semibold text-ink disabled:opacity-50"
                    >
                        <LockOpen className="h-5 w-5" /> {t("unlockDay")}
                    </button>
                ) : (
                    <button
                        type="button"
                        disabled={busy}
                        onClick={lock}
                        className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-ink text-[16px] font-semibold text-paper disabled:opacity-50"
                    >
                        <Lock className="h-5 w-5" /> {t("lockDay")}
                    </button>
                )}
            </div>
        </>
    )
}

function IconBtn({
    children,
    label,
    tone,
    disabled,
    onClick,
}: {
    children: React.ReactNode
    label: string
    tone: "paid" | "miss"
    disabled?: boolean
    onClick: () => void
}) {
    return (
        <button
            type="button"
            aria-label={label}
            title={label}
            disabled={disabled}
            onClick={onClick}
            className={cn(
                "flex h-11 w-11 items-center justify-center rounded-full disabled:opacity-40",
                tone === "paid" ? "bg-paid-soft text-paid" : "bg-miss-soft text-miss",
            )}
        >
            {children}
        </button>
    )
}
