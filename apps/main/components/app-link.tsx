"use client"

import { useEffect, useRef, type ComponentProps } from "react"
import NextLink from "next/link"
import { useRouter } from "next/navigation"
import { PrefetchKind } from "@/lib/prefetch-kind"

const INTENT_MS = 100

/**
 * The one link component (`next/link` is imported nowhere else; eslint enforces it).
 *
 * A plain <Link> prefetches every link the moment it is on screen: a list of 30 customers is 30
 * server renders, again after every change. This prefetches on INTENT instead, and only the page's
 * SHELL (layout + loading.tsx, a few kB): 100 ms after the pointer starts moving over it, at once on
 * touch or keyboard focus. So a tap paints the skeleton at once and only the data waits.
 * `prefetch={true}` asks for the FULL page on intent; `prefetch={false}` turns intent off.
 */
export default function Link({ href, prefetch, onPointerMove, onPointerLeave, onTouchStart, onFocus, onClick, ...rest }: ComponentProps<typeof NextLink>) {
    const router = useRouter()
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const done = useRef(false)
    const target = typeof href === "string" ? href : null
    const off = prefetch === false || !target || !target.startsWith("/")

    useEffect(() => () => void (timer.current && clearTimeout(timer.current)), [])
    useEffect(() => {
        done.current = false
    }, [target])

    const cancel = () => {
        if (timer.current) clearTimeout(timer.current)
        timer.current = null
    }
    const fetchNow = () => {
        cancel()
        if (off || done.current) return
        done.current = true
        router.prefetch(target!, { kind: prefetch === true ? PrefetchKind.FULL : PrefetchKind.AUTO })
    }

    return (
        <NextLink
            href={href}
            prefetch={false}
            onPointerMove={(e) => {
                if (!off && !done.current && !timer.current) timer.current = setTimeout(fetchNow, INTENT_MS)
                onPointerMove?.(e)
            }}
            onPointerLeave={(e) => {
                cancel()
                onPointerLeave?.(e)
            }}
            onTouchStart={(e) => {
                fetchNow()
                onTouchStart?.(e)
            }}
            onFocus={(e) => {
                fetchNow()
                onFocus?.(e)
            }}
            onClick={(e) => {
                cancel()
                onClick?.(e)
            }}
            {...rest}
        />
    )
}
