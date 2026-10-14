"use client"

import { useContext, useRef } from "react"
import { X } from "lucide-react"
import { OTPInputContext, REGEXP_ONLY_DIGITS } from "input-otp"
import { InputOTP, InputOTPGroup } from "@repo/ui/components/ui/input-otp"
import { cn } from "@repo/ui/lib/utils"
import { useI18n } from "@/lib/i18n"

/** +977 block joined to 10 digit boxes, one strip, no gaps. Native number keyboard, no autofill popups. */
export function PhoneInput({
    value,
    onChange,
    onComplete,
    disabled,
    error,
    autoFocus = true,
    onClear,
}: {
    value: string
    onChange: (v: string) => void
    onComplete?: (v: string) => void
    disabled?: boolean
    error?: boolean
    autoFocus?: boolean
    /** Shows an X next to the boxes once something is typed; clears and puts the cursor back. */
    onClear?: () => void
}) {
    const { t } = useI18n()
    const ref = useRef<HTMLInputElement>(null)
    const input = (
        <InputOTP
            ref={ref}
            maxLength={10}
            value={value}
            onChange={onChange}
            onComplete={onComplete}
            disabled={disabled}
            autoFocus={autoFocus}
            inputMode="numeric"
            pattern={REGEXP_ONLY_DIGITS}
            autoComplete="off"
            data-1p-ignore
            data-lpignore="true"
            containerClassName={cn("w-full", error && "animate-[shake_300ms_ease-in-out]")}
        >
            <InputOTPGroup className="w-full rounded-2xl shadow-[0_1px_0_rgb(42_33_24/0.06)]">
                <div
                    className={cn(
                        "flex h-12 shrink-0 items-center justify-center rounded-l-2xl border border-line bg-paper-2 px-2.5 text-[15px] font-semibold text-ink-2",
                        error && "border-miss bg-miss-soft text-miss",
                    )}
                >
                    +977
                </div>
                {Array.from({ length: 10 }, (_, i) => (
                    <DigitSlot key={i} index={i} error={error} />
                ))}
            </InputOTPGroup>
        </InputOTP>
    )
    if (!onClear) return input
    return (
        <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">{input}</div>
            {value.length > 0 && (
                <button
                    type="button"
                    disabled={disabled}
                    aria-label={t("clearNumber")}
                    onClick={() => {
                        onClear()
                        requestAnimationFrame(() => ref.current?.focus())
                    }}
                    className="flex h-12 w-10 shrink-0 items-center justify-center rounded-2xl bg-paper-2 text-ink-2 ring-1 ring-line active:bg-line"
                >
                    <X className="h-5 w-5" />
                </button>
            )}
        </div>
    )
}

function DigitSlot({ index, error }: { index: number; error?: boolean }) {
    const ctx = useContext(OTPInputContext)
    const { char, hasFakeCaret, isActive } = ctx?.slots[index] ?? {}
    return (
        <div
            className={cn(
                "relative flex h-12 min-w-0 flex-1 items-center justify-center border-y border-r border-line bg-card text-[18px] font-semibold text-ink tabular transition-colors",
                "last:rounded-r-2xl",
                isActive && "z-10 rounded-lg ring-2 ring-saffron ring-offset-2 ring-offset-paper last:rounded-r-2xl",
                error && "border-miss bg-miss-soft",
            )}
        >
            {char ?? (!isActive && <span className="h-1 w-1 rounded-full bg-ink-3/30" />)}
            {hasFakeCaret && (
                <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <span className="h-6 w-px animate-pulse bg-ink" />
                </span>
            )}
        </div>
    )
}
