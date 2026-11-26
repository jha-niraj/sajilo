import { Grid } from "../pixel/grid"
import { cord, disc, paintCourtyard, paintHills, paintRange, paintSky, paintTerraces, type Peak } from "../pixel/scenery"
import { type Bubble, bubble, counter, COLLECTOR, DEVELOPER, flag, house, type Pair, pagoda, PIGEON, SHOPKEEPER, stallBack, stamp, STUDENT, stupa, type Tail } from "./kit"

/*
 * P1 v3 - the valley, with the people and the words made properly clear. 160 pixels across (8 screen pixels each at
 * 1280px), people about 25 pixels tall with real faces, three depth layers held apart by value (pale cool ranges,
 * mid-value hills and buildings in a soft outline, a saturated foreground in coloured outlines) and every ridge on a
 * perfect slope. One builder, two layouts: the wide hero and a portrait crop (phone, and the auth panel).
 */

type At = { x: number; base: number }
type Say = { lines: readonly string[]; x: number; y: number; tail: Tail }

export type ValleyLayout = {
    w: number
    h: number
    sky: number
    back: { peaks: readonly Peak[]; base: number; snow: number }
    far: { peaks: readonly Peak[]; base: number; snow: number }
    hills: { top: number; base: number; trees: number[] }
    terraces: readonly [from: number, to: number]
    court: number
    houses: readonly { x: number; w: number; h: number }[]
    stupa: At
    poles: readonly [number, number]
    pagoda: At
    sun: { x: number; y: number }
    clouds: readonly { kind: "a" | "b" | "c"; x: number; y: number; dur: number; delay: number }[]
    birds: { x: number; y: number }
    stall: At
    student: At
    developer: At
    elder: At
    pigeons: readonly { x: number; y: number }[]
    say: { student: Say; developer: Say; shopkeeper: Say; elder: Say }
    /** Bubbles overlap in this layout: only the current speaker's shows, and only the first one when motion is off. */
    oneBubble?: boolean
}

/** Who speaks, in turn. */
export const SPEAKERS = ["student", "developer", "shopkeeper", "elder"] as const
export type Speaker = (typeof SPEAKERS)[number]

export const SAY = {
    student: ["NTC 100", "load diu"],
    developer: ["hisab milyo"],
    shopkeeper: ["aaja ko", "500 liyo"],
    elder: ["Sita, 200"],
} as const

export const HERO_LAYOUT: ValleyLayout = {
    w: 160,
    h: 84,
    sky: 54,
    back: {
        peaks: [
            [14, 17, 1, 1],
            [50, 12, 1, 1],
            [96, 14, 1, 1],
            [138, 11, 1, 1],
        ],
        base: 52,
        snow: 22,
    },
    far: {
        peaks: [
            [4, 28, 1, 1],
            [30, 21, 1, 1],
            [58, 25, 1, 1],
            [86, 18, 1, 1],
            [114, 24, 1, 1],
            [140, 19, 1, 1],
            [164, 25, 1, 1],
        ],
        base: 54,
        snow: 28,
    },
    hills: { top: 46, base: 58, trees: [4, 12, 40, 48, 104, 112, 126, 134] },
    terraces: [56, 63],
    court: 63,
    houses: [
        { x: 2, w: 15, h: 15 },
        { x: 20, w: 11, h: 12 },
    ],
    stupa: { x: 80, base: 63 },
    poles: [58, 102],
    pagoda: { x: 150, base: 63 },
    sun: { x: 128, y: 12 },
    clouds: [
        { kind: "a", x: 10, y: 6, dur: 140, delay: 0 },
        { kind: "b", x: 70, y: 16, dur: 110, delay: 30 },
        { kind: "c", x: 104, y: 3, dur: 170, delay: 70 },
    ],
    birds: { x: 40, y: 22 },
    stall: { x: 118, base: 82 },
    student: { x: 7, base: 82 },
    developer: { x: 27, base: 82 },
    elder: { x: 98, base: 82 },
    pigeons: [
        { x: 56, y: 74 },
        { x: 66, y: 77 },
        { x: 84, y: 73 },
    ],
    say: {
        student: { lines: SAY.student, x: 2, y: 42, tail: { side: "bottom", at: 20 } },
        developer: { lines: SAY.developer, x: 39, y: 48, tail: { side: "bottom", at: 2 } },
        shopkeeper: { lines: SAY.shopkeeper, x: 120, y: 28, tail: { side: "bottom", at: 26 } },
        elder: { lines: SAY.elder, x: 99, y: 45, tail: { side: "bottom", at: 12 } },
    },
}

/**
 * Banner (240 x 78): the landing hero. The same cast spread over a wider, shorter strip so the headline keeps clear
 * sky above it on a wide screen instead of sitting over the mountains (owner check, 2026-11-24).
 */
