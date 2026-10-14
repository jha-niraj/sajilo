/*
 * The 404 scene: a paper plane drifting off course at night, hills rolling under it, the school's
 * bell tower sweeping its lamp across the grounds looking for it, a blinking lamp post, twinkling
 * stars and a "?" rising from the plane now and then.
 *
 * The same world as `school-scene.tsx`, at the same hour - that one is the plane arriving or
 * leaving on purpose; this one is the plane that went somewhere nobody meant it to.
 *
 * Pure SVG and CSS keyframes: no script, no request, no animation library. The panel is night in
 * BOTH themes, so its ink is constant too (root CLAUDE.md: a surface that does not change with the
 * theme gets ink that does not either). Everything stops under `prefers-reduced-motion`.
 *
 * Not a client component - there is no state and no handler, so it can render on the server.
 */

const W = 600
const H = 340

/** A ridge across twice the width, so sliding it one period left loops with no seam. */
function ridge(y: number, amp: number, period: number) {
    let d = `M0 ${y} Q${period / 4} ${y - amp} ${period / 2} ${y}`
    for (let x = period; x <= W * 2 + period; x += period / 2) d += ` T${x} ${y}`
    return `${d} V${H} H0 Z`
}

const STARS: [number, number, number][] = [
    [40, 40, 1.4], [92, 118, 1], [168, 30, 1.2], [214, 92, 0.9], [262, 44, 1.5], [318, 120, 1],
    [352, 28, 1.1], [404, 76, 1.3], [436, 24, 0.9], [548, 52, 1.2], [580, 110, 1], [300, 70, 0.8],
    [24, 150, 0.9], [520, 150, 0.8],
]

const CSS = `
.gk4 * { transform-box: fill-box; }
.gk4-star { animation: gk4-twinkle 3.2s ease-in-out infinite; transform-origin: center; }
@keyframes gk4-twinkle { 0%, 100% { opacity: .25; transform: scale(.8) } 50% { opacity: 1; transform: scale(1.15) } }
.gk4-cloud { animation: gk4-cloud 38s linear infinite; }
.gk4-cloud-2 { animation-duration: 52s; animation-delay: -20s; }
@keyframes gk4-cloud { from { transform: translateX(-160px) } to { transform: translateX(${W + 40}px) } }
.gk4-hill { animation: gk4-roll linear infinite; }
.gk4-hill-back { animation-duration: 16s; }
.gk4-hill-mid { animation-duration: 10s; }
.gk4-hill-front { animation-duration: 7s; }
@keyframes gk4-roll { from { transform: translateX(0) } to { transform: translateX(-120px) } }
.gk4-beam { transform-box: view-box; transform-origin: 470px 130px; animation: gk4-sweep 7s ease-in-out infinite alternate; }
@keyframes gk4-sweep { from { transform: rotate(-16deg) } to { transform: rotate(12deg) } }
.gk4-lamp { animation: gk4-lamp 1.8s ease-in-out infinite alternate; transform-origin: center; }
@keyframes gk4-lamp { from { opacity: .7 } to { opacity: 1 } }
.gk4-drift { animation: gk4-drift 13s ease-in-out infinite alternate; }
@keyframes gk4-drift { from { transform: translateX(-34px) } to { transform: translateX(26px) } }
.gk4-glide { animation: gk4-glide 3.4s ease-in-out infinite alternate; transform-origin: 50% 60%; }
@keyframes gk4-glide { 0% { transform: translateY(0) rotate(-6deg) } 100% { transform: translateY(-7px) rotate(6deg) } }
.gk4-ask { animation: gk4-ask 5.5s ease-out infinite; opacity: 0; }
@keyframes gk4-ask { 0%, 55% { opacity: 0; transform: translate(0, 0) } 65% { opacity: .95 } 100% { opacity: 0; transform: translate(10px, -26px) } }
.gk4-post { animation: gk4-glide 2.6s ease-in-out infinite alternate-reverse; transform-origin: 50% 100%; }
.gk4-blink { animation: gk4-blink 1.6s steps(1, end) infinite; }
@keyframes gk4-blink { 0%, 60% { opacity: 1 } 61%, 100% { opacity: .15 } }
@media (prefers-reduced-motion: reduce) { .gk4 * { animation: none !important; } .gk4-ask { opacity: 0; } }
`

