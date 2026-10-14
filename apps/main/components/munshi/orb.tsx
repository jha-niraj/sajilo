"use client"

import { useEffect, useRef, type MutableRefObject } from "react"
import dynamic from "next/dynamic"
import { cn } from "@repo/ui/lib/utils"

const MeshGradient = dynamic(() => import("@paper-design/shaders-react").then((m) => m.MeshGradient), { ssr: false })

export type OrbState = "idle" | "listening" | "thinking" | "speaking"

const LOOK: Record<OrbState, { colors: string[]; speed: number; distortion: number; swirl: number; aura: string }> = {
    idle: { colors: ["#fbe3cb", "#e98a4a", "#c8611f", "#9b7fe0"], speed: 0.22, distortion: 0.75, swirl: 0.45, aura: "232 138 74" },
    listening: { colors: ["#ffe2bd", "#ff9d52", "#e3611c", "#ffc27a"], speed: 0.6, distortion: 0.95, swirl: 0.75, aura: "255 150 80" },
    thinking: { colors: ["#cbbcff", "#7b61ff", "#e98a4a", "#3a2a6b"], speed: 1.1, distortion: 0.9, swirl: 1, aura: "123 97 255" },
    speaking: { colors: ["#ffd5a3", "#f2803a", "#b8521a", "#8a6ff0"], speed: 0.85, distortion: 1, swirl: 0.85, aura: "242 128 58" },
}

/**
 * Munshi's orb: a live mesh-gradient sphere with a glass highlight. Colour and motion follow the
 * conversation state; `levelRef` (0..1, mic or voice loudness) makes it breathe without re-rendering.
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
    /** px; omit and size with className (e.g. size-[min(66vw,280px)]) to keep SSR and client identical */
    size?: number
    onClick?: () => void
    label?: string
    className?: string
}) {
    const rootRef = useRef<HTMLButtonElement>(null)
    const look = LOOK[state]

    useEffect(() => {
        const el = rootRef.current
        if (!el || !levelRef) return
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
        let raf = 0
        let smooth = 0
        const tick = () => {
            const target = reduced ? 0 : Math.min(1, levelRef.current)
            smooth += (target - smooth) * 0.22
            el.style.setProperty("--level", smooth.toFixed(3))
            raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(raf)
    }, [levelRef])

    return (
        <button
            ref={rootRef}
            type="button"
            onClick={onClick}
            aria-label={label}
            className={cn("group relative isolate rounded-full outline-none focus-visible:ring-4 focus-visible:ring-saffron/40", className)}
            style={{ ...(size ? { width: size, height: size } : {}), ["--level" as string]: 0, ["--aura" as string]: look.aura }}
        >
            <span
                aria-hidden
                className="absolute -inset-[22%] -z-10 rounded-full blur-3xl transition-[background] duration-700"
                style={{
                    background: "radial-gradient(circle, rgb(var(--aura) / calc(0.35 + var(--level) * 0.45)), transparent 62%)",
                    transform: "scale(calc(0.92 + var(--level) * 0.35))",
                }}
            />

            {state === "listening" && (
                <>
                    <span aria-hidden className="absolute inset-0 -z-10 animate-[orb-ring_2.4s_ease-out_infinite] rounded-full border-2 border-saffron/40" />
                    <span aria-hidden className="absolute inset-0 -z-10 animate-[orb-ring_2.4s_ease-out_1.2s_infinite] rounded-full border-2 border-saffron/30" />
                </>
            )}

            <span
                className={cn(
                    "absolute inset-0 overflow-hidden rounded-full bg-[conic-gradient(from_200deg,#fbe3cb,#e98a4a,#c8611f,#9b7fe0,#fbe3cb)] shadow-[0_30px_80px_-30px_rgb(184_82_26/0.75),inset_0_-12px_30px_rgb(42_33_24/0.25)]",
                    "transition-transform duration-150 group-active:scale-[0.97]",
                    state === "thinking" && "animate-[orb-wobble_3s_ease-in-out_infinite]",
                )}
                style={{ transform: "scale(calc(1 + var(--level) * 0.09))" }}
            >
                <MeshGradient
                    style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
                    colors={look.colors}
                    distortion={look.distortion}
                    swirl={look.swirl}
                    grainMixer={0}
                    grainOverlay={0}
                    speed={look.speed}
                    scale={1.25}
                />
                <span
                    aria-hidden
                    className="absolute inset-0 rounded-full"
                    style={{
                        background:
                            "radial-gradient(circle at 32% 24%, rgb(255 255 255 / 0.62), transparent 34%), radial-gradient(circle at 70% 88%, rgb(42 33 24 / 0.28), transparent 55%), radial-gradient(circle at 50% 50%, transparent 58%, rgb(255 255 255 / 0.18) 72%, transparent 76%)",
                    }}
                />
                <span aria-hidden className="absolute inset-0 rounded-full ring-1 ring-inset ring-white/35" />
            </span>
        </button>
    )
}
