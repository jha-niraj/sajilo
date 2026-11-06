"use client"

import { cn } from "@repo/ui/lib/utils"
import { useI18n } from "@/lib/i18n"
import type { StockKind } from "@/lib/recharge/ledger"

/** E-load can be any amount; scratch cards come in fixed prices. Decided with Niraj, 2026-11-06. */
export const SELL_CHIPS: Record<StockKind, number[]> = {
    eload: [50, 100, 150, 200, 300, 500, 1000, 2000],
    card: [50, 100, 200, 500, 1000],
}
export const BUY_CHIPS = [5000, 10000, 20000, 30000, 50000]

/** Big amount buttons: one tap is one sale. "Other" opens the keypad. */
export function AmountChips({
    amounts,
    onPick,
    onOther,
    tone = "ink",
    disabled,
    short,
}: {
    amounts: number[]
    onPick: (amount: number) => void
    onOther: () => void
    tone?: "ink" | "credit"
    disabled?: boolean
    /** Amounts above the stock in hand: shown faded; a tap explains instead of selling */
    short?: (amount: number) => boolean
}) {
    const { t, num } = useI18n()
    const chip = cn(
        "flex h-14 items-center justify-center rounded-2xl text-[19px] font-semibold tabular transition-colors select-none disabled:opacity-40",
        tone === "credit" ? "bg-flag-soft text-[#8a5a08] active:bg-flag/25" : "bg-card text-ink ring-1 ring-line shadow-[0_1px_0_rgb(42_33_24/0.06)] active:bg-saffron-soft",
    )
    return (
        <div className="grid grid-cols-4 gap-2">
            {amounts.map((a) => (
                <button
                    key={a}
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                        if ("vibrate" in navigator) navigator.vibrate?.(12)
                        onPick(a)
                    }}
                    className={cn(chip, short?.(a) && "opacity-40")}
                >
                    {num(a)}
                </button>
            ))}
            <button type="button" disabled={disabled} onClick={onOther} className={cn(chip, "text-[16px]", amounts.length % 4 === 0 && "col-span-4", amounts.length % 4 === 1 && "col-span-3")}>
                {t("rcOther")}
            </button>
        </div>
    )
}
