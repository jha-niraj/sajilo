/**
 * A tiny pixel canvas: a grid of colour KEYS (not colours), so one drawing can be painted with a day or a night
 * palette. `paths()` merges each row's same-key runs into one SVG path per key - a scene of thousands of pixels
 * becomes a handful of `<path>` elements.
 */
export type PixelPaths = readonly (readonly [key: string, d: string])[]
export type Palette = Readonly<Record<string, string>>
export type CharMap = Readonly<Record<string, string>>

export class Grid {
    readonly w: number
    readonly h: number
    private readonly cells: (string | null)[]
    private cached: PixelPaths | null = null

    constructor(w: number, h: number) {
        this.w = w
        this.h = h
        this.cells = new Array<string | null>(w * h).fill(null)
    }

    set(x: number, y: number, key: string | null): void {
        const ix = Math.round(x)
        const iy = Math.round(y)
        if (ix < 0 || iy < 0 || ix >= this.w || iy >= this.h) return
        this.cells[iy * this.w + ix] = key
        this.cached = null
    }

    get(x: number, y: number): string | null {
        if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null
        return this.cells[y * this.w + x] ?? null
    }

    rect(x: number, y: number, w: number, h: number, key: string | null): void {
        for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, key)
    }

    /** Rows of characters; `.` and space are transparent, every other character is looked up in `map`. */
    sprite(x: number, y: number, rows: readonly string[], map: CharMap, flip = false): void {
        rows.forEach((row, r) => {
            for (let c = 0; c < row.length; c++) {
                const ch = row[flip ? row.length - 1 - c : c]
                if (ch === undefined || ch === "." || ch === " ") continue
                const key = map[ch]
                if (key) this.set(x + c, y + r, key)
            }
        })
    }

    paths(): PixelPaths {
        if (this.cached) return this.cached
        const out = new Map<string, string[]>()
        for (let y = 0; y < this.h; y++) {
            let x = 0
            while (x < this.w) {
                const key = this.cells[y * this.w + x]
                if (!key) {
                    x++
                    continue
                }
                let run = 1
                while (x + run < this.w && this.cells[y * this.w + x + run] === key) run++
                const list = out.get(key) ?? []
                list.push(`M${x} ${y}h${run}v1h-${run}z`)
                out.set(key, list)
                x += run
            }
        }
        this.cached = [...out.entries()].map(([key, parts]) => [key, parts.join("")] as const)
        return this.cached
    }
}

/** A grid exactly the size of a sprite. */
export function spriteGrid(rows: readonly string[], map: CharMap, flip = false): Grid {
    const w = rows.reduce((m, r) => Math.max(m, r.length), 0)
    const g = new Grid(w, rows.length)
    g.sprite(0, 0, rows, map, flip)
    return g
}

/** Deterministic integer noise in [0, n). */
export function hash(x: number, seed = 1): number {
    let h = (x * 374761393 + seed * 668265263) | 0
    h = Math.imul(h ^ (h >>> 13), 1274126177)
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}
