"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import { useI18n } from "@/lib/i18n"
import { Choice } from "@/components/choice"

export function shiftMonth(year: number, month: number, by: number): { year: number; month: number } {
    const total = year * 12 + (month - 1) + by
    return { year: Math.floor(total / 12), month: (total % 12) + 1 }
}

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
    const { month: label } = useI18n()
    const atMax = year * 12 + month >= max.year * 12 + max.month
    const options = Array.from({ length: 24 }, (_, i) => shiftMonth(max.year, max.month, -i))

    return (
        <div className="flex items-center gap-2">
            <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(shiftMonth(year, month, -1))}
                aria-label="Previous month"
                className="flex h-12 w-12 items-center justify-center rounded-2xl bg-card ring-1 ring-line active:bg-paper-2 disabled:opacity-40"
            >
                <ChevronLeft className="h-6 w-6" />
            </button>
            <div className="flex-1">
                <Choice
                    value={`${year}-${month}`}
                    disabled={disabled}
                    size="lg"
                    className="rounded-2xl bg-card"
                    onChange={(v) => {
                        const [y, m] = v.split("-").map(Number)
                        onChange({ year: y!, month: m! })
                    }}
                    options={options.map((o) => ({ value: `${o.year}-${o.month}`, label: label(o.year, o.month) }))}
                />
            </div>
            <button
                type="button"
                disabled={disabled || atMax}
                onClick={() => onChange(shiftMonth(year, month, 1))}
                aria-label="Next month"
                className="flex h-12 w-12 items-center justify-center rounded-2xl bg-card ring-1 ring-line active:bg-paper-2 disabled:opacity-30"
            >
                <ChevronRight className="h-6 w-6" />
            </button>
        </div>
    )
}
