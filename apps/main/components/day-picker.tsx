"use client"

import { useState } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@repo/ui/components/ui/popover"
import { NepaliCalendar } from "@repo/ui/components/ui/nepali-date-picker"

const toDate = (ad: string) => {
    const [y, m, d] = ad.split("-").map(Number)
    return new Date(y!, m! - 1, d!)
}
const toAd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

/** BS month/year calendar in a popover, opened by any trigger. Values are AD 'YYYY-MM-DD'. */
export function DayPicker({
    value,
    onChange,
    max,
    children,
}: {
    value: string
    onChange: (ad: string) => void
    max?: string
    children: React.ReactNode
}) {
    const [open, setOpen] = useState(false)
    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>{children}</PopoverTrigger>
            <PopoverContent align="start" className="w-auto rounded-[22px] border-line bg-paper p-3 shadow-xl">
                <NepaliCalendar
                    selected={toDate(value)}
                    maxDate={max ? toDate(max) : null}
                    onSelect={(d) => {
                        onChange(toAd(d))
                        setOpen(false)
                    }}
                />
            </PopoverContent>
        </Popover>
    )
}
