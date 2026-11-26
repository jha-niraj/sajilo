import type { ReactNode } from "react"
import type { ArtStyle } from "../frame"
import type { Grid, Palette } from "./grid"

/**
 * Paints a grid. The outer group places it (an SVG `transform` attribute); the inner group carries any animation class,
 * because a CSS transform animation on the same element would replace the placement.
 */
export function Pixels({
    grid,
    palette,
    x = 0,
    y = 0,
    className,
    style,
}: {
    grid: Grid
    palette: Palette
    x?: number
    y?: number
    className?: string
    style?: ArtStyle
}) {
    const paths = grid.paths().map(([key, d]) => <path key={key} d={d} fill={palette[key] ?? "transparent"} />)
    const inner = className || style ? (
        <g className={className} style={style}>
            {paths}
        </g>
    ) : (
        paths
    )
    return x || y ? <g transform={`translate(${x} ${y})`}>{inner}</g> : <g>{inner}</g>
}

const FRAME_CLASS = { flip: ["art-fa", "art-fb"], wave: ["art-wa", "art-wb"], blink: ["art-ka", "art-kb"] } as const

/**
 * Two frames that swap like a sprite sheet. `kind="flip"` alternates evenly; `kind="wave"` holds A and flashes B twice;
 * `kind="blink"` holds A and shows B for a blink at the end of the cycle.
 * A negative delay starts each copy mid-cycle so a row of flags never moves in lockstep.
 */
export function Frames({
    a,
    b,
    palette,
    x,
    y,
    dur = 1.2,
    delay = 0,
    kind = "flip",
}: {
    a: Grid
    b: Grid
    palette: Palette
    x: number
    y: number
    dur?: number
    delay?: number
    kind?: keyof typeof FRAME_CLASS
}) {
    const style: ArtStyle = { "--art-dur": `${dur}s`, "--art-delay": `${-delay}s` }
    const [ca, cb] = FRAME_CLASS[kind]
    return (
        <g transform={`translate(${x} ${y})`}>
            <Pixels grid={a} palette={palette} className={ca} style={style} />
            <Pixels grid={b} palette={palette} className={cb} style={style} />
        </g>
    )
}

/** Common SVG frame for a pixel scene: crisp edges, scales to its box. */
export function PixelSvg({
    w,
    h,
    label,
    className,
    preserve = "xMidYMid slice",
    children,
}: {
    w: number
    h: number
    label: string
    className?: string
    preserve?: string
    children: ReactNode
}) {
    return (
        <svg
            viewBox={`0 0 ${w} ${h}`}
            preserveAspectRatio={preserve}
            shapeRendering="crispEdges"
            role="img"
            aria-label={label}
            className={className}
            style={{ imageRendering: "pixelated" }}
        >
            {children}
        </svg>
    )
}

/**
 * Something that crosses the scene and wraps: drawn twice, one scene-width apart, so the loop has no seam. It moves a
 * whole pixel at a time (`steps`). Pass `b` for a two-frame figure (a walker, a bird).
 */
export function Drift({
    width,
    grid,
    b,
    palette,
    x,
    y,
    dur,
    delay = 0,
    frameDur = 0.5,
}: {
    width: number
    grid: Grid
    b?: Grid
    palette: Palette
    x: number
    y: number
    dur: number
    delay?: number
    frameDur?: number
}) {
    const style: ArtStyle = {
        "--art-dx": `${width}px`,
        "--art-dur": `${dur}s`,
        "--art-delay": `${-delay}s`,
        animationTimingFunction: `steps(${width})`,
    }
    return (
        <g className="art-drift" style={style}>
            {[x, x - width].map((px) =>
                b ? (
                    <Frames key={px} a={grid} b={b} palette={palette} x={px} y={y} dur={frameDur} />
                ) : (
                    <Pixels key={px} grid={grid} palette={palette} x={px} y={y} />
                ),
            )}
        </g>
    )
}