export const BANNER_LAYOUT: ValleyLayout = {
    w: 240,
    h: 78,
    sky: 48,
    back: {
        peaks: [
            [12, 13, 1, 1],
            [52, 10, 1, 1],
            [96, 10, 1, 1],
            [140, 9, 1, 1],
            [186, 11, 1, 1],
            [228, 10, 1, 1],
        ],
        base: 46,
        snow: 16,
    },
    far: {
        peaks: [
            [2, 22, 1, 1],
            [28, 15, 1, 1],
            [58, 19, 1, 1],
            [88, 12, 1, 1],
            [118, 18, 1, 1],
            [150, 13, 1, 1],
            [180, 19, 1, 1],
            [210, 14, 1, 1],
            [244, 20, 1, 1],
        ],
        base: 48,
        snow: 22,
    },
    hills: { top: 40, base: 52, trees: [4, 12, 52, 60, 70, 150, 160, 172, 196, 204, 232] },
    terraces: [50, 57],
    court: 57,
    houses: [
        { x: 4, w: 15, h: 15 },
        { x: 22, w: 11, h: 12 },
        { x: 36, w: 13, h: 13 },
    ],
    stupa: { x: 120, base: 57 },
    poles: [98, 142],
    pagoda: { x: 228, base: 57 },
    sun: { x: 192, y: 19 },
    clouds: [
        { kind: "a", x: 14, y: 10, dur: 160, delay: 0 },
        { kind: "b", x: 90, y: 15, dur: 120, delay: 30 },
        { kind: "c", x: 150, y: 9, dur: 190, delay: 70 },
    ],
    birds: { x: 66, y: 16 },
    stall: { x: 182, base: 76 },
    student: { x: 30, base: 76 },
    developer: { x: 54, base: 76 },
    elder: { x: 152, base: 76 },
    pigeons: [
        { x: 92, y: 68 },
        { x: 104, y: 71 },
        { x: 128, y: 67 },
    ],
    say: {
        student: { lines: SAY.student, x: 18, y: 36, tail: { side: "bottom", at: 20 } },
        developer: { lines: SAY.developer, x: 66, y: 42, tail: { side: "bottom", at: 2 } },
        shopkeeper: { lines: SAY.shopkeeper, x: 184, y: 22, tail: { side: "bottom", at: 26 } },
        elder: { lines: SAY.elder, x: 153, y: 39, tail: { side: "bottom", at: 12 } },
    },
}

/** Portrait (4:5): the phone crop and the auth right panel. The sky keeps its top third clear for one line of copy. */
export const PORTRAIT_LAYOUT: ValleyLayout = {
    w: 96,
    h: 120,
    sky: 84,
    back: {
        peaks: [
            [12, 46, 1, 1],
            [48, 41, 1, 1],
            [84, 44, 1, 1],
        ],
        base: 78,
        snow: 50,
    },
    far: {
        peaks: [
            [0, 54, 1, 1],
            [26, 48, 1, 1],
            [56, 52, 1, 1],
            [80, 47, 1, 1],
            [100, 53, 1, 1],
        ],
        base: 80,
        snow: 55,
    },
    hills: { top: 72, base: 84, trees: [2, 10, 60, 68, 88] },
    terraces: [80, 86],
    court: 86,
    houses: [
        { x: 1, w: 13, h: 14 },
        { x: 16, w: 9, h: 11 },
    ],
    stupa: { x: 46, base: 86 },
    poles: [28, 64],
    pagoda: { x: 86, base: 86 },
    sun: { x: 72, y: 30 },
    clouds: [
        { kind: "b", x: 6, y: 26, dur: 90, delay: 0 },
        { kind: "c", x: 50, y: 36, dur: 120, delay: 40 },
    ],
    birds: { x: 20, y: 44 },
    stall: { x: 58, base: 100 },
    student: { x: 3, base: 118 },
    developer: { x: 26, base: 118 },
    elder: { x: 41, base: 100 },
    pigeons: [
        { x: 62, y: 108 },
        { x: 78, y: 112 },
    ],
    say: {
        student: { lines: SAY.student, x: 1, y: 78, tail: { side: "bottom", at: 12 } },
        developer: { lines: SAY.developer, x: 20, y: 84, tail: { side: "bottom", at: 30 } },
        shopkeeper: { lines: SAY.shopkeeper, x: 58, y: 49, tail: { side: "bottom", at: 26 } },
        elder: { lines: SAY.elder, x: 39, y: 65, tail: { side: "bottom", at: 12 } },
    },
    oneBubble: true,
}

/** Where a sprite goes so its feet (not its outline) stand on `base`. */
function feet(sprite: Grid, at: At): { x: number; y: number } {
    return { x: at.x, y: at.base - sprite.h + 2 }
}

export type Motion = "flip" | "wave" | "blink"
export type Placed = { pair: Pair; x: number; y: number; dur: number; kind: Motion }

export type Valley = {
    layout: ValleyLayout
    sky: Grid
    sun: Grid
    glow: Grid
    sunLow: Grid
    glowLow: Grid
    land: Grid
    stallBack: { grid: Grid; x: number; y: number }
    counter: { grid: Grid; x: number; y: number }
    chimney: { x: number; y: number }
    flags: { x: number; y: number; pair: Pair }[]
    people: Record<Speaker, Placed>
    pigeons: { pair: Pair; x: number; y: number }[]
    bubbles: Record<Speaker, { b: Bubble; x: number; y: number }>
}

