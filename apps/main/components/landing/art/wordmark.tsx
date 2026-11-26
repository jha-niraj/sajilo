import { useId } from "react"
import { svgId } from "./frame"
import { HERO_VALLEY } from "./valley/scene"
import { ValleyLayers } from "./valley/valley"

/*
 * The footer's big "Sajilo": the word is an SVG <text> used as a clipPath, so the pixel town shows through the
 * letters; a hairline outline holds the shape where the sky is pale. No bubbles inside the letters.
 */

const VB_W = 1200
const VB_H = 380

const WORD = {
    x: VB_W / 2,
    y: 345,
    textAnchor: "middle" as const,
    fontSize: 440,
    fontWeight: 800,
    letterSpacing: -18,
    style: { fontFamily: "var(--font-bricolage), ui-sans-serif, system-ui, sans-serif" },
}

export function ValleyWordmark() {
    const clip = svgId(useId(), "word")
    const { w, h } = HERO_VALLEY.layout
    return (
        <svg viewBox={`0 0 ${VB_W} ${VB_H}`} role="img" aria-label="Sajilo" overflow="visible" className="block h-auto w-full">
            <defs>
                <clipPath id={clip}>
                    <text {...WORD}>Sajilo</text>
                </clipPath>
            </defs>
            <g clipPath={`url(#${clip})`}>
                <svg x={0} y={0} width={VB_W} height={VB_H} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid slice" shapeRendering="crispEdges">
                    <ValleyLayers valley={HERO_VALLEY} variant="day" bubbles={false} />
                </svg>
            </g>
            <text {...WORD} fill="none" stroke="rgba(42,33,24,0.22)" strokeWidth={1.25}>
                Sajilo
            </text>
        </svg>
    )
}
