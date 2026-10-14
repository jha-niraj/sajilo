"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import { bsMonthName, toNepaliDigits } from "@repo/calendar"
import { useI18n } from "@/lib/i18n"
import { Choice } from "@/components/choice"

const YEARS_BACK = 6

export function shiftMonth(year: number, month: number, by: number): { year: number; month: number } {
    const total = year * 12 + (month - 1) + by
    return { year: Math.floor(total / 12), month: (total % 12) + 1 }
}

/** ‹ Month ▾  Year ▾ › - same shape as the date picker's header. Future months are disabled. */
export function MonthPicker({
    year,
    month,
    max,
    onChange,
    disabled,
}: {
    year: number
    month: number
    max: { year: number; month: number }
    onChange: (v: { year: number; month: number }) => void
    disabled?: boolean
}) {
    const { lang } = useI18n()
    const atMax = year * 12 + month >= max.year * 12 + max.month
    const atMin = year <= max.year - YEARS_BACK && month === 1
    const years = Array.from({ length: YEARS_BACK + 1 }, (_, i) => max.year - i)
    const yearLabel = (y: number) => (lang === "ne" ? toNepaliDigits(y) : String(y))

    const pick = (y: number, m: number) => {
        const capped = y * 12 + m > max.year * 12 + max.month ? { year: max.year, month: max.month } : { year: y, month: m }
        onChange(capped)
    }

    return (
        <div className="flex items-center gap-2">
            <NavButton label="Previous month" disabled={disabled || atMin} onClick={() => onChange(shiftMonth(year, month, -1))}>
                <ChevronLeft className="h-5 w-5" />
            </NavButton>
            <div className="grid flex-1 grid-cols-[1.4fr_1fr] gap-2">
                <Choice
                    value={String(month)}
                    disabled={disabled}
                    onChange={(v) => pick(year, Number(v))}
                    className="rounded-2xl bg-card text-[16px] font-semibold"
                    options={Array.from({ length: 12 }, (_, i) => ({
                        value: String(i + 1),
                        label: bsMonthName(i + 1, lang),
                        disabled: year === max.year && i + 1 > max.month,
                    }))}
                />
                <Choice
                    value={String(year)}
                    disabled={disabled}
                    onChange={(v) => pick(Number(v), month)}
                    className="rounded-2xl bg-card text-[16px] font-semibold"
                    options={years.map((y) => ({ value: String(y), label: yearLabel(y) }))}
                />
            </div>
            <NavButton label="Next month" disabled={disabled || atMax} onClick={() => onChange(shiftMonth(year, month, 1))}>
                <ChevronRight className="h-5 w-5" />
            </NavButton>
        </div>
    )
}

function NavButton({ children, label, disabled, onClick }: { children: React.ReactNode; label: string; disabled?: boolean; onClick: () => void }) {
    return (
        <button
            type="button"
            disabled={disabled}
            onClick={onClick}
            aria-label={label}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-card text-ink ring-1 ring-line transition-colors active:bg-paper-2 disabled:opacity-30"
        >
            {children}
        </button>
    )
}
