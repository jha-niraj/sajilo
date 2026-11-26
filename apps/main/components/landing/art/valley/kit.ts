import { type CharMap, Grid, spriteGrid } from "../pixel/grid"
import { FONT_H, LINE_H, measure, write } from "./font"

/*
 * The v3 pixel kit: coloured outlines, the four people (about 1.5x the v2 height, with real faces), the buildings,
 * the pasal and the speech bubbles. Pure data - no React - so the same pieces build the hero, the portrait crop, the
 * story scenes, the team portraits and the Kura scene.
 *
 * People rules (research, _art/RESEARCH.md): big heads (a 10-pixel face on a 23-pixel body) so eyes, brows, a mouth
 * and a blush read at hero size; one dominant clothing colour per person (school blue, marigold, teal, white and
 * charcoal) so each silhouette is told apart at a glance; hair carries a cool highlight on the lit (right) side; a
 * coloured outline per material instead of flat black.
 */

/** Copies every filled cell of `src` onto `dst` at (x, y). */
export function stamp(dst: Grid, src: Grid, x: number, y: number): void {
    for (let j = 0; j < src.h; j++) {
        for (let i = 0; i < src.w; i++) {
            const k = src.get(i, j)
            if (k) dst.set(x + i, y + j, k)
        }
    }
}

/** Which outline a material gets. Anything not listed takes the plain `line`. */
const OUTLINE_OF: Readonly<Record<string, string>> = {
    skin: "skinLine",
    skinShade: "skinLine",
    skinHi: "skinLine",
    skin2: "skinLine",
    skin2Shade: "skinLine",
    skin2Hi: "skinLine",
    shirt: "navyLine",
    shirtShade: "navyLine",
    navy: "navyLine",
    navyShade: "navyLine",
    sock: "greyLine",
    hoodie: "hoodieLine",
    hoodieShade: "hoodieLine",
    hoodieHi: "hoodieLine",
    shawl: "hoodieLine",
    shawlShade: "hoodieLine",
    teal: "tealLine",
    tealShade: "tealLine",
    tealHi: "tealLine",
    daura: "greyLine",
    dauraShade: "greyLine",
    laptop: "greyLine",
    laptopShade: "greyLine",
    wood: "woodLine",
    woodShade: "woodLine",
    woodHi: "woodLine",
    stick: "woodLine",
}

/** When two materials meet one outline pixel, the darker line wins (keeps the silhouette closed). */
const LINE_RANK = ["line", "navyLine", "tealLine", "woodLine", "skinLine", "hoodieLine", "greyLine", "midLine"]

/**
 * A copy of `src` one pixel larger on every side with a 1-pixel outline round every filled region (4-way, so corners
 * stay crisp). `key` forces one outline colour (mid-ground buildings use `midLine`); without it each outline pixel
 * takes the line of the material it touches. Draw it one pixel up and left of where the bare art would go.
 */
export function outlined(src: Grid, key?: string): Grid {
    const g = new Grid(src.w + 2, src.h + 2)
    stamp(g, src, 1, 1)
    for (let y = 0; y < g.h; y++) {
        for (let x = 0; x < g.w; x++) {
            if (g.get(x, y)) continue
            const near = [src.get(x - 2, y - 1), src.get(x, y - 1), src.get(x - 1, y - 2), src.get(x - 1, y)].filter((k): k is string => Boolean(k))
            if (!near.length) continue
            if (key) {
                g.set(x, y, key)
                continue
            }
            const lines = near.map((k) => OUTLINE_OF[k] ?? "line")
            const best = lines.reduce((a, b) => (LINE_RANK.indexOf(a) <= LINE_RANK.indexOf(b) ? a : b))
            g.set(x, y, best)
        }
    }
    return g
}

