import { Grid } from "./pixel/grid"
import { cord, paintCourtyard, paintHills, paintRange, paintSky, type Peak } from "./pixel/scenery"
import { type Bubble, bubble, COLLECTOR, COLLECTOR_LEFT, counter, DEVELOPER, ELDER, flag, house, outlined, type Pair, PIGEON, SHOPKEEPER, stallBack, stamp, stupa } from "./valley/kit"

/*
 * Sajilo's pixel scenes, in Boli's P1 v3 kit (same palette, people and outlines). Pure data; `reveal.tsx` paints them
 * outline first, then fills, row by row. Words in the bubbles are Roman Nepali, the way he says them.
 *
 * Story (96 x 60): 01 the walk at four in the evening, 02 a hundred at every counter, 03 the night the bag does not match,
 * 04 he just says it, 05 the day closes itself.
 * Who it's for (64 x 48): a collector on his round, a recharge pasal, milk collection, a small lender.
 */

export type Overlay =
    | { kind: "frames"; pair: Pair; x: number; y: number; dur: number; motion?: "flip" | "wave" | "blink"; delay?: number }
    | { kind: "bubble"; b: Bubble; x: number; y: number }
    | { kind: "blink"; grid: Grid; x: number; y: number; dur: number; delay?: number; half?: boolean }
    | { kind: "layer"; grid: Grid; x: number; y: number }

export type Scene = { w: number; h: number; grid: Grid; overlays: readonly Overlay[]; label: string; evening?: boolean }

function feetY(pair: Pair, base: number): number {
    return base - pair.a.h + 2
}

/** Sky, two ranges, hills, then a stone courtyard from `court` down. */
function outdoors(g: Grid, court: number, peaks: readonly Peak[]): void {
    paintSky(g, court)
    const back: Peak[] = peaks.map(([x, y, l, r]) => [x + 11, y - 5, l, r] as const)
    paintRange(g, back, court - 6, court - 18, { lit: "back", shade: "back", snow: "backSnow", snowShade: "backSnow" })
    paintRange(g, peaks, court - 4, court - 15, { lit: "far", shade: "farShade", snow: "snow", snowShade: "snowShade" })
    paintHills(g, (x) => court - 8 + Math.round(1.5 * Math.sin(x / 11 + 1)), court + 1, { lit: "hill", shade: "hillShade", hi: "hillHi" }, null)
    paintCourtyard(g, court, g.h)
}

function room(g: Grid): void {
    g.rect(0, 0, g.w, g.h, "wall")
    for (let x = 0; x < g.w; x += 8) g.rect(x, 0, 1, g.h, "wallShade")
}

function planks(g: Grid, y: number): void {
    for (let r = y; r < g.h; r++) {
        for (let x = 0; x < g.w; x++) g.set(x, r, r === y ? "woodHi" : (x + (r - y) * 5) % 14 === 0 ? "woodShade" : "wood")
    }
}

function flags(g: Grid, x0: number, y0: number, x1: number, y1: number): { x: number; y: number; pair: Pair }[] {
    return cord(g, x0, y0, x1, y1, 3, 4).map((p) => ({ x: p.x, y: p.y + 1, pair: flag(p.key) }))
}

/** A phone held up, screen lit. */
function phone(): Grid {
    const g = new Grid(4, 6)
    g.rect(0, 0, 4, 6, "phone")
    g.rect(1, 1, 2, 3, "phoneScreen")
    return outlined(g, "line")
}

/** A phone lying on the table, screen up, with a tick. */
function phoneFlat(): Grid {
    const g = new Grid(9, 5)
    g.rect(0, 0, 9, 5, "phone")
    g.rect(1, 1, 7, 3, "phoneScreen")
    g.set(3, 2, "led")
    g.set(4, 3, "led")
    g.set(5, 2, "led")
    g.set(6, 1, "led")
    return outlined(g, "line")
}

/** The open ledger: two pages of handwritten lines. */
function ledgerOpen(w = 18, h = 9, messy = false): Grid {
    const g = new Grid(w, h)
    g.rect(0, 0, w, h, "page")
    g.rect(Math.floor(w / 2), 0, 1, h, "dauraShade")
    for (let r = 1; r < h - 1; r += 2) {
        const len = messy ? 3 + ((r * 5) % 5) : 6
        g.rect(1, r, len, 1, "line")
        g.rect(Math.floor(w / 2) + 2, r, messy ? 2 + ((r * 3) % 5) : 5, 1, messy && r === 5 ? "flagRed" : "line")
    }
    return outlined(g, "line")
}

