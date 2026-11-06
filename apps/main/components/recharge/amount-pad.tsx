"use client"

import { useState } from "react"
import { cn } from "@repo/ui/lib/utils"
import { Keypad } from "@/components/keypad"
import { useI18n } from "@/lib/i18n"

/** The one place he types a number in Recharge: big amount, the app's keypad, one button. */
export function AmountPad({
    initial,
    label,
    hint,
    submitLabel,
    onSubmit,
    allowZero,
}: {
    initial?: number | null
    label: string
    /** Under the amount; a function gets the amount typed so far */
    hint?: React.ReactNode | ((amount: number) => React.ReactNode)
    submitLabel: string
    onSubmit: (amount: number) => void
    /** A count can be zero (all sold); a sale or payment can't */
    allowZero?: boolean
}) {
    const { money } = useI18n()
    const [value, setValue] = useState(initial ? String(initial) : "")
    const n = Number(value) || 0
    const ok = allowZero ? value !== "" : n > 0

    const key = (k: string) =>
        setValue((v) => {
            if (k === "del") return v.slice(0, -1)
            const next = (v === "0" ? "" : v) + k
            return next.length > 8 ? v : next
        })

    return (
        <div className="flex flex-col gap-3">
            <div className="rounded-[22px] bg-card px-4 py-3 ring-1 ring-line">
                <p className="text-[14px] text-ink-2">{label}</p>
                <p className={cn("text-[30px] font-semibold leading-tight tabular", value ? "text-ink" : "text-ink-3")}>{money(n)}</p>
                {hint && <div className="mt-0.5 text-[14px]">{typeof hint === "function" ? hint(n) : hint}</div>}
            </div>
            <Keypad compact onKey={key} extraKey="00" />
            <button
                type="button"
                disabled={!ok}
                onClick={() => onSubmit(n)}
                className="h-14 rounded-2xl bg-ink text-[17px] font-semibold text-paper transition-colors disabled:bg-ink-3/40"
            >
                {submitLabel}
            </button>
        </div>
    )
}