export function PlaneAdrift({ className }: { className?: string }) {
    return (
        <div className={className}>
            <style>{CSS}</style>
            <svg
                viewBox={`0 0 ${W} ${H}`}
                role="img"
                aria-label="A paper plane drifting off course at night while the school's bell tower sweeps its lamp across the grounds looking for it"
                className="gk4 block h-auto w-full text-white"
            >
                <defs>
                    <linearGradient id="gk4-beam" x1="1" y1="0" x2="0" y2="0">
                        <stop offset="0" stopColor="currentColor" stopOpacity=".55" />
                        <stop offset=".55" stopColor="currentColor" stopOpacity=".14" />
                        <stop offset="1" stopColor="currentColor" stopOpacity="0" />
                    </linearGradient>
                    <radialGradient id="gk4-glow">
                        <stop offset="0" stopColor="currentColor" stopOpacity=".9" />
                        <stop offset="1" stopColor="currentColor" stopOpacity="0" />
                    </radialGradient>
                    <mask id="gk4-moon">
                        <rect width={W} height={H} fill="white" />
                        <circle cx="130" cy="64" r="22" fill="black" />
                    </mask>
                </defs>

                {/* Sky */}
                {STARS.map(([x, y, r], i) => (
                    <circle key={i} className="gk4-star" cx={x} cy={y} r={r} fill="currentColor" style={{ animationDelay: `${(i * 0.37) % 3.2}s` }} />
                ))}
                <circle cx="118" cy="72" r="22" fill="currentColor" opacity=".92" mask="url(#gk4-moon)" />
                <g opacity=".12" fill="currentColor">
                    <path className="gk4-cloud" d="M0 96 q10 -16 28 -10 q10 -14 28 -4 q18 -2 18 12 z" />
                    <path className="gk4-cloud gk4-cloud-2" d="M0 140 q12 -14 30 -8 q14 -12 30 0 q14 0 14 8 z" />
                </g>

                {/* The searching lamp, under everything on the ground */}
                <g className="gk4-beam">
                    <polygon points="470,130 -40,46 -40,226" fill="url(#gk4-beam)" />
                </g>

                {/* Back and middle hills */}
                <path className="gk4-hill gk4-hill-back" d={ridge(236, 5, 120)} fill="currentColor" opacity=".05" />
                <path className="gk4-hill gk4-hill-mid" d={ridge(252, 7, 120)} fill="currentColor" opacity=".06" />

                {/* The school hall and its bell tower */}
                <rect x="430" y="196" width="112" height="56" fill="currentColor" opacity=".85" />
                <polygon points="426,196 546,196 486,176" fill="currentColor" opacity=".7" />
                <rect x="452" y="146" width="36" height="106" fill="currentColor" opacity=".92" />
                {/* The belfry opening - the arched gap a bell tower actually has. This was two
                    horizontal bands carried over from the lighthouse this scene was ported from,
                    and on a tower with a clock on it they read as a belt rather than as anything. */}
                <path d="M462 214 v-20 a8 8 0 0 1 16 0 v20 z" fill="black" opacity=".5" />
                <polygon points="446,146 494,146 470,122" fill="currentColor" />
                {/* The clock, which is what makes it a school rather than a chapel */}
                <circle cx="470" cy="162" r="8" fill="black" opacity=".5" />
                <path d="M470 162 v-5 M470 162 l4 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity=".9" />
                <circle cx="470" cy="130" r="16" fill="url(#gk4-glow)" className="gk4-lamp" />
                <circle cx="470" cy="130" r="4.5" fill="currentColor" />

                {/* The plane, drifting and tilting, with a "?" now and then */}
                <g className="gk4-drift">
                    <g className="gk4-glide">
                        <path d="M212 206 L282 230 L232 231 Z" fill="currentColor" opacity=".95" />
                        <path d="M212 256 L282 230 L232 231 Z" fill="currentColor" opacity=".55" />
                        <path d="M212 206 L232 231 L212 256" fill="none" stroke="currentColor" strokeWidth="1.3" opacity=".8" />
                        <text className="gk4-ask" x="252" y="200" fill="currentColor" fontSize="18" fontWeight="700" fontFamily="ui-sans-serif, system-ui, sans-serif">?</text>
                    </g>
                </g>

                {/* The lamp post out on the field */}
                <g className="gk4-post">
                    <rect x="366" y="244" width="3" height="22" fill="currentColor" opacity=".7" />
                    <path d="M360 244 h15 l-4 -8 h-7 z" fill="currentColor" opacity=".85" />
                    <circle className="gk4-blink" cx="367.5" cy="238" r="3.2" fill="currentColor" />
                </g>

                {/* The front ridge rolls over the base of everything standing on it */}
                <path className="gk4-hill gk4-hill-front" d={ridge(262, 6, 120)} fill="currentColor" opacity=".07" />
                <path className="gk4-hill gk4-hill-front" d={ridge(262, 6, 120).replace(/ V.*$/, "")} fill="none" stroke="currentColor" strokeWidth="1.5" opacity=".5" />
            </svg>
        </div>
    )
}

export default PlaneAdrift
