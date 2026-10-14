import { cn } from "@repo/ui/lib/utils"

export function BrandMark({ size = 40, className }: { size?: number; className?: string }) {
    return (
        // eslint-disable-next-line @next/next/no-img-element -- the app icon itself; no image optimizer on Workers
        <img
            src={size > 64 ? "/icons/icon-512.png" : "/icons/icon-192.png"}
            alt=""
            aria-hidden
            width={size}
            height={size}
            className={cn("shrink-0 rounded-[28%] shadow-sm", className)}
        />
    )
}
