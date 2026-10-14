"use client"

import { useEffect, useRef, useState } from "react"
import { ScrollArea } from "@repo/ui/components/ui/scroll-area"
import { cn } from "@repo/ui/lib/utils"

/**
 * A fixed-height scroll box that renders `step` rows at a time and quietly adds the next
 * `step` when the bottom comes into view, so long months stay light on an old phone.
 */
export function ProgressiveList<T>({
    items,
    render,
    getKey,
    step = 10,
    height = 520,
    className,
    empty,
    resetKey,
}: {
    items: T[]
    render: (item: T, index: number) => React.ReactNode
    getKey: (item: T) => string
    step?: number
    height?: number
    className?: string
    empty?: React.ReactNode
    /** Changing this (e.g. a new month) scrolls back to the top and starts from the first page */
    resetKey?: string
}) {
    const [count, setCount] = useState(step)
    const viewportRef = useRef<HTMLDivElement>(null)
    const sentinelRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        setCount(step)
        viewportRef.current?.scrollTo({ top: 0 })
    }, [resetKey, step])

    useEffect(() => {
        const root = viewportRef.current
        const target = sentinelRef.current
        if (!root || !target) return
        const io = new IntersectionObserver(
            (entries) => {
                if (entries.some((e) => e.isIntersecting)) setCount((c) => Math.min(items.length, c + step))
            },
            { root, rootMargin: "0px 0px 160px 0px" },
        )
        io.observe(target)
        return () => io.disconnect()
    }, [items.length, step, count])

    const shown = items.slice(0, count)
    const fits = items.length <= step

    return (
        <ScrollArea
            orientation="vertical"
            viewportRef={viewportRef}
            className={cn("rounded-[22px] bg-card ring-1 ring-line", className)}
            viewportClassName={fits ? undefined : "max-h-[var(--list-h)]"}
            style={{ ["--list-h" as string]: `${height}px` }}
        >
            {items.length === 0 ? (
                empty
            ) : (
                <ul className="divide-y divide-line">
                    {shown.map((item, i) => (
                        <li key={getKey(item)}>{render(item, i)}</li>
                    ))}
                </ul>
            )}
            {count < items.length && <div ref={sentinelRef} className="h-px" aria-hidden />}
        </ScrollArea>
    )
}
