"use client"

import { Delete } from "lucide-react"
import { cn } from "@repo/ui/lib/utils"
import { useI18n } from "@/lib/i18n"
import { toNepaliDigits } from "@repo/calendar"

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"] as const

/** Big, thumb-sized number pad. Shows Nepali digits in Nepali mode. */
export function Keypad({
    onKey,
    disabled,
    className,
    extraKey,
}: {
    onKey: (key: string) => void
    disabled?: boolean
    className?: string
    /** Optional key in the empty bottom-left slot, e.g. "00" */
    extraKey?: string
}) {
    const { lang } = useI18n()
    return (
        <div className={cn("grid grid-cols-3 gap-2.5", className)}>
            {KEYS.map((k, i) => {
                const key = k === "" ? extraKey : k
                if (!key) return <span key={i} />
                return (
                    <button
                        key={i}
                        type="button"
                        disabled={disabled}
                        onClick={() => {
                            if ("vibrate" in navigator) navigator.vibrate?.(8)
                            onKey(key)
                        }}
                        aria-label={key === "del" ? "Delete" : key}
                        className={cn(
                            "flex h-16 items-center justify-center rounded-2xl text-[28px] font-medium text-ink transition-colors select-none",
                            "bg-card shadow-[0_1px_0_rgb(42_33_24/0.06)] ring-1 ring-line active:bg-paper-2 disabled:opacity-40",
                            key === "del" && "bg-transparent shadow-none ring-0 active:bg-paper-2",
                        )}
                    >
                        {key === "del" ? <Delete className="h-7 w-7 text-ink-2" /> : lang === "ne" ? toNepaliDigits(key) : key}
                    </button>
                )
            })}
        </div>
    )
}
