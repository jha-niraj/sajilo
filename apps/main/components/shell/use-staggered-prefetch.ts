"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { PrefetchKind } from "@/lib/prefetch-kind"

export type QueuedPrefetch = { href: string; kind: PrefetchKind }

const GAP_MS = 350
// The router keeps a prefetched shell for 180 s (staleTimes.static), so one pass per 150 s is
// enough. Without this the queue restarted on every page he opened.
const AGAIN_AFTER_MS = 150_000
let lastPass = 0

/**
 * Warms the bottom bar's pages ONE AT A TIME, from idle, 350 ms apart, skipping the page on screen.
 * On Workers, simultaneous requests spread across isolates and most land on fresh (cold) ones; a
 * queue reuses the warm one. Only the home (Today) is FULL; the rest are shells, so a tap paints the
 * skeleton at once without a heavy full fetch that a tap on 3G would have to wait for.
 */
export function useStaggeredPrefetch(items: QueuedPrefetch[], current: string, enabled = true) {
    const router = useRouter()
    const key = items.map((i) => `${i.href}:${i.kind}`).join("|")

    useEffect(() => {
        if (!enabled || Date.now() - lastPass < AGAIN_AFTER_MS) return
        let stop = false
        const timers: ReturnType<typeof setTimeout>[] = []
        const queue = items.filter((i) => i.href !== current)
        const run = (i: number) => {
            if (i === 0) lastPass = Date.now()
            if (stop || i >= queue.length) return
            router.prefetch(queue[i]!.href, { kind: queue[i]!.kind })
            timers.push(setTimeout(() => run(i + 1), GAP_MS))
        }
        const idle = typeof window.requestIdleCallback === "function"
        const handle = idle ? window.requestIdleCallback(() => run(0), { timeout: 2500 }) : setTimeout(() => run(0), 1200)
        return () => {
            stop = true
            timers.forEach(clearTimeout)
            if (idle) window.cancelIdleCallback(handle as number)
            else clearTimeout(handle as ReturnType<typeof setTimeout>)
        }
        // Once per page: the queue for this set of links from this page.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key, current, enabled])
}
