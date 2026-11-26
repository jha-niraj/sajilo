"use client"

import type { ArtStyle } from "../frame"
import type { Grid, Palette } from "../pixel/grid"
import { Frames, Pixels } from "../pixel/pixels"
import type { Overlay, Scene } from "../scenes"
import { VALLEY_DAY, VALLEY_GOLD } from "../valley/palette"
import { useOnView } from "./on-view"

/*
 * Paints a scene so it can appear row by row: every row is its own group (outline pixels in one, fills in another),
 * each with a delay. When it scrolls into view the outline draws down the frame, the flat colour follows, then
 * whatever moves fades in. Opacity only, stepped - nothing shifts. Reduced motion shows it finished (`art.css`).
 */

const OUTLINE = new Set(["line", "midLine", "wire", "skinLine", "navyLine", "hoodieLine", "tealLine", "greyLine", "woodLine"])
const STEP = 0.022

type Row = { y: number; outline: [string, string][]; fill: [string, string][] }

const cache = new WeakMap<Grid, Row[]>()

function rows(grid: Grid): Row[] {
    const hit = cache.get(grid)
    if (hit) return hit
    const out: Row[] = []
    for (let y = 0; y < grid.h; y++) {
        const byKey = new Map<string, string[]>()
        let x = 0
        while (x < grid.w) {
            const key = grid.get(x, y)
            if (!key) {
                x++
                continue
            }
            let run = 1
            while (x + run < grid.w && grid.get(x + run, y) === key) run++
            const list = byKey.get(key) ?? []
            list.push(`M${x} ${y}h${run}v1h-${run}z`)
            byKey.set(key, list)
            x += run
        }
        const row: Row = { y, outline: [], fill: [] }
        for (const [key, parts] of byKey) (OUTLINE.has(key) ? row.outline : row.fill).push([key, parts.join("")])
        out.push(row)
    }
    cache.set(grid, out)
    return out
}

export function OverlayView({ o, palette }: { o: Overlay; palette: Palette }) {
    switch (o.kind) {
        case "frames":
            return <Frames a={o.pair.a} b={o.pair.b} palette={palette} x={o.x} y={o.y} dur={o.dur} delay={o.delay} kind={o.motion ?? "flip"} />
        case "bubble":
            return (
                <g transform={`translate(${o.x} ${o.y}) scale(0.5)`}>
                    <Pixels grid={o.b.text} palette={palette} />
                </g>
            )
        case "blink":
            return (
                <g transform={`translate(${o.x} ${o.y})${o.half ? " scale(0.5)" : ""}`}>
                    <Pixels grid={o.grid} palette={palette} className="art-blink" style={{ "--art-dur": `${o.dur}s`, "--art-delay": `${-(o.delay ?? 0)}s` }} />
                </g>
            )
        case "layer":
            return <Pixels grid={o.grid} palette={palette} x={o.x} y={o.y} />
    }
}

export const scenePalette = (scene: Scene): Palette => (scene.evening ? VALLEY_GOLD : VALLEY_DAY)

/** A scene that draws itself in when it scrolls into view. */
export function PixelReveal({ scene, className }: { scene: Scene; className?: string }) {
    const [ref, on] = useOnView<SVGSVGElement>()
    const palette = scenePalette(scene)
    const { grid } = scene
    const all = rows(grid)
    const fillStart = grid.h * STEP * 0.55
    const end = fillStart + grid.h * STEP + 0.1
    return (
        <svg
            ref={ref}
            viewBox={`0 0 ${scene.w} ${scene.h}`}
            preserveAspectRatio="xMidYMid slice"
            shapeRendering="crispEdges"
            role="img"
            aria-label={scene.label}
            data-on={on ? "true" : "false"}
            className={className ? `art-reveal ${className}` : "art-reveal"}
            style={{ imageRendering: "pixelated" }}
        >
            {all.map((r) =>
                r.fill.length ? (
                    <g key={`f${r.y}`} className="art-row" style={{ "--d": `${(fillStart + r.y * STEP).toFixed(3)}s` } as ArtStyle}>
                        {r.fill.map(([key, d]) => (
                            <path key={key} d={d} fill={palette[key] ?? "transparent"} />
                        ))}
                    </g>
                ) : null,
            )}
            {all.map((r) =>
                r.outline.length ? (
                    <g key={`o${r.y}`} className="art-row" style={{ "--d": `${(r.y * STEP).toFixed(3)}s` } as ArtStyle}>
                        {r.outline.map(([key, d]) => (
                            <path key={key} d={d} fill={palette[key] ?? "transparent"} />
                        ))}
                    </g>
                ) : null,
            )}
            <g className="art-row" style={{ "--d": `${end.toFixed(2)}s` } as ArtStyle}>
                {scene.overlays.map((o, i) => (
                    <OverlayView key={i} o={o} palette={palette} />
                ))}
            </g>
        </svg>
    )
}
