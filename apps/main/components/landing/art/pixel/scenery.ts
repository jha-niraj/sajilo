import { Grid } from "./grid"

/*
 * Landscape painters for the v3 pixel scenes. Clean-line rules from the research (_art/RESEARCH.md):
 * - every slope is a "perfect" ratio (2:1, 1:1, 1:2), so a ridge steps evenly and never jags,
 * - no random notches or stray pixels; any texture (snow drips, field lips, slabs) is a regular, repeated pattern,
 * - light from the upper right: faces turned right take the lit key.
 */

/** A peak: centre x, top y, and the slope down to the left and to the right. Slopes are 0.5, 1 or 2 only. */
export type Peak = readonly [x: number, y: number, left: 0.5 | 1 | 2, right: 0.5 | 1 | 2]

function topAt(x: number, peaks: readonly Peak[]): number {
    let top = Number.POSITIVE_INFINITY
    for (const [px, py, l, r] of peaks) {
        const d = x < px ? px - x : x - px
        const y = py + Math.floor(d * (x < px ? l : r))
        if (y < top) top = y
    }
    return top
}

/** Which way the ridge faces at x: true when it falls to the right (toward the sun). */
function facesRight(x: number, peaks: readonly Peak[]): boolean {
    let best: Peak | null = null
    let top = Number.POSITIVE_INFINITY
    for (const p of peaks) {
        const d = x < p[0] ? p[0] - x : x - p[0]
        const y = p[1] + Math.floor(d * (x < p[0] ? p[2] : p[3]))
        if (y < top) {
            top = y
            best = p
        }
    }
    return best ? x >= best[0] : true
}

/** Sky in four bands; one checker row where two bands meet (the only dither in a scene). */
export function paintSky(g: Grid, bottom: number): void {
    const keys = ["sky0", "sky1", "sky2", "sky3"] as const
    const band = Math.ceil(bottom / keys.length)
    for (let y = 0; y < bottom; y++) {
        const i = Math.min(keys.length - 1, Math.floor(y / band))
        const edge = y % band === 0 && i > 0
        for (let x = 0; x < g.w; x++) g.set(x, y, (edge && (x + y) % 2 === 0 ? keys[i - 1] : keys[i]) ?? "sky0")
    }
}

/** Regular snow drips: the snowline dips in a repeated 8-column rhythm. */
const DRIP = [0, 1, 2, 1, 0, 0, 1, 0] as const

/**
 * A snowy range. Faces toward the sun take the lit keys. Snow covers everything above `snowline`, with regular drips
 * running down the lit faces a little further than the shaded ones.
 */
export function paintRange(
    g: Grid,
    peaks: readonly Peak[],
    base: number,
    snowline: number,
    keys: { lit: string; shade: string; snow: string; snowShade: string },
): void {
    for (let x = 0; x < g.w; x++) {
        const top = topAt(x, peaks)
        const lit = facesRight(x, peaks)
        const line = snowline + (DRIP[((x % 8) + 8) % 8] ?? 0) + (lit ? 1 : 0)
        for (let y = Math.max(0, top); y < base; y++) {
            const snowy = y < line
            g.set(x, y, snowy ? (lit ? keys.snow : keys.snowShade) : lit ? keys.lit : keys.shade)
        }
    }
}

/** A tidy pine (two sizes), lit on the right. */
export function pine(g: Grid, x: number, y: number, tall: boolean): void {
    const rows = tall ? ["..P..", ".PPQ.", ".PPQ.", "PPPQQ", "PPPQQ", "..T.."] : [".P.", "PPQ", "PPQ", ".T."]
    g.sprite(x, y, rows, { P: "pine", Q: "pineShade", T: "trunk" })
}

/**
 * Rolling hills between `top(x)` and `base`. Pass a smooth, low-frequency `top` (long flat runs, single steps) - that
 * is what keeps the crest clean. A one-pixel lit lip runs along the crest; pines sit on it at a regular spacing.
 */
export function paintHills(g: Grid, top: (x: number) => number, base: number, keys: { lit: string; shade: string; hi?: string }, trees: number[] | null): void {
    for (let x = 0; x < g.w; x++) {
        const t = top(x)
        const lit = top(x + 2) >= top(x - 2)
        for (let y = t; y < base; y++) g.set(x, y, lit ? keys.lit : keys.shade)
        if (keys.hi && lit) g.set(x, t, keys.hi)
    }
    for (const [i, tx] of (trees ?? []).entries()) {
        const tall = i % 3 !== 1
        pine(g, tx, top(tx + 2) - (tall ? 5 : 3), tall)
    }
}

/** Terraced fields: gently curving bands three pixels deep, each with a darker lip. */
export function paintTerraces(g: Grid, from: number, to: number): void {
    for (let x = 0; x < g.w; x++) {
        const off = Math.round(1.5 * Math.sin(x / 19))
        for (let y = from; y < to; y++) {
            const v = y - from + off + 3
            const band = Math.floor(v / 3)
            g.set(x, y, v % 3 === 0 ? "fieldEdge" : band % 2 === 0 ? "field" : "fieldSoft")
        }
    }
}

/** A stone courtyard: slabs in a running bond, each slab with a lit top edge and a shaded joint. */
export function paintCourtyard(g: Grid, from: number, to: number): void {
    for (let y = from; y < to; y++) {
        const r = y - from
        const course = Math.floor(r / 5)
        for (let x = 0; x < g.w; x++) {
            const joint = r % 5 === 4 || (x + (course % 2) * 6) % 12 === 0
            const lit = r % 5 === 0
            g.set(x, y, joint ? "pathShade" : lit ? "pathHi" : "path")
        }
    }
}

/** A cord from (x0, y0) to (x1, y1) with a sag; returns where each prayer flag hangs. */
export function cord(g: Grid, x0: number, y0: number, x1: number, y1: number, sag: number, every: number): { x: number; y: number; key: string }[] {
    const KEYS = ["flagBlue", "flagWhite", "flagRed", "flagGreen", "flagYellow"] as const
    const steps = Math.abs(x1 - x0)
    const dir = x1 > x0 ? 1 : -1
    let prev: number | null = null
    const flags: { x: number; y: number; key: string }[] = []
    for (let i = 0; i <= steps; i++) {
        const t = i / steps
        const x = x0 + dir * i
        const y = Math.round(y0 + (y1 - y0) * t + sag * Math.sin(Math.PI * t))
        const a = prev === null ? y : Math.min(prev, y)
        const b = prev === null ? y : Math.max(prev, y)
        for (let yy = a; yy <= b; yy++) g.set(x, yy, "string")
        prev = y
        if (i >= 2 && i <= steps - 2 && i % every === 0) {
            flags.push({ x: dir > 0 ? x : x - 1, y: y + 1, key: KEYS[flags.length % KEYS.length] ?? "flagBlue" })
        }
    }
    return flags
}

/** A filled disc (sun, glow). */
export function disc(g: Grid, cx: number, cy: number, r: number, key: string): void {
    for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= r * r + r * 0.8) g.set(cx + dx, cy + dy, key)
    }
}