/** One character per palette key for the v3 sprites. */
export const CHAR3: CharMap = {
    k: "hair",
    K: "hairHi",
    g: "grey",
    G: "greyHi",
    s: "skin",
    S: "skinShade",
    h: "skinHi",
    a: "skin2",
    A: "skin2Shade",
    H: "skin2Hi",
    e: "eye",
    r: "blush",
    m: "mouth",
    b: "shirt",
    B: "shirtShade",
    n: "navy",
    N: "navyShade",
    x: "ribbon",
    w: "sock",
    f: "shoe",
    o: "hoodie",
    O: "hoodieShade",
    y: "hoodieHi",
    t: "teal",
    T: "tealShade",
    u: "tealHi",
    l: "shawl",
    L: "shawlShade",
    d: "daura",
    D: "dauraShade",
    v: "vest",
    V: "vestShade",
    c: "glasses",
    i: "lens",
    p: "phone",
    P: "phoneScreen",
    q: "laptop",
    Q: "laptopShade",
    z: "sticker",
    j: "stick",
    "!": "bag",
    "%": "bagShade",
    "&": "ledger",
    "1": "topiA",
    "2": "topiB",
    "3": "topiC",
    "4": "topiD",
    "5": "wood",
    "6": "woodShade",
    "7": "woodHi",
    "8": "page",
    "9": "book",
    C: "cloud",
    E: "cloudShade",
    W: "bird",
    Y: "pigeon",
    Z: "pigeonShade",
    X: "pigeonHi",
}

export type Pair = { a: Grid; b: Grid }

/** Two outlined frames from two sets of rows. */
export function person(a: readonly string[], b: readonly string[]): Pair {
    return { a: outlined(spriteGrid(a, CHAR3)), b: outlined(spriteGrid(b, CHAR3)) }
}

