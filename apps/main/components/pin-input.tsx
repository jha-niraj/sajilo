"use client"

import { useContext } from "react"
import { OTPInputContext, REGEXP_ONLY_DIGITS } from "input-otp"
import { InputOTP, InputOTPGroup } from "@repo/ui/components/ui/input-otp"
import { cn } from "@repo/ui/lib/utils"

/** 4 joined boxes for the PIN. Opens the phone's number keyboard; digits show as dots. */
export function PinInput({
    value,
    onChange,
    onComplete,
    disabled,
    error,
    autoFocus = true,
}: {
    value: string
    onChange: (v: string) => void
    onComplete?: (v: string) => void
    disabled?: boolean
    error?: boolean
    autoFocus?: boolean
}) {
    return (
        <InputOTP
            maxLength={4}
            value={value}
            onChange={onChange}
            onComplete={onComplete}
            disabled={disabled}
            autoFocus={autoFocus}
            inputMode="numeric"
            pattern={REGEXP_ONLY_DIGITS}
            autoComplete="one-time-code"
            containerClassName={cn("justify-center", error && "animate-[shake_300ms_ease-in-out]")}
        >
            <InputOTPGroup className="rounded-2xl shadow-[0_1px_0_rgb(42_33_24/0.06)]">
                {[0, 1, 2, 3].map((i) => (
                    <PinSlot key={i} index={i} error={error} />
                ))}
            </InputOTPGroup>
        </InputOTP>
    )
}

function PinSlot({ index, error }: { index: number; error?: boolean }) {
    const ctx = useContext(OTPInputContext)
    const { char, hasFakeCaret, isActive } = ctx?.slots[index] ?? {}
    return (
        <div
            data-active={isActive}
            className={cn(
                "relative flex h-16 w-16 items-center justify-center border-y border-r border-line bg-card text-3xl text-ink transition-colors",
                "first:rounded-l-2xl first:border-l last:rounded-r-2xl",
                isActive && "z-10 rounded-xl ring-2 ring-saffron ring-offset-2 ring-offset-paper first:rounded-l-2xl last:rounded-r-2xl",
                error && "border-miss bg-miss-soft",
            )}
        >
            {char ? <span className="h-3.5 w-3.5 rounded-full bg-ink" /> : null}
            {hasFakeCaret && (
                <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <span className="h-7 w-px animate-pulse bg-ink" />
                </span>
            )}
        </div>
    )
}
