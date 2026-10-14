"use client"

/*
 * One dusk scene for every full-screen moment: signing in, signing out, registering, loading.
 *
 * A school at dusk. Its bell tower throws a lamp across the grounds, lights come on in the
 * windows, hills roll behind it, and a PAPER PLANE either LEAVES (signing out: it lifts from the
 * yard and flies out toward the sun) or ARRIVES (signing in, registering, loading: it comes in
 * from the sun and settles by the steps). The 404's lost plane (`plane-adrift.tsx`) is the same
 * world at the same hour.
 *
 * ## Why a paper plane, and why a school rather than a harbour
 *
 * This is a port of ShipItHQ's harbour - lighthouse, pier, sailboat - and the craft carried over
 * unchanged. The WORLD did not, because a harbour is that product's metaphor and not ours:
 * Gurukul runs schools. A paper plane is the school object every child everywhere has folded,
 * it needs no local knowledge to read, and it is made of the same thing the Gurukul mark is made
 * of - paper. The bell tower does the lighthouse's job; the hills do the sea's.
 *
 * Pure SVG and CSS. No animation library, no request, nothing to load. Nothing moves under
 * `prefers-reduced-motion`; the plane parks somewhere sensible instead of vanishing.
 *
 * The panel is a warm terracotta dusk in BOTH themes (Niraj, 2026-10-13: "warm, no black-and-white
 * thing, not gold"), so its ink - a cream (#FFF1E4) - is constant (root CLAUDE.md: a surface that does
 * not change with the theme must keep its ink constant too). The shadows inside it (windows,
 * doorway, sun bands) are a deep ember (#5A1A0B), never black. The page around it is cream in light
 * and a warm ember-dark in dark mode, never white or black.
 */

import type { ReactNode } from "react"

const W = 600
const H = 320

export type SceneMode = "leaving" | "arriving"

/**
 * A ridge across twice the width, so sliding it one period left loops with no seam.
 *
 * The same trick the harbour used for its waves, and the reason it is a function rather than a
 * literal: the loop only disappears if the shape is genuinely periodic, which is easy to get
 * wrong by hand and impossible to get wrong here.
 */
function ridge(y: number, amp: number, period: number) {
    let d = `M0 ${y} Q${period / 4} ${y - amp} ${period / 2} ${y}`
    for (let x = period; x <= W * 2 + period; x += period / 2) d += ` T${x} ${y}`
    return `${d} V${H} H0 Z`
}

const STARS: [number, number][] = [
    [60, 40], [140, 26], [236, 58], [330, 30], [420, 64], [510, 36], [566, 90], [30, 110], [472, 18],
]

/** The lit windows of the school, and the delay that makes them come on one at a time. */
const WINDOWS: [number, number][] = [[64, 190], [80, 190], [128, 190], [144, 190], [64, 212], [144, 212]]

