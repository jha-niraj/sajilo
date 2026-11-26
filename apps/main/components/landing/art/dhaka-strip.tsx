import { useId } from "react"
import { cn } from "@repo/ui/lib/utils"
import { DHAKA_TILES, DhakaPattern } from "./dhaka/pattern"
import { SKY } from "./sky"

/*
 * The Dhaka topi weave as a full-width strip. `sajilo` is the app's own threads: ink stripes, saffron and marigold in
 * the triangles, the sky as the seam, on warm paper. `sky` is the light-blue version for the hero.
 */
export type DhakaTone = "sajilo" | "sky" | "tonal"

export function dhakaPalette(tone: DhakaTone): Record<string, string> {
    if (tone === "tonal") return { bg: "#faf6ee", c1: "#5c5145", c2: "#ebe2d2", c3: "#c9bca8", c4: "#8a7f72" }
    if (tone === "sky") return { bg: SKY.soft, c1: "#2a2118", c2: SKY.fill, c3: "#e6b23f", c4: SKY.text }
    return { bg: "#faf6ee", c1: "#2a2118", c2: "#c8611f", c3: "#e6a83a", c4: SKY.fill }
}

/** A full-width woven strip. `scale` = screen pixels per thread; the height follows the tile. */
export function DhakaStrip({ tone = "sajilo", scale = 2, tile = "slim", className }: { tone?: DhakaTone; scale?: number; tile?: "slim" | "full"; className?: string }) {
    const raw = useId()
    const id = `dhaka-${raw.replace(/[^a-zA-Z0-9_-]/g, "")}`
    const h = DHAKA_TILES[tile].h * scale
    return (
        <svg aria-hidden className={cn("block w-full", className)} height={h} preserveAspectRatio="none">
            <defs>
                <DhakaPattern id={id} palette={dhakaPalette(tone)} scale={scale} tile={tile} />
            </defs>
            <rect width="100%" height={h} fill={`url(#${id})`} />
        </svg>
    )
}
