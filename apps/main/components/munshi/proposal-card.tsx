"use client"

import { motion } from "framer-motion"
import { Check, CircleAlert, HandCoins, UserPlus, Wallet, X } from "lucide-react"
import { cn } from "@repo/ui/lib/utils"
import { useI18n } from "@/lib/i18n"
import type { Proposal } from "@/lib/munshi/types"

const ICON = { mark_payment: Wallet, add_customer: UserPlus, add_loan: HandCoins, add_repayment: HandCoins }

export function ProposalCard({
    p,
    busy,
    onConfirm,
    onCancel,
    compact,
}: {
    p: Proposal
    busy?: boolean
    onConfirm: () => void
    onCancel: () => void
    compact?: boolean
}) {
    const { t } = useI18n()
    const Icon = ICON[p.kind] ?? Wallet
    const pending = p.status === "pending"
    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
                "overflow-hidden rounded-[22px] bg-card ring-1",
                pending ? "ring-saffron/40 shadow-[0_12px_30px_-18px_rgb(200_97_31/0.6)]" : "ring-line",
                compact && "rounded-2xl",
            )}
        >
            <div className="flex items-start gap-3 p-4">
                <span
                    className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                        p.status === "done" ? "bg-paid text-white" : p.status === "failed" ? "bg-miss-soft text-miss" : "bg-saffron-soft text-saffron",
                    )}
                >
                    {p.status === "done" ? <Check className="h-5 w-5" strokeWidth={3} /> : p.status === "failed" ? <CircleAlert className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                </span>
                <div className="min-w-0 flex-1">
                    <p className={cn("text-[17px] font-semibold leading-snug text-ink", p.status === "cancelled" && "text-ink-3 line-through")}>{p.title}</p>
                    {p.lines.length > 0 && <p className="mt-0.5 text-[14px] text-ink-3">{p.lines.join(" · ")}</p>}
                    {!pending && (
                        <p className={cn("mt-1 text-[13px] font-semibold", p.status === "done" ? "text-paid" : p.status === "failed" ? "text-miss" : "text-ink-3")}>
                            {p.status === "done" ? t("savedDone") : p.status === "failed" ? t("failedLabel") : t("cancelledLabel")}
                        </p>
                    )}
                </div>
            </div>
            {pending && (
                <div className="grid grid-cols-[1fr_2fr] gap-2 px-4 pb-4">
                    <button
                        type="button"
                        disabled={busy}
                        onClick={onCancel}
                        className="flex h-12 items-center justify-center gap-1.5 rounded-xl bg-paper-2 font-semibold text-ink-2 disabled:opacity-50"
                    >
                        <X className="h-4 w-4" /> {t("cancel")}
                    </button>
                    <button
                        type="button"
                        disabled={busy}
                        onClick={onConfirm}
                        className="flex h-12 items-center justify-center gap-1.5 rounded-xl bg-paid font-semibold text-white disabled:opacity-50"
                    >
                        <Check className="h-5 w-5" strokeWidth={3} /> {t("confirm")}
                    </button>
                </div>
            )}
        </motion.div>
    )
}