const CSS = `
.gks * { transform-box: fill-box; }
.gks-sun { animation: gks-sun 9s ease-in-out infinite alternate; }
@keyframes gks-sun { from { transform: translateY(-6px) } to { transform: translateY(8px) } }
.gks-star { animation: gks-twinkle 3s ease-in-out infinite; transform-origin: center; }
@keyframes gks-twinkle { 0%, 100% { opacity: .2 } 50% { opacity: .9 } }
.gks-hill { animation: gks-roll linear infinite; }
.gks-h1 { animation-duration: 16s; } .gks-h2 { animation-duration: 10s; } .gks-h3 { animation-duration: 6.5s; }
@keyframes gks-roll { from { transform: translateX(0) } to { transform: translateX(-120px) } }
.gks-flight { transform-box: view-box; transform-origin: 180px 210px; animation: 4.2s cubic-bezier(.4,0,.6,1) infinite; }
.gks-leaving .gks-flight { animation-name: gks-leave; }
.gks-arriving .gks-flight { animation-name: gks-arrive; }
@keyframes gks-leave {
  0%   { transform: translate(0, 0) scale(1); opacity: 0 }
  8%   { opacity: 1 }
  80%  { transform: translate(250px, -46px) scale(.32); opacity: 1 }
  100% { transform: translate(282px, -52px) scale(.24); opacity: 0 }
}
@keyframes gks-arrive {
  0%   { transform: translate(282px, -52px) scale(.24); opacity: 0 }
  12%  { opacity: 1 }
  78%  { transform: translate(44px, -6px) scale(.92); opacity: 1 }
  92%  { transform: translate(32px, 0) scale(1); opacity: 1 }
  100% { transform: translate(32px, 0) scale(1); opacity: 0 }
}
.gks-glide { animation: gks-glide 2.2s ease-in-out infinite alternate; transform-origin: 50% 60%; }
@keyframes gks-glide { from { transform: translateY(0) rotate(-4deg) } to { transform: translateY(-4px) rotate(4deg) } }
.gks-trail { animation: gks-trail 1.4s ease-out infinite; transform-origin: right center; }
@keyframes gks-trail { from { opacity: .55; transform: scaleX(.3) } to { opacity: 0; transform: scaleX(1.15) } }
.gks-lamp { animation: gks-blink 1.4s steps(1, end) infinite; }
@keyframes gks-blink { 0%, 55% { opacity: 1 } 56%, 100% { opacity: .15 } }
.gks-beam { transform-box: view-box; transform-origin: 100px 132px; animation: gks-sweep 4.2s ease-in-out infinite alternate; }
@keyframes gks-sweep { from { transform: rotate(-7deg) } to { transform: rotate(11deg) } }
.gks-win { animation: gks-win 4.5s ease-in-out infinite; }
@keyframes gks-win { 0%, 100% { opacity: .25 } 45% { opacity: .85 } }
.gks-bird { animation: gks-fly 12s linear infinite; }
.gks-bird-2 { animation-duration: 15s; animation-delay: -6s; }
@keyframes gks-fly { from { transform: translate(-40px, 0) } to { transform: translate(${W + 40}px, -24px) } }
.gks-flap { animation: gks-flap .5s ease-in-out infinite alternate; transform-origin: center; }
@keyframes gks-flap { from { transform: scaleY(1) } to { transform: scaleY(-.6) } }
.gks-dots span { display: inline-block; animation: gks-dot 1.2s ease-in-out infinite; }
.gks-dots span:nth-child(2) { animation-delay: .15s } .gks-dots span:nth-child(3) { animation-delay: .3s }
@keyframes gks-dot { 0%, 60%, 100% { opacity: .25 } 30% { opacity: 1 } }
@media (prefers-reduced-motion: reduce) {
  .gks *, .gks-dots span { animation: none !important; }
  .gks-leaving .gks-flight { transform: translate(150px, -28px) scale(.6); opacity: 1; }
  .gks-arriving .gks-flight { transform: translate(32px, 0) scale(1); opacity: 1; }
  .gks-win { opacity: .7 !important; }
}
`