export function buildValley(L: ValleyLayout): Valley {
    const sky = new Grid(L.w, L.h)
    paintSky(sky, L.sky)

    const sun = new Grid(L.w, L.h)
    disc(sun, L.sun.x, L.sun.y, 5, "sun")
    const glow = new Grid(L.w, L.h)
    disc(glow, L.sun.x, L.sun.y, 8, "sunGlow")
    // Golden hour: the same sun, lower and bigger, just above the snow line.
    const lowY = L.sun.y + 7
    const sunLow = new Grid(L.w, L.h)
    disc(sunLow, L.sun.x - 6, lowY, 6, "sun")
    const glowLow = new Grid(L.w, L.h)
    disc(glowLow, L.sun.x - 6, lowY, 11, "sunGlow")

    const land = new Grid(L.w, L.h)
    paintRange(land, L.back.peaks, L.back.base, L.back.snow, { lit: "back", shade: "back", snow: "backSnow", snowShade: "backSnow" })
    paintRange(land, L.far.peaks, L.far.base, L.far.snow, { lit: "far", shade: "farShade", snow: "snow", snowShade: "snowShade" })
    const t = L.hills.top
    paintHills(land, (x) => t + Math.round(2 * Math.sin(x / 23 + 1)), L.hills.base, { lit: "hill", shade: "hillShade", hi: "hillHi" }, null)
    paintHills(land, (x) => t + 5 + Math.round(1.5 * Math.sin(x / 15)), L.hills.base, { lit: "hillShade", shade: "hillShade" }, L.hills.trees)
    paintTerraces(land, L.terraces[0], L.terraces[1])
    paintCourtyard(land, L.court, L.h)

    // Mid ground: houses, the stupa with its flags, the pagoda.
    let chimney = { x: 0, y: 0 }
    L.houses.forEach((hs, i) => {
        const hg = house(hs.w, hs.h)
        const y = L.court - hg.grid.h + 2
        stamp(land, hg.grid, hs.x - 1, y)
        if (i === 0) chimney = { x: hs.x - 1 + hg.chimney.x, y: y + hg.chimney.y }
    })
    const pg = pagoda()
    stamp(land, pg.grid, L.pagoda.x - pg.cx, L.pagoda.base - pg.grid.h + 2)
    const st = stupa()
    const sx = L.stupa.x - st.cx
    const sy = L.stupa.base - st.grid.h + 2
    const fin = { x: sx + st.finial.x, y: sy + st.finial.y }
    const poleTop = L.stupa.base - 12
    const flags = [...cord(land, fin.x, fin.y + 1, L.poles[0], poleTop, 4, 3), ...cord(land, fin.x, fin.y + 1, L.poles[1], poleTop, 4, 3)]
    for (const px of L.poles) {
        land.rect(px, poleTop, 1, L.stupa.base - poleTop + 1, "woodShade")
        land.set(px, poleTop - 1, "gold")
    }
    stamp(land, st.grid, sx, sy)

    // Foreground.
    const back = stallBack()
    const front = counter("pasal")
    const stall = { grid: back, x: L.stall.x, y: L.stall.base - back.h + 2 }
    const counterAt = { grid: front, x: L.stall.x, y: L.stall.base - front.h + 2 }

    const at = (pair: Pair, a: At) => feet(pair.a, a)
    const people: Record<Speaker, Placed> = {
        student: { pair: STUDENT, ...at(STUDENT, L.student), dur: 4.2, kind: "blink" },
        developer: { pair: DEVELOPER, ...at(DEVELOPER, L.developer), dur: 0.5, kind: "flip" },
        shopkeeper: { pair: SHOPKEEPER, x: L.stall.x + 11, y: stall.y + 6, dur: 4.5, kind: "wave" },
        elder: { pair: COLLECTOR, ...at(COLLECTOR, L.elder), dur: 4, kind: "blink" },
    }

    const bubbles = Object.fromEntries(
        SPEAKERS.map((s) => {
            const say = L.say[s]
            return [s, { b: bubble(say.lines, say.tail), x: say.x, y: say.y }]
        }),
    ) as Record<Speaker, { b: Bubble; x: number; y: number }>

    return {
        layout: L,
        sky,
        sun,
        glow,
        sunLow,
        glowLow,
        land,
        stallBack: stall,
        counter: counterAt,
        chimney,
        flags: flags.map((f) => ({ x: f.x, y: f.y, pair: flag(f.key) })),
        people,
        pigeons: L.pigeons.map((p) => ({ pair: PIGEON, ...p })),
        bubbles,
    }
}

export const HERO_VALLEY = buildValley(HERO_LAYOUT)
export const PORTRAIT_VALLEY = buildValley(PORTRAIT_LAYOUT)
export const BANNER_VALLEY = buildValley(BANNER_LAYOUT)
