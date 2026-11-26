"use client"

import { type RefObject, useEffect, useRef, useState } from "react"

/** Sets `on` once the element is a third in view. With reduced motion the CSS shows the finished scene anyway. */
export function useOnView<T extends Element>(threshold = 0.35): [RefObject<T | null>, boolean] {
    const ref = useRef<T | null>(null)
    const [on, setOn] = useState(false)
    useEffect(() => {
        const el = ref.current
        if (!el || on) return
        if (typeof IntersectionObserver === "undefined") {
            setOn(true)
            return
        }
        const io = new IntersectionObserver(
            (entries) => {
                if (entries.some((e) => e.isIntersecting)) {
                    setOn(true)
                    io.disconnect()
                }
            },
            { threshold },
        )
        io.observe(el)
        return () => io.disconnect()
    }, [on, threshold])
    return [ref, on]
}