/** The scene on its night panel. `mode` decides which way the plane flies. */
export function SchoolScene({ mode, className = "" }: { mode: SceneMode; className?: string }) {
    return (
        <div className={`w-full overflow-hidden rounded-3xl border border-orange-200/70 bg-[linear-gradient(180deg,#7A2410_0%,#B5401A_55%,#E0682E_100%)] dark:border-orange-900/50 ${className}`}>
            <style>{CSS}</style>
            <svg viewBox={`0 0 ${W} ${H}`} aria-hidden className={`gks gks-${mode} block h-auto w-full text-[#FFF1E4]`}>
                <defs>
                    <radialGradient id="gks-sun-glow">
                        <stop offset="0" stopColor="currentColor" stopOpacity=".35" />
                        <stop offset="1" stopColor="currentColor" stopOpacity="0" />
                    </radialGradient>
                    <linearGradient id="gks-beam-fill" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0" stopColor="currentColor" stopOpacity=".4" />
                        <stop offset="1" stopColor="currentColor" stopOpacity="0" />
                    </linearGradient>
                    <clipPath id="gks-sky"><rect width={W} height="236" /></clipPath>
                </defs>

                {STARS.map(([x, y], i) => (
                    <circle key={i} className="gks-star" cx={x} cy={y} r="1.2" fill="currentColor" style={{ animationDelay: `${i * 0.4}s` }} />
                ))}

                {/* The sun on the horizon, clipped by the ground */}
                <g clipPath="url(#gks-sky)">
                    <g className="gks-sun">
                        <circle cx="452" cy="236" r="90" fill="url(#gks-sun-glow)" />
                        <circle cx="452" cy="236" r="34" fill="currentColor" opacity=".9" />
                        {[222, 214, 206].map((y, i) => <rect key={y} x="412" y={y} width="80" height={2 + i} fill="#5A1A0B" opacity=".55" />)}
                    </g>
                </g>

                <g className="gks-bird" opacity=".7"><path className="gks-flap" d="M0 78 q6 -6 12 0 q6 -6 12 0" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></g>
                <g className="gks-bird gks-bird-2" opacity=".5"><path className="gks-flap" d="M0 108 q5 -5 10 0 q5 -5 10 0" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></g>

                {/* The tower lamp, thrown across the grounds. Under everything on the ground. */}
                <g className="gks-beam"><polygon points="100,132 640,96 640,182" fill="url(#gks-beam-fill)" /></g>

                {/* The school: a long hall with a bell tower over the entrance */}
                <rect x="56" y="178" width="96" height="60" fill="currentColor" opacity=".9" />
                <polygon points="52,178 156,178 104,156" fill="currentColor" opacity=".75" />
                {WINDOWS.map(([x, y], i) => (
                    <rect key={`${x}-${y}`} className="gks-win" x={x} y={y} width="10" height="12" rx="1" fill="#5A1A0B" opacity=".55" style={{ animationDelay: `${i * 0.55}s` }} />
                ))}
                {/* The doorway, and the steps down to the path */}
                <path d="M98 238 v-22 a6 6 0 0 1 12 0 v22 z" fill="#5A1A0B" opacity=".5" />

                {/* The bell tower */}
                <rect x="90" y="120" width="28" height="60" fill="currentColor" opacity=".95" />
                <polygon points="86,120 122,120 104,100" fill="currentColor" />
                {/* The clock face, which is what makes it a school and not a chapel */}
                <circle cx="104" cy="140" r="8" fill="#5A1A0B" opacity=".5" />
                <path d="M104 140 v-5 M104 140 l4 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity=".9" />
                <circle className="gks-lamp" cx="100" cy="132" r="3.2" fill="currentColor" />

                {/* The path from the steps out to the yard */}
                <rect x="120" y="238" width="78" height="4" fill="currentColor" opacity=".55" />
                {[128, 148, 168, 188].map((x) => <rect key={x} x={x} y="242" width="3" height="12" fill="currentColor" opacity=".4" />)}

                <path className="gks-hill gks-h1" d={ridge(240, 5, 120)} fill="currentColor" opacity=".05" />

                {/*
                 * The paper plane. A dart of two folds: the far wing and the near one, meeting at
                 * the crease. It faces the way it flies, so arriving it is mirrored about its own
                 * centre rather than flipped across the canvas.
                 */}
                <g className="gks-flight">
                    <g transform={mode === "arriving" ? "translate(366 0) scale(-1 1)" : undefined}>
                        <g className="gks-glide">
                            <path className="gks-trail" d="M152 206 h-30 M150 214 h-20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                            <path d="M158 194 L208 210 L172 211 Z" fill="currentColor" opacity=".95" />
                            <path d="M158 226 L208 210 L172 211 Z" fill="currentColor" opacity=".55" />
                            <path d="M158 194 L172 211 L158 226" fill="none" stroke="currentColor" strokeWidth="1.2" opacity=".8" />
                        </g>
                    </g>
                </g>

                <path className="gks-hill gks-h2" d={ridge(252, 7, 120)} fill="currentColor" opacity=".06" />
                <path className="gks-hill gks-h3" d={ridge(262, 5, 120)} fill="currentColor" opacity=".07" />
                <path className="gks-hill gks-h3" d={ridge(262, 5, 120).replace(/ V.*$/, "")} fill="none" stroke="currentColor" strokeWidth="1.4" opacity=".45" />
            </svg>
        </div>
    )
}

/**
 * The scene centred on a full-screen overlay, a title with animated dots and a note under it.
 * `children` sit between the scene and the title - the loader puts its mark and wordmark there.
 */
export function SchoolScreen({ mode, title, note, children, fullScreen = true, className = "" }: {
    mode: SceneMode
    title?: string
    note?: string
    children?: ReactNode
    fullScreen?: boolean
    className?: string
}) {
    return (
        <div
            role="status"
            aria-live="polite"
            aria-label={title ?? "Loading Gurukul"}
            className={`${fullScreen ? "fixed inset-0 z-[100]" : "relative w-full py-12"} flex items-center justify-center bg-[#FFF8EF] px-4 dark:bg-[#1F120C] ${className}`}
        >
            <div className="flex w-full max-w-lg flex-col items-center text-center">
                <SchoolScene mode={mode} />
                {children}
                {title && (
                    <p className="mt-8 text-xl font-semibold tracking-tight text-[#5A1A0B] dark:text-[#FFE9D6]">
                        {title}<span className="gks-dots" aria-hidden><span>.</span><span>.</span><span>.</span></span>
                    </p>
                )}
                {note && <p className="mt-1.5 text-sm text-[#8A4A2E] dark:text-[#E8B898]">{note}</p>}
            </div>
        </div>
    )
}