function coins(n: number): Grid {
    const g = new Grid(n * 3 + 1, 3)
    for (let i = 0; i < n; i++) {
        g.rect(i * 3, 1, 3, 2, "goldShade")
        g.rect(i * 3, 0, 3, 1, "gold")
    }
    return g
}

function notes(): Grid {
    const g = new Grid(10, 5)
    g.rect(0, 1, 9, 4, "leafHi")
    g.rect(1, 0, 9, 4, "leaf")
    g.rect(4, 1, 3, 2, "leafHi")
    return outlined(g, "line")
}

/** A clay lamp (diyo) with a flame that flickers. */
function diyo(): { base: Grid; flame: Grid } {
    const base = new Grid(6, 3)
    base.rect(0, 0, 6, 1, "brick")
    base.rect(1, 1, 4, 2, "brickShade")
    const flame = new Grid(2, 3)
    flame.set(0, 0, "sun")
    flame.rect(0, 1, 2, 2, "gold")
    return { base: outlined(base, "line"), flame }
}

function table(w: number): Grid {
    const g = new Grid(w, 12)
    g.rect(0, 0, w, 2, "woodHi")
    g.rect(0, 2, w, 1, "woodShade")
    g.rect(2, 3, 2, 9, "wood")
    g.rect(w - 4, 3, 2, 9, "wood")
    return outlined(g, "line")
}

function windowNight(w: number, h: number): Grid {
    const g = new Grid(w, h)
    g.rect(0, 0, w, h, "wood")
    g.rect(1, 1, w - 2, h - 2, "screen")
    for (const [x, y] of [
        [3, 3],
        [9, 2],
        [6, 6],
        [12, 5],
    ] as const)
        if (x < w - 1 && y < h - 1) g.set(x, y, "page")
    g.rect(Math.floor(w / 2), 1, 1, h - 2, "wood")
    return outlined(g, "line")
}

/** A steel milk can. */
function milkCan(): Grid {
    const g = new Grid(7, 10)
    g.rect(2, 0, 3, 1, "greyHi")
    g.rect(1, 1, 5, 2, "grey")
    g.rect(0, 3, 7, 7, "greyHi")
    g.rect(0, 3, 2, 7, "grey")
    g.rect(0, 6, 7, 1, "grey")
    return outlined(g, "line")
}

/* ---------------------------------------------------------------- story -------------------------------------------------------------- */

const W = 96
const H = 60

/** 01 - Four in the evening: he sets out between the houses, bag across him, ledger in hand. */
function walk(): Scene {
    const g = new Grid(W, H)
    outdoors(g, 44, [
        [16, 16, 1, 1],
        [50, 10, 1, 1],
        [84, 14, 1, 1],
    ])
    const left = house(20, 15)
    stamp(g, left.grid, 2, 44 - left.grid.h + 1)
    const right = house(22, 17)
    stamp(g, right.grid, 72, 44 - right.grid.h + 1)
    const fl = flags(g, 22, 30, 72, 28)
    return {
        w: W,
        h: H,
        grid: g,
        evening: true,
        label: "Pixel illustration: late afternoon in a Nepali town, a man in a Dhaka topi with a cloth bag and a red ledger setting out between brick houses under prayer flags",
        overlays: [
            ...fl.map((f, i) => ({ kind: "frames" as const, pair: f.pair, x: f.x, y: f.y, dur: 1.1 + (i % 3) * 0.15, delay: i * 0.17 })),
            { kind: "frames", pair: COLLECTOR, x: 40, y: feetY(COLLECTOR, 54), dur: 3.8, motion: "blink" },
            { kind: "frames", pair: PIGEON, x: 66, y: 52, dur: 1.5 },
            { kind: "bubble", b: bubble(["beluka", "4 baje"], { side: "bottom", at: 10 }), x: 44, y: 6 },
        ],
    }
}

/** 02 - At the counter: the shopkeeper hands over a hundred, he writes it in the ledger and in her passbook. */
function counterScene(): Scene {
    const g = new Grid(W, H)
    outdoors(g, 46, [
        [12, 14, 1, 1],
        [46, 9, 1, 1],
        [80, 13, 1, 1],
    ])
    const back = stallBack()
    const sx = 4
    const sy = H - back.h + 2
    stamp(g, back, sx, sy)
    const front = counter("pasal")
    return {
        w: W,
        h: H,
        grid: g,
        label: "Pixel illustration: the shopkeeper at her pasal hands over a hundred rupees while the collector writes it down",
        overlays: [
            { kind: "frames", pair: SHOPKEEPER, x: sx + 11, y: sy + 6, dur: 4.2, motion: "wave" },
            { kind: "layer", grid: front, x: sx, y: H - front.h + 2 },
            { kind: "layer", grid: notes(), x: sx + 22, y: H - front.h - 3 },
            { kind: "frames", pair: COLLECTOR_LEFT, x: 50, y: feetY(COLLECTOR_LEFT, 57), dur: 3.4, motion: "blink" },
            { kind: "bubble", b: bubble(["aaja 100"], { side: "bottom", at: 8 }), x: 8, y: 6 },
            { kind: "bubble", b: bubble(["lekhe!"], { side: "bottom", at: 8 }), x: 52, y: 10 },
        ],
    }
}

