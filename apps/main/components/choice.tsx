"use client"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/components/ui/select"
import { cn } from "@repo/ui/lib/utils"

const NONE = "__none__"

export interface ChoiceOption {
    value: string
    label: string
    disabled?: boolean
}

/** shadcn Select in Sajilo styling. `""` is a valid value (Radix items cannot be empty). */
export function Choice({
    value,
    onChange,
    options,
    placeholder,
    disabled,
    className,
    size = "md",
    tone,
}: {
    value: string
    onChange: (v: string) => void
    options: ChoiceOption[]
    placeholder?: string
    disabled?: boolean
    className?: string
    size?: "md" | "lg"
    tone?: "warn"
}) {
    return (
        <Select value={value === "" ? NONE : value} onValueChange={(v) => onChange(v === NONE ? "" : v)} disabled={disabled}>
            <SelectTrigger
                className={cn(
                    "rounded-xl border-line bg-paper text-ink shadow-none focus:ring-2 focus:ring-saffron",
                    size === "lg" ? "h-12 text-[18px] font-semibold" : "h-12 text-[16px]",
                    tone === "warn" && "border-miss/40 text-miss",
                    className,
                )}
            >
                <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent className="max-h-80 rounded-2xl border-line bg-card">
                {options.map((o) => (
                    <SelectItem
                        key={o.value || NONE}
                        value={o.value === "" ? NONE : o.value}
                        disabled={o.disabled}
                        className="min-h-11 rounded-xl text-[16px] text-ink focus:bg-paper-2 data-[state=checked]:bg-saffron-soft"
                    >
                        {o.label}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    )
}
