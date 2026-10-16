"use client"

import { useEffect, useRef, type MutableRefObject } from "react"
import { cn } from "@repo/ui/lib/utils"

export type OrbState = "idle" | "listening" | "thinking" | "speaking"

const TAU = Math.PI * 2
const INK: [number, number, number] = [42, 33, 24]
/** While Munshi speaks the ink warms to saffron, so whose voice it is shows at a glance. */
const WARM: [number, number, number] = [200, 97, 31]

const LOOK: Record<OrbState, { think: number; voice: number }> = {
    idle: { think: 0, voice: 0 },
    listening: { think: 0, voice: 1 },
    thinking: { think: 1, voice: 0 },
    speaking: { think: 0, voice: 1 },
}

/**
 * Munshi's talk-mode mark (Halo & bars, same as Gurukul's Saathi): two rings of dots around five
 * voice bars.
 * - idle: the bars rest in a gentle wave; the rings drift and twinkle
 * - listening: the bars follow his voice and the rings ripple with it
 * - thinking: the bars run in sequence and a bright comet circles the outer ring
 * - speaking: the bars follow Munshi's voice, the rings ripple in four lobes, the ink turns saffron
 * Canvas, so it animates every frame without React re-rendering; `levelRef` is 0..1 loudness.
 * Size it with `className` (e.g. size-[min(66vw,280px)]) or `size`; the canvas follows the box.
 */
