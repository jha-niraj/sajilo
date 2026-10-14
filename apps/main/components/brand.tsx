import { cn } from "@repo/ui/lib/utils"

export function BrandMark({ size = 40, className }: { size?: number; className?: string }) {
    return (
        <span
            className={cn(
                "inline-flex shrink-0 flex-col items-center justify-center rounded-[28%] bg-gradient-to-br from-[#d9722c] to-[#b8521a] text-[#fff8ee] shadow-sm",
                className,
            )}
            style={{ width: size, height: size }}
            aria-hidden
        >
            <span className="font-semibold leading-none" style={{ fontSize: size * 0.56, marginTop: size * 0.06 }}>
                स
            </span>
            <span className="rounded-full bg-[#fff8ee]/85" style={{ width: size * 0.34, height: Math.max(2, size * 0.04), marginTop: size * 0.04 }} />
        </span>
    )
}