/** Replace whole rows of a sprite (frame B from frame A). */
export function swap(rows: readonly string[], changes: Readonly<Record<number, string>>): string[] {
    return rows.map((r, i) => changes[i] ?? r)
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* People                                                                                                             */
/* ------------------------------------------------------------------------------------------------------------------ */

/** A schoolgirl in the light-blue shirt and navy tie, two braids with red ribbons, asking her phone. */
const STUDENT_ROWS = [
    "...kkkkkk...",
    "..kkkkkkKk..",
    ".kkkkkkkkKk.",
    ".kkkkssssKk.",
    ".kksssssshk.",
    ".kssesseshk.",
    ".kssesseshk.",
    ".ksrssssrsk.",
    ".ksssmmsssk.",
    ".k.Sssssh.k.",
    ".k..SssS..k.",
    ".xbbbnnbbbx.",
    ".Bbbbnnbbbb.",
    ".BBbbnnbbbb.",
    ".BBsppppsbb.",
    ".BBbppppbbb.",
    "..NnnnnnnN..",
    "..NnNnnNnN..",
    ".NnnNnnNnnN.",
    "...ss..sh...",
    "...ww..ww...",
    "...ww..ww...",
    "..fff..fff..",
]
export const STUDENT = person(STUDENT_ROWS, swap(STUDENT_ROWS, { 5: ".kssssssshk.", 14: ".BBbsppppsb." }))

/** A developer in a marigold hoodie and square glasses, behind a laptop with a Boli-blue sticker; types in frame B. */
const DEV_ROWS = [
    ".....kkkkkk.....",
    "....kkkkkkKk....",
    "...kkkkkkkkKk...",
    "...kkkskksssk...",
    "...kssssssshk...",
    "...SsccssccsS...",
    "...Sceicceics...",
    "...SsccssccsS...",
    "....sssmmsss....",
    ".....Sssssh.....",
    "..ooooSssSyooo..",
    ".Ooooooooooooyo.",
    ".OqqqqqqqqqqqQo.",
    ".OqqqqqqqqqqqQo.",
    ".OqqqqqzzqqqqQo.",
    ".OqqqqqzzqqqqQo.",
    ".sqqqqqqqqqqqQs.",
    "7777777777777777",
    "5555555555555555",
    ".6............6.",
    ".6............6.",
    ".6............6.",
]
export const DEVELOPER = person(DEV_ROWS, swap(DEV_ROWS, { 16: "sOqqqqqqqqqqqQys" }))

/** An elder in a Dhaka topi, white daura suruwal and charcoal waistcoat, grey moustache, walking stick. */
const ELDER_ROWS = [
    "......423142..",
    "....31423142..",
    "..1423142314..",
    "..2222222222..",
    "..gssssssssg..",
    "..gsGGssGGsg..",
    "..gseesseesg..",
    "..Sssssssssh..",
    "...sGGGGGGs...",
    "...SGsmmsGh...",
    "....Sssssh....",
    "...vddddddv...",
    "..vvddddddvvj.",
    ".VvvddddddvvSs",
    ".VvvddddddvvSs",
    ".VvvddddddvvSj",
    ".SDdddddddddj.",
    "..DddddddddDj.",
    "..DddddddddDj.",
    "...dd...dd..j.",
    "...dd...dd..j.",
    "...dd...dd..j.",
    "..fff..fff..j.",
]
export const ELDER = person(ELDER_ROWS, swap(ELDER_ROWS, { 9: "...SGmmmmGh..." }))

/** The collector (Sajilo's father): Dhaka topi, white daura, charcoal waistcoat, a cloth bag across him and the red ledger in his hand. Frame B blinks. */
const COLLECTOR_ROWS = [
    "......423142..",
    "....31423142..",
    "..1423142314..",
    "..2222222222..",
    "..kssssssssk..",
    "..ksGGssGGsk..",
    "..kseesseesk..",
    "..Sssssssssh..",
    "...sGGGGGGs...",
    "...SGsmmsGh...",
    "....Sssssh....",
    "...v%ddddddv..",
    "..vvd%ddddvv..",
    ".Vvvdd%dddvvs.",
    ".Vvvddd%ddv&&.",
    ".Vvvdddd%dv&&.",
    ".SDdddddd%!&&.",
    "..Ddddd!!!!!..",
    "..Ddddd!%%%!..",
    "...dd..!!!!!..",
    "...dd...dd....",
    "...dd...dd....",
    "..fff..fff....",
]
export const COLLECTOR = person(COLLECTOR_ROWS, swap(COLLECTOR_ROWS, { 6: "..kssssssssk.." }))
/** The same man facing left (he talks to someone on his left). */
export const COLLECTOR_LEFT: Pair = {
    a: outlined(spriteGrid(COLLECTOR_ROWS, CHAR3, true)),
    b: outlined(spriteGrid(swap(COLLECTOR_ROWS, { 6: "..kssssssssk.." }), CHAR3, true)),
}

/** The pasal's shopkeeper: hair in a bun, teal kurta, marigold shawl; seen above the counter. Frame B waves. */
const SHOP_ROWS = [
    ".....kK.....",
    "...kkkkkK...",
    "..kkkkkkKk..",
    ".kkkkkkkkKk.",
    ".kkaaaaaakk.",
    ".kaaeaaeaHk.",
    ".kaaeaaeaHk.",
    ".karaaaarak.",
    "..aaammaaa..",
    "...AaaaaH...",
    "....AaaA....",
    ".llttttttuT.",
    ".tLlltttttT.",
    ".ttLLlltttT.",
    ".tttLLllttT.",
    ".atttttLlla.",
]
export const SHOPKEEPER = person(
    SHOP_ROWS,
    swap(SHOP_ROWS, {
        3: ".kkkkkkkkKka",
        4: ".kkaaaaaakka",
        5: ".kaaeaaeaHkt",
        6: ".kaaeaaeaHkt",
        7: ".karaaaaraku",
        8: "..aaammaaatu",
        9: "...AaaaaHtT.",
        15: ".atttttLllT.",
    }),
)

/* ------------------------------------------------------------------------------------------------------------------ */
/* Sky things                                                                                                         */
/* ------------------------------------------------------------------------------------------------------------------ */

export const BIRD: Pair = {
    a: spriteGrid(["W...W", ".W.W.", "..W.."], CHAR3),
    b: spriteGrid([".....", "WW.WW", "..W.."], CHAR3),
}

export const CLOUDS = {
    a: spriteGrid(["......CCCC......", "...CCCCCCCC.CCC.", "..CCCCCCCCCCCCCC", "CCCCCCCCCCCCCCCC", ".EEEEEEEEEEEEEE."], CHAR3),
    b: spriteGrid(["..CCCC....", ".CCCCCCCC.", "CCCCCCCCCC", ".EEEEEEEE."], CHAR3),
    c: spriteGrid(["....CCC.......", "..CCCCCCC.CC..", "CCCCCCCCCCCCCC", ".EEEEEEEEEEEE."], CHAR3),
} as const

/** A prayer flag 2 wide and 3 tall in two flutter frames (the free corner kicks out). */
export function flag(key: string): Pair {
    const a = new Grid(3, 3)
    a.rect(0, 0, 2, 3, key)
    const b = new Grid(3, 3)
    b.rect(0, 0, 2, 2, key)
    b.rect(1, 2, 2, 1, key)
    return { a, b }
}

/** A Boudha pigeon pecking at the courtyard (frame B dips its head). */
export const PIGEON: Pair = {
    a: outlined(spriteGrid([".....YY", "..YYYuY", "ZYXXYY.", ".ZZZY.."], CHAR3), "line"),
    b: outlined(spriteGrid([".......", "..YYY..", "ZYXXYuY", ".ZZZY.Y"], CHAR3), "line"),
}

export const PUFF = (() => {
    const p = new Grid(2, 2)
    p.rect(0, 0, 2, 2, "smoke")
    return p
})()

/* ------------------------------------------------------------------------------------------------------------------ */
/* Buildings - drawn in their own grid, then outlined with the softer mid-ground line.                                */
/* ------------------------------------------------------------------------------------------------------------------ */

/** A Newari brick house: wide eaves, latticed wooden windows, a door. Returns the chimney top (for smoke). */
export function house(w: number, h: number): { grid: Grid; chimney: { x: number; y: number } } {
    const g = new Grid(w + 2, h + 2)
    const top = 2
    for (let r = 0; r < 4; r++) {
        const inset = 3 - r
        g.rect(inset, top + r, w - 2 * inset + 2, 1, r === 3 ? "roofShade" : "roof")
    }
    const cx = w - 3
    g.rect(cx, 0, 2, 2, "roofShade")
    for (let r = 4; r < h; r++) {
        for (let c = 0; c < w; c++) g.set(1 + c, top + r, c < 2 ? "brickShade" : r % 3 === 0 && c % 4 === r % 4 ? "brickShade" : "brick")
    }
    g.rect(1, top + 4, w, 1, "roofShade")
    const floors = h >= 13 ? [top + 6, top + 10] : [top + 6]
    for (const fy of floors) {
        for (const c of [2, w - 5]) {
            g.rect(1 + c, fy, 3, 3, "wood")
            g.set(2 + c, fy + 1, "window")
            g.rect(1 + c, fy + 3, 3, 1, "woodShade")
        }
    }
    const door = Math.floor(w / 2)
    g.rect(door, top + h - 4, 2, 4, "woodShade")
    return { grid: outlined(g, "midLine"), chimney: { x: cx + 1, y: -1 } }
}

/** A Boudhanath-like stupa: three terraces, a white dome, the gold harmika with the eyes, a ringed spire. */
export function stupa(): { grid: Grid; finial: { x: number; y: number }; cx: number } {
    const W = 33
    const H = 35
    const g = new Grid(W, H)
    const cx = 16
    let y = H - 1
    const steps: readonly [number, number][] = [
        [16, 2],
        [14, 2],
        [12, 1],
    ]
    for (const [half, h] of steps) {
        for (let r = 0; r < h; r++) for (let x = cx - half; x <= cx + half; x++) g.set(x, y - r, x < cx - half + 3 ? "stupaShade" : "stupa")
        g.rect(cx - half, y - h + 1, 2 * half + 1, 1, "stupaShade")
        y -= h
    }
    const R = 8
    for (let r = 0; r <= R; r++) {
        const half = Math.round(Math.sqrt(R * R - r * r) * 1.4)
        for (let x = cx - half; x <= cx + half; x++) g.set(x, y - r, x < cx - Math.round(half * 0.45) ? "stupaShade" : "stupa")
    }
    y -= R + 1
    g.rect(cx - 4, y, 9, 1, "goldShade")
    g.rect(cx - 3, y - 4, 7, 4, "gold")
    g.rect(cx - 3, y - 4, 1, 4, "goldShade")
    g.set(cx - 2, y - 2, "line")
    g.set(cx + 2, y - 2, "line")
    g.set(cx, y - 1, "line")
    y -= 5
    const rings = [3, 3, 2, 2, 2, 1, 1, 1, 0, 0]
    rings.forEach((half, i) => g.rect(cx - half, y - i, 2 * half + 1, 1, i % 2 === 0 ? "gold" : "goldShade"))
    y -= rings.length
    g.set(cx, y, "goldShade")
    return { grid: outlined(g, "midLine"), finial: { x: cx + 1, y: y + 1 }, cx: cx + 1 }
}

/** A three-roof Newari pagoda. `cx` is its centre column inside the returned grid. */
export function pagoda(): { grid: Grid; cx: number } {
    const W = 23
    const H = 32
    const g = new Grid(W, H)
    const cx = 11
    const block = (half: number, by: number, h: number, key: string) => g.rect(cx - half, by - h + 1, 2 * half + 1, h, key)
    let y = H - 1
    block(10, y, 1, "brickShade")
    block(9, y - 1, 1, "brick")
    block(8, y - 2, 1, "brickShade")
    y -= 3
    const tiers: readonly [body: number, bodyH: number, roof: number][] = [
        [5, 5, 10],
        [4, 3, 8],
        [3, 3, 6],
    ]
    for (const [body, bodyH, roof] of tiers) {
        block(body, y, bodyH, "brick")
        g.rect(cx - body, y - bodyH + 1, 1, bodyH, "brickShade")
        g.rect(cx - 1, y - 1, 3, 2, "woodShade")
        y -= bodyH
        for (let r = 0; r < 3; r++) {
            const half = roof - r * 2
            if (half < 1) break
            g.rect(cx - half, y - r, 2 * half + 1, 1, r === 0 ? "roofShade" : "roof")
            if (r === 0) {
                g.set(cx - half, y, "gold")
                g.set(cx + half, y, "gold")
            }
        }
        y -= 3
    }
    g.rect(cx, y - 2, 1, 3, "gold")
    return { grid: outlined(g, "midLine"), cx: cx + 1 }
}

/** The pasal: a striped awning with a scalloped edge, shelves of jars, posts. Foreground (material outlines). */
export function stallBack(w = 34, h = 34): Grid {
    const g = new Grid(w, h)
    for (let c = 0; c < w; c++) {
        const stripe = c % 4 < 2 ? "awningA" : "awningB"
        g.set(c, 0, "awningEdge")
        g.rect(c, 1, 1, 3, stripe)
        if (c % 4 === 1 || c % 4 === 2) g.set(c, 4, stripe)
    }
    g.rect(1, 5, w - 2, h - 5, "woodShade")
    // A pale cloth hangs behind the shopkeeper so her dark hair reads against it.
    g.rect(9, 5, w - 18, h - 5, "curtain")
    for (let c = 10; c < w - 9; c += 3) g.rect(c, 5, 1, h - 5, "curtainShade")
    const jars = ["jarA", "jarB", "jarC", "jarD", "jarE"] as const
    for (const shelf of [11, 17]) {
        g.rect(1, shelf, 8, 1, "wood")
        g.rect(w - 9, shelf, 8, 1, "wood")
        for (const [i, c] of [2, 5, w - 8, w - 5].entries()) {
            g.rect(c, shelf - 3, 2, 3, jars[(i + shelf) % jars.length] ?? "jarA")
            g.set(c + 1, shelf - 3, "awningB")
        }
    }
    g.rect(0, 5, 1, h - 5, "wood")
    g.rect(w - 1, 5, 1, h - 5, "wood")
    return outlined(g, "line")
}

/** The counter in front of the shopkeeper, with the sign written in the bubble font at full size. */
export function counter(sign: string, w = 34, h = 13): Grid {
    const g = new Grid(w, h)
    g.rect(0, 0, w, 1, "woodHi")
    g.rect(0, 1, w, h - 1, "wood")
    g.rect(0, h - 2, w, 2, "woodShade")
    const tw = measure(sign)
    const sx = Math.floor((w - tw) / 2)
    g.rect(sx - 2, 2, tw + 4, 10, "woodShade")
    write(g, sx, 2, sign, "page")
    return outlined(g, "line")
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Speech bubbles - a UI layer drawn at HALF the world pixel (as games draw their text layer finer than the world),   */
/* with a border two half-pixels thick so the frame still matches the world's one-pixel outline.                      */
/* ------------------------------------------------------------------------------------------------------------------ */

export type Tail = { side: "bottom" | "left" | "right"; at: number }

export type Bubble = {
    text: Grid
    frame: Grid
    /** Size in half-pixels. */
    w: number
    h: number
    /** Where the three typing dots go (half-pixels, top-left of the middle dot). */
    dots: { x: number; y: number }
}

/** A rounded bubble with a 2-thick ink border, a soft shadow on its lower right, and a tail. `at` is in half-pixels. */
export function bubble(lines: readonly string[], tail: Tail): Bubble {
    const inner = Math.max(...lines.map(measure), 22)
    const bw = inner + 12
    const bh = 4 + (lines.length - 1) * LINE_H + FONT_H + 3
    const ox = tail.side === "left" ? 6 : 0
    const w = bw + ox + (tail.side === "right" ? 6 : 0) + 2
    const h = bh + (tail.side === "bottom" ? 6 : 0) + 2
    const body = (g: Grid) => {
        // Shadow, offset 2 down and right.
        g.rect(ox + 4, 2 + 2, bw - 4, bh - 2, "bubbleShade")
        g.rect(ox + 2, 2 + 4, bw, bh - 6, "bubbleShade")
        // Border (2 thick) with stepped corners, then the fill.
        g.rect(ox + 3, 0, bw - 6, 2, "bubbleInk")
        g.rect(ox + 3, bh - 2, bw - 6, 2, "bubbleInk")
        g.rect(ox, 3, 2, bh - 6, "bubbleInk")
        g.rect(ox + bw - 2, 3, 2, bh - 6, "bubbleInk")
        g.rect(ox + 1, 1, 3, 3, "bubbleInk")
        g.rect(ox + bw - 4, 1, 3, 3, "bubbleInk")
        g.rect(ox + 1, bh - 4, 3, 3, "bubbleInk")
        g.rect(ox + bw - 4, bh - 4, 3, 3, "bubbleInk")
        g.rect(ox + 2, 2, bw - 4, bh - 4, "bubble")
        g.rect(ox + 3, 2, bw - 6, 1, "bubble")
        if (tail.side === "bottom") {
            const t = ox + tail.at
            for (let r = 0; r < 6; r++) {
                const fill = Math.max(0, 4 - r)
                g.rect(t, bh - 2 + r, 2, 1, "bubbleInk")
                if (fill > 0) g.rect(t + 2, bh - 2 + r, fill, 1, "bubble")
                g.rect(t + 2 + fill, bh - 2 + r, 2, 1, "bubbleInk")
            }
        } else {
            const t = tail.at
            const left = tail.side === "left"
            const edge = left ? ox : ox + bw - 2
            for (let r = 0; r < 6; r++) {
                const fill = Math.max(0, 4 - r)
                const x0 = left ? edge - r : edge + r
                g.rect(x0, t, 2, 1, "bubbleInk")
                if (fill > 0) g.rect(x0, t + 2, 2, fill, "bubble")
                g.rect(x0, t + 2 + fill, 2, 2, "bubbleInk")
            }
        }
    }
    const frame = new Grid(w, h)
    body(frame)
    const text = new Grid(w, h)
    body(text)
    lines.forEach((line, i) => write(text, ox + 6, 4 + i * LINE_H, line, "bubbleInk"))
    return { text, frame, w, h, dots: { x: ox + Math.floor(bw / 2) - 1, y: Math.floor(bh / 2) - 1 } }
}