export function Orb({
    state,
    levelRef,
    size,
    onClick,
    label,
    className,
}: {
    state: OrbState
    levelRef?: MutableRefObject<number>
    size?: number
    onClick?: () => void
    label?: string
    className?: string
}) {
    const rootRef = useRef<HTMLButtonElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const stateRef = useRef(state)
    const hoverRef = useRef(false)
    const redrawRef = useRef<(() => void) | null>(null)

    useEffect(() => {
        stateRef.current = state
        // Reduced motion draws still frames only, so a new state needs its own frame.
        redrawRef.current?.()
    }, [state])

    useEffect(() => {
        const root = rootRef.current
        const canvas = canvasRef.current
        const g = canvas?.getContext("2d")
        if (!root || !canvas || !g) return
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
        const dpr = Math.min(window.devicePixelRatio || 1, 2)
        let S = 0

        const fit = () => {
            const next = Math.round(root.clientWidth)
            if (!next || next === S) return
            S = next
            canvas.width = Math.round(S * dpr)
            canvas.height = Math.round(S * dpr)
            g.setTransform(dpr, 0, 0, dpr, 0, 0)
        }
        fit()
        const ro = new ResizeObserver(() => {
            fit()
            if (reduced) draw(performance.now())
        })
        ro.observe(root)

        const cur = { think: 0, voice: 0, lvl: 0, hover: 0, speak: 0 }
        const rgba = (a: number) => {
            const k = cur.speak * 0.9
            const c = INK.map((v, i) => Math.round(v + (WARM[i]! - v) * k))
            return `rgba(${c[0]},${c[1]},${c[2]},${Math.max(0, Math.min(1, a))})`
        }
        const t0 = performance.now()
        let raf = 0

        function draw(now: number) {
            if (!S) {
                if (!reduced) raf = requestAnimationFrame(draw)
                return
            }
            const st = stateRef.current
            const want = LOOK[st]
            // Reduced motion: jump straight to the state's look and draw one still frame.
            const ease = (k: number) => (reduced ? 1 : k)
            cur.think += (want.think - cur.think) * ease(0.08)
            cur.voice += (want.voice - cur.voice) * ease(0.08)
            cur.speak += ((st === "speaking" ? 1 : 0) - cur.speak) * ease(0.06)
            cur.hover += ((hoverRef.current && st === "idle" ? 1 : 0) - cur.hover) * ease(0.1)
            cur.lvl += ((reduced ? 0 : Math.min(1, levelRef?.current ?? 0)) - cur.lvl) * 0.3
            const t = reduced ? 0 : (now - t0) / 1000
            const cx = S / 2
            const R = S * 0.42

            g!.clearRect(0, 0, S, S)

            const halo = g!.createRadialGradient(cx, cx, S * 0.08, cx, cx, S * 0.5)
            halo.addColorStop(0, rgba(0.07 + cur.lvl * 0.1 + cur.hover * 0.04))
            halo.addColorStop(1, rgba(0))
            g!.fillStyle = halo
            g!.fillRect(0, 0, S, S)

            const rings: [number, number, number][] = [
                [R, 72, 0],
                [R * 0.76, 48, 1],
            ]
            for (const [rr, n, inner] of rings) {
                for (let i = 0; i < n; i++) {
                    const th = (i / n) * TAU - Math.PI / 2 + (inner ? t * 0.1 : -t * 0.06)
                    const wave = 0.5 + 0.5 * Math.sin(th * 3 + t * 2)
                    const v = cur.voice * cur.lvl * (0.4 + 0.6 * Math.abs(Math.sin(th * (st === "speaking" ? 4 : 6) + t * 7)))
                    const comet = cur.think * Math.max(0, Math.cos(th - t * 5)) ** 14
                    const off = rr * (1 + v * 0.14 * (inner ? 0.6 : 1) + cur.hover * 0.02)
                    const r = S * (inner ? 0.011 : 0.0145) * (0.7 + 0.4 * wave * (1 - cur.voice) + v * 0.9 + comet * 1.2)
                    g!.fillStyle = rgba((inner ? 0.32 : 0.62) + 0.3 * wave * (1 - cur.voice) + comet * 0.5 + v * 0.35)
                    g!.beginPath()
                    g!.arc(cx + Math.cos(th) * off, cx + Math.sin(th) * off, Math.max(0.35, r), 0, TAU)
                    g!.fill()
                }
            }

            const w = S * 0.034
            const gap = w * 0.75
            const maxH = S * 0.27
            const shape = [0.45, 0.75, 1, 0.75, 0.45]
            for (let i = 0; i < 5; i++) {
                const x = cx + (i - 2) * (w + gap)
                const idle = (0.28 + 0.12 * Math.sin(t * 2.2 + i * 0.9)) * (1 + cur.hover * 0.35)
                const voice = cur.voice * cur.lvl * shape[i]! * (0.6 + 0.4 * Math.sin(t * 13 + i * 1.7))
                const think = cur.think * (0.25 + 0.55 * Math.max(0, Math.sin(t * 6 - i * 0.9)) ** 2)
                const h = Math.max(w, maxH * Math.max(idle * (1 - cur.voice) * (1 - cur.think), voice, think, 0.12))
                const grad = g!.createLinearGradient(0, cx - h / 2, 0, cx + h / 2)
                grad.addColorStop(0, rgba(1))
                grad.addColorStop(1, rgba(0.55))
                g!.fillStyle = grad
                const y = cx - h / 2
                const rad = w / 2
                g!.beginPath()
                g!.moveTo(x - w / 2 + rad, y)
                g!.arcTo(x + w / 2, y, x + w / 2, y + h, rad)
                g!.arcTo(x + w / 2, y + h, x - w / 2, y + h, rad)
                g!.arcTo(x - w / 2, y + h, x - w / 2, y, rad)
                g!.arcTo(x - w / 2, y, x + w / 2, y, rad)
                g!.closePath()
                g!.fill()
            }
            if (!reduced) raf = requestAnimationFrame(draw)
        }

        if (reduced) redrawRef.current = () => draw(performance.now())
        raf = requestAnimationFrame(draw)
        return () => {
            cancelAnimationFrame(raf)
            ro.disconnect()
            redrawRef.current = null
        }
    }, [levelRef])

    return (
        <button
            ref={rootRef}
            type="button"
            onClick={onClick}
            onPointerEnter={() => {
                hoverRef.current = true
            }}
            onPointerLeave={() => {
                hoverRef.current = false
            }}
            aria-label={label}
            className={cn(
                "relative grid place-items-center rounded-full outline-none transition-transform duration-150 active:scale-[0.97] focus-visible:ring-4 focus-visible:ring-saffron/40",
                className,
            )}
            style={size ? { width: size, height: size } : undefined}
        >
            <canvas ref={canvasRef} aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" />
        </button>
    )
}