/** 03 - Night: the lamp, the open ledger, the coins and notes that do not add up. */
function night(): Scene {
    const g = new Grid(W, H)
    room(g)
    planks(g, 50)
    stamp(g, windowNight(18, 14), 8, 8)
    const lamp = diyo()
    return {
        w: W,
        h: H,
        grid: g,
        evening: true,
        label: "Pixel illustration: late at night by an oil lamp, the collector looks over his open ledger, coins and notes that do not match",
        overlays: [
            { kind: "frames", pair: COLLECTOR, x: 62, y: 18, dur: 2.6, motion: "blink" },
            { kind: "layer", grid: table(58), x: 28, y: 40 },
            { kind: "layer", grid: lamp.base, x: 31, y: 38 },
            { kind: "blink", grid: lamp.flame, x: 34, y: 35, dur: 0.8 },
            { kind: "layer", grid: ledgerOpen(20, 9, true), x: 39, y: 32 },
            { kind: "layer", grid: coins(3), x: 76, y: 39 },
            { kind: "layer", grid: notes(), x: 61, y: 36 },
            { kind: "bubble", b: bubble(["200 kata", "gayo?"], { side: "bottom", at: 22 }), x: 52, y: 2 },
        ],
    }
}

/** 04 - He just says it: phone up, name and amount; Sajilo says it back and waits for his haan. */
function says(): Scene {
    const g = new Grid(W, H)
    outdoors(g, 46, [
        [18, 12, 1, 1],
        [54, 8, 1, 1],
        [88, 13, 1, 1],
    ])
    const left = house(18, 14)
    stamp(g, left.grid, 0, 46 - left.grid.h + 1)
    return {
        w: W,
        h: H,
        grid: g,
        label: "Pixel illustration: the collector holds up his phone and says a name and an amount; the phone answers and waits for his yes",
        overlays: [
            { kind: "frames", pair: COLLECTOR, x: 30, y: feetY(COLLECTOR, 57), dur: 3.2, motion: "blink" },
            { kind: "layer", grid: phone(), x: 43, y: 40 },
            { kind: "bubble", b: bubble(["Ram Bahadur,", "500"], { side: "bottom", at: 10 }), x: 22, y: 6 },
            { kind: "bubble", b: bubble(["500, thik?", "haan?"], { side: "left", at: 8 }), x: 50, y: 22 },
        ],
    }
}

/** 05 - Evening: the stupa, the day closed on the phone, the bag matches. */
function closes(): Scene {
    const g = new Grid(W, H)
    outdoors(g, 46, [
        [14, 15, 1, 1],
        [48, 10, 1, 1],
        [82, 14, 1, 1],
    ])
    const s = stupa()
    const sy = 46 - s.grid.h + 1
    const fl = flags(g, s.finial.x + 57, s.finial.y + sy + 1, 95, 36)
    stamp(g, s.grid, 58, sy)
    return {
        w: W,
        h: H,
        grid: g,
        evening: true,
        label: "Pixel illustration: evening by the stupa, the collector smiles at his phone - the day is closed and the cash matches",
        overlays: [
            ...fl.map((f, i) => ({ kind: "frames" as const, pair: f.pair, x: f.x, y: f.y, dur: 1.2 + (i % 3) * 0.15, delay: i * 0.2 })),
            { kind: "frames", pair: COLLECTOR, x: 18, y: feetY(COLLECTOR, 57), dur: 3.6, motion: "blink" },
            { kind: "layer", grid: phone(), x: 31, y: 40 },
            { kind: "bubble", b: bubble(["hisab", "milyo!"], { side: "bottom", at: 10 }), x: 10, y: 8 },
            { kind: "frames", pair: PIGEON, x: 44, y: 52, dur: 1.6 },
        ],
    }
}

export const STORY_SCENES = { walk: walk(), counter: counterScene(), night: night(), says: says(), closes: closes() } as const
export type StorySceneId = keyof typeof STORY_SCENES

/* ---------------------------------------------------------------- who ---------------------------------------------------------------- */

const VW = 64
const VH = 48

