"use client"

import { useEffect, useRef, type MutableRefObject } from "react"
import { cn } from "@repo/ui/lib/utils"

const BARS = 24

/** Live talking bars driven by mic level; each bar wobbles a little differently so it looks alive. */
export function Waveform({ levelRef, className }: { levelRef: MutableRefObject<number>; className?: string }) {
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const el = ref.current
        if (!el) return
        const bars = Array.from(el.children) as HTMLElement[]
        let raf = 0
        let t = 0
        let smooth = 0
        const tick = () => {
            t += 0.12
            smooth += (levelRef.current - smooth) * 0.3
            bars.forEach((b, i) => {
                const wobble = 0.5 + 0.5 * Math.sin(t + i * 0.7) * Math.cos(t * 0.6 + i * 0.3)
                const h = 0.12 + Math.min(1, smooth * 1.6) * (0.35 + wobble * 0.65)
                b.style.transform = `scaleY(${h.toFixed(3)})`
            })
            raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(raf)
    }, [levelRef])

    return (
        <div ref={ref} className={cn("flex h-8 items-center gap-[3px]", className)} aria-hidden>
            {Array.from({ length: BARS }, (_, i) => (
                <span key={i} className="h-full w-[3px] origin-center rounded-full bg-saffron" style={{ transform: "scaleY(0.12)" }} />
            ))}
        </div>
    )
}

/** Three soft dots while his speech is being turned into text. */
export function TypingDots({ className }: { className?: string }) {
    return (
        <span className={cn("inline-flex items-center gap-1", className)} aria-hidden>
            {[0, 1, 2].map((i) => (
                <span key={i} className="h-2 w-2 animate-bounce rounded-full bg-current opacity-60" style={{ animationDelay: `${i * 140}ms` }} />
            ))}
        </span>
    )
}
