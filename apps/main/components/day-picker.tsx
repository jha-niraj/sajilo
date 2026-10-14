"use client"

import { useState } from "react"
import { CalendarDays } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@repo/ui/components/ui/popover"
import { NepaliCalendar } from "@repo/ui/components/ui/nepali-date-picker"
import { cn } from "@repo/ui/lib/utils"
import { BS_MONTHS_EN, BS_MONTHS_NE, WEEKDAYS_EN, WEEKDAYS_NE, toNepaliDigits } from "@repo/calendar"
import { useI18n } from "@/lib/i18n"

const toDate = (ad: string) => {
    const [y, m, d] = ad.split("-").map(Number)
    return new Date(y!, m! - 1, d!)
}
const toAd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

/** BS month/year calendar in a popover, opened by any trigger, in the app's language. Values are AD 'YYYY-MM-DD'. */
export function DayPicker({
    value,
    onChange,
    min,
    max,
    children,
}: {
    value: string
    onChange: (ad: string) => void
    min?: string
    max?: string
    children: React.ReactNode
}) {
    const [open, setOpen] = useState(false)
    const { lang } = useI18n()
    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>{children}</PopoverTrigger>
            <PopoverContent align="start" className="z-[90] w-auto rounded-[22px] border-line bg-paper p-3 shadow-xl">
                <NepaliCalendar
                    selected={value ? toDate(value) : null}
                    minDate={min ? toDate(min) : null}
                    maxDate={max ? toDate(max) : null}
                    monthNames={lang === "ne" ? BS_MONTHS_NE : BS_MONTHS_EN}
                    weekdayNames={(lang === "ne" ? WEEKDAYS_NE : WEEKDAYS_EN).map((w) => (lang === "ne" ? w : w.slice(0, 2)))}
                    formatNumber={(n) => (lang === "ne" ? toNepaliDigits(n) : String(n))}
                    onSelect={(d) => {
                        onChange(toAd(d))
                        setOpen(false)
                    }}
                />
            </PopoverContent>
        </Popover>
    )
}

/** A form field that shows the BS date the app's way ("Wed, 28 Asoj 2083") and opens DayPicker. */
export function DateField({
    value,
    onChange,
    min,
    max,
    className,
    placeholder,
}: {
    value: string
    onChange: (ad: string) => void
    min?: string
    max?: string
    className?: string
    placeholder?: string
}) {
    const { date, weekday } = useI18n()
    return (
        <DayPicker value={value} onChange={onChange} min={min} max={max}>
            <button
                type="button"
                className={cn(
                    "flex h-12 w-full items-center gap-2 rounded-xl border border-line bg-paper px-3 text-left text-[16px] text-ink transition-colors focus-visible:ring-2 focus-visible:ring-saffron",
                    className,
                )}
            >
                <CalendarDays className="h-4 w-4 shrink-0 text-saffron" />
                {value ? (
                    <span className="truncate">
                        {weekday(value)}, {date(value, true)}
                    </span>
                ) : (
                    <span className="text-ink-3">{placeholder}</span>
                )}
            </button>
        </DayPicker>
    )
}