function whoCollector(): Scene {
    const g = new Grid(VW, VH)
    outdoors(g, 38, [
        [10, 12, 1, 1],
        [40, 8, 1, 1],
        [62, 12, 1, 1],
    ])
    const h = house(18, 14)
    stamp(g, h.grid, 42, 38 - h.grid.h + 1)
    return {
        w: VW,
        h: VH,
        grid: g,
        label: "Pixel portrait: a daily savings collector on his round with his bag and ledger",
        overlays: [
            { kind: "frames", pair: COLLECTOR, x: 20, y: feetY(COLLECTOR, 46), dur: 3.6, motion: "blink" },
            { kind: "bubble", b: bubble(["paanch saya"], { side: "bottom", at: 8 }), x: 6, y: 2 },
        ],
    }
}

function whoRecharge(): Scene {
    const g = new Grid(VW, VH)
    outdoors(g, 40, [
        [8, 13, 1, 1],
        [38, 9, 1, 1],
        [62, 12, 1, 1],
    ])
    const back = stallBack()
    const sx = 2
    const sy = VH - back.h + 2
    stamp(g, back, sx, sy)
    const front = counter("load")
    return {
        w: VW,
        h: VH,
        grid: g,
        label: "Pixel portrait: a shopkeeper selling mobile recharge at her pasal, phone in hand",
        overlays: [
            { kind: "frames", pair: SHOPKEEPER, x: sx + 11, y: sy + 6, dur: 4.6, motion: "blink" },
            { kind: "layer", grid: front, x: sx, y: VH - front.h + 2 },
            { kind: "layer", grid: phone(), x: sx + 21, y: sy + 15 },
            { kind: "bubble", b: bubble(["NTC 100", "udharo"], { side: "left", at: 8 }), x: 36, y: 10 },
        ],
    }
}

function whoMilk(): Scene {
    const g = new Grid(VW, VH)
    outdoors(g, 38, [
        [12, 12, 1, 1],
        [42, 9, 1, 1],
        [60, 13, 1, 1],
    ])
    return {
        w: VW,
        h: VH,
        grid: g,
        label: "Pixel portrait: an elder at a milk collection point with steel cans",
        overlays: [
            { kind: "frames", pair: ELDER, x: 14, y: feetY(ELDER, 46), dur: 3.8, motion: "blink" },
            { kind: "layer", grid: milkCan(), x: 34, y: 36 },
            { kind: "layer", grid: milkCan(), x: 43, y: 37 },
            { kind: "layer", grid: milkCan(), x: 52, y: 36 },
            { kind: "bubble", b: bubble(["5 litre"], { side: "bottom", at: 8 }), x: 30, y: 6 },
        ],
    }
}

function whoLender(): Scene {
    const g = new Grid(VW, VH)
    room(g)
    planks(g, 40)
    stamp(g, windowNight(14, 12), 4, 6)
    return {
        w: VW,
        h: VH,
        grid: g,
        label: "Pixel portrait: a small lender at a table with a ledger, counting interest",
        overlays: [
            { kind: "frames", pair: SHOPKEEPER, x: 36, y: 17, dur: 3.4, motion: "blink" },
            { kind: "layer", grid: table(40), x: 14, y: 32 },
            { kind: "layer", grid: ledgerOpen(16, 7), x: 18, y: 26 },
            { kind: "layer", grid: phoneFlat(), x: 38, y: 29 },
            { kind: "bubble", b: bubble(["byaj kati?"], { side: "bottom", at: 8 }), x: 2, y: 2 },
        ],
    }
}

export const WHO_SCENES = { collector: whoCollector(), recharge: whoRecharge(), milk: whoMilk(), lender: whoLender() } as const
export type WhoSceneId = keyof typeof WHO_SCENES

/* -------------------------------------------------------------- about ---------------------------------------------------------------- */

/** About: the son at a laptop at night, the father's ledger beside it. */
function aboutBuild(): Scene {
    const g = new Grid(W, H)
    room(g)
    planks(g, 50)
    stamp(g, windowNight(18, 14), 70, 8)
    const lamp = diyo()
    return {
        w: W,
        h: H,
        grid: g,
        evening: true,
        label: "Pixel illustration: at night the son writes code on a laptop, his father's red ledger open beside it",
        overlays: [
            { kind: "layer", grid: table(64), x: 14, y: 40 },
            { kind: "frames", pair: DEVELOPER, x: 20, y: 23, dur: 0.6 },
            { kind: "layer", grid: ledgerOpen(18, 8), x: 44, y: 33 },
            { kind: "layer", grid: lamp.base, x: 68, y: 38 },
            { kind: "blink", grid: lamp.flame, x: 71, y: 35, dur: 0.9 },
        ],
    }
}

export const ABOUT_SCENES = { build: aboutBuild() } as const
