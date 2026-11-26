import { useId } from "react"
import { svgId } from "../frame"
import { Grid, type Palette } from "../pixel/grid"

/*
 * Dhaka - the handwoven cloth of Nepal's topi and shawls: horizontal bands of stepped triangles and concentric
 * diamonds. Woven cloth is a grid, so the tile is drawn on the same pixel grid as the pixel art: every diagonal steps.
 *
 * The tile is 24 wide and repeats seamlessly both ways. Five keys: bg (the ground) and c1-c4 (the threads).
 */

export const DHAKA_W = 24

/** Muted palettes. Classic is the cloth's own black, red and white (red softened to terracotta). */
export const DHAKA: Readonly<Record<"classic" | "tonal" | "indigo" | "night", Palette & { label: string }>> = {
    classic: { label: "Classic", bg: "#f3ede4", c1: "#1d1b1a", c2: "#b5603f", c3: "#d89a2c", c4: "#3f4d86" },
    tonal: { label: "Tonal ink", bg: "#f7f5f3", c1: "#141414", c2: "#cfc7bc", c3: "#8b847b", c4: "#3a3a3a" },
    indigo: { label: "Indigo", bg: "#e9ecf5", c1: "#27305e", c2: "#5d6aa8", c3: "#b7bfe6", c4: "#d89a2c" },
    night: { label: "Night", bg: "#18171c", c1: "#f3ede4", c2: "#b5603f", c3: "#d89a2c", c4: "#7381c4" },
}

function triangles(g: Grid, top: number, up: boolean, keys: readonly [string, string]): void {
    for (let r = 0; r < 6; r++) {
        const half = up ? r : 5 - r
        ;[6, 18].forEach((cx, i) => {
            for (let x = cx - half; x <= cx + half; x++) g.set(x, top + r, keys[i] ?? "c2")
        })
    }
}

function diamonds(g: Grid, top: number): void {
    const cy = top + 6
    for (let y = top; y < top + 13; y++) {
        for (let x = 0; x < DHAKA_W; x++) {
            // Two big concentric diamonds, at x 6 and 18 (the x 30 one wraps in from the next tile).
            const big = [6, 18, -6, 30].map((cx) => Math.abs(x - cx) + Math.abs(y - cy))
            const d = Math.min(...big)
            const swap = (big[1] ?? 99) < (big[0] ?? 99)
            if (d <= 6) {
                const ring = d <= 1 ? (swap ? "c3" : "c2") : d === 2 ? "bg" : d <= 4 ? "c1" : d === 5 ? "bg" : swap ? "c2" : "c3"
                g.set(x, y, ring)
                continue
            }
            // Between the diamonds: echoes of their outline, closing to a point on the seams.
            g.set(x, y, d === 8 ? "c4" : d >= 11 ? "c2" : "bg")
        }
    }
}

/** The full tile: stripe, triangles up, stripe, diamonds, stripe, triangles down. 24 x 35. */
function fullTile(): Grid {
    const g = new Grid(DHAKA_W, 35)
    g.rect(0, 0, DHAKA_W, 35, "bg")
    g.rect(0, 0, DHAKA_W, 2, "c1")
    triangles(g, 3, true, ["c2", "c3"])
    g.rect(0, 10, DHAKA_W, 1, "c4")
    diamonds(g, 12)
    g.rect(0, 26, DHAKA_W, 1, "c4")
    triangles(g, 28, false, ["c3", "c2"])
    return g
}

/** A slim border: stripe, triangles, stripe. 24 x 12. */
function slimTile(): Grid {
    const g = new Grid(DHAKA_W, 12)
    g.rect(0, 0, DHAKA_W, 12, "bg")
    g.rect(0, 0, DHAKA_W, 2, "c1")
    triangles(g, 3, true, ["c2", "c3"])
    g.rect(0, 10, DHAKA_W, 2, "c1")
    return g
}

export const DHAKA_TILES = { full: fullTile(), slim: slimTile() } as const

export type DhakaTile = keyof typeof DHAKA_TILES
export type DhakaColourway = keyof typeof DHAKA

/** The raw `<pattern>` for an SVG's `<defs>`; fill a shape with `url(#id)`. `scale` = screen pixels per thread. */
function DhakaPatternDef({ id, palette, scale, tile = "full" }: { id: string; palette: Palette; scale: number; tile?: DhakaTile }) {
    const g = DHAKA_TILES[tile]
    return (
        <pattern id={id} patternUnits="userSpaceOnUse" width={g.w * scale} height={g.h * scale}>
            <g transform={`scale(${scale})`} shapeRendering="crispEdges">
                {g.paths().map(([key, d]) => (
                    <path key={key} d={d} fill={palette[key] ?? "transparent"} />
                ))}
            </g>
        </pattern>
    )
}

type PatternDefProps = { id: string; palette: Palette; scale: number; tile?: DhakaTile }

type FillProps = {
    id?: undefined
    /** One of the four colourways (default classic), or pass a `palette` of your own. */
    colourway?: DhakaColourway
    palette?: Palette
    /** Screen pixels per thread (default 3). */
    scale?: number
    tile?: DhakaTile
    className?: string
    opacity?: number
}

/** A box of any size filled with the weave - a card background, a side strip. Sized by its parent (100% x 100%). */
export function DhakaFill({ colourway = "classic", palette, scale = 3, tile = "full", className, opacity = 1 }: Omit<FillProps, "id">) {
    const id = svgId(useId(), "dhakafill")
    return (
        <svg aria-hidden className={className} width="100%" height="100%" style={{ display: "block", opacity }}>
            <defs>
                <DhakaPatternDef id={id} palette={palette ?? DHAKA[colourway]} scale={scale} tile={tile} />
            </defs>
            <rect width="100%" height="100%" fill={`url(#${id})`} />
        </svg>
    )
}

/**
 * The Dhaka weave. Two uses:
 * - with `id` (and `palette`, `scale`): the raw `<pattern>` for an SVG's `<defs>` - the footer wordmark uses this;
 * - without `id`: a filled box, the same as `DhakaFill` (`colourway`, `scale`, `className`, `opacity`).
 */
export function DhakaPattern(props: PatternDefProps | FillProps) {
    if (props.id !== undefined) return <DhakaPatternDef id={props.id} palette={props.palette} scale={props.scale} tile={props.tile} />
    return (
        <DhakaFill
            colourway={props.colourway}
            palette={props.palette}
            scale={props.scale}
            tile={props.tile}
            className={props.className}
            opacity={props.opacity}
        />
    )
}

/**
 * A full-width band of the weave, for the top of a pricing card or a section divider.
 * `height` in screen pixels picks the tile (slim under 48px) and the thread size to fill it exactly; or pass `scale`.
 */
export function DhakaBand({
    height,
    colourway = "classic",
    palette,
    scale,
    tile,
    className,
}: {
    height?: number
    colourway?: DhakaColourway
    palette?: Palette
    scale?: number
    tile?: DhakaTile
    className?: string
}) {
    const id = svgId(useId(), "dhaka")
    const t: DhakaTile = tile ?? (height !== undefined && height < 48 ? "slim" : "full")
    const tileH = DHAKA_TILES[t].h
    const s = height !== undefined ? height / tileH : (scale ?? 3)
    const h = height ?? tileH * s
    return (
        <svg aria-hidden className={className} width="100%" height={h} style={{ display: "block" }}>
            <defs>
                <DhakaPatternDef id={id} palette={palette ?? DHAKA[colourway]} scale={s} tile={t} />
            </defs>
            <rect width="100%" height={h} fill={`url(#${id})`} />
        </svg>
    )
}
