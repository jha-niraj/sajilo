/**
 * Matching a spoken name to his customers. Speech engines write the same name many ways
 * ("राम बहादुर", "Ram Bahadur", "Raam Bahadoor", "Rambahadur"), so both sides are turned into a
 * rough sound key and compared with an edit distance. Aliases he taught by correcting a name count too.
 */

const CONS: Record<string, string> = {
    क: "k", ख: "kh", ग: "g", घ: "gh", ङ: "ng", च: "ch", छ: "chh", ज: "j", झ: "jh", ञ: "n",
    ट: "t", ठ: "th", ड: "d", ढ: "dh", ण: "n", त: "t", थ: "th", द: "d", ध: "dh", न: "n",
    प: "p", फ: "ph", ब: "b", भ: "bh", म: "m", य: "y", र: "r", ल: "l", ळ: "l", व: "v",
    श: "sh", ष: "sh", स: "s", ह: "h",
}
const NUKTA: Record<string, string> = { ड: "r", ढ: "rh", फ: "f", ज: "z", क: "k", ख: "kh", ग: "g", य: "y" }
const VOWEL: Record<string, string> = { अ: "a", आ: "aa", इ: "i", ई: "ii", उ: "u", ऊ: "uu", ऋ: "ri", ए: "e", ऐ: "ai", ओ: "o", औ: "au", ऑ: "o", ॲ: "e" }
const MATRA: Record<string, string> = { "ा": "aa", "ि": "i", "ी": "ii", "ु": "u", "ू": "uu", "ृ": "ri", "े": "e", "ै": "ai", "ो": "o", "ौ": "au", "ॅ": "e", "ॉ": "o" }
const VIRAMA = "्"
const NUKTA_SIGN = "़"

/** Devanagari to plain Latin letters, dropping the final inherent "a" ("राम" -> "ram"). */
export function toLatin(s: string): string {
    const src = s.normalize("NFC")
    let out = ""
    for (let i = 0; i < src.length; i++) {
        const ch = src[i]!
        if (ch in CONS) {
            let base = CONS[ch]!
            let k = i + 1
            if (src[k] === NUKTA_SIGN) {
                base = NUKTA[ch] ?? base
                k++
            }
            out += base
            const next = src[k]
            if (next === VIRAMA) {
                i = k
            } else if (next && next in MATRA) {
                out += MATRA[next]
                i = k
            } else {
                const endOfWord = !next || !/[ऀ-ॿ]/.test(next)
                if (!endOfWord) out += "a"
                i = k - 1
            }
        } else if (ch in VOWEL) out += VOWEL[ch]
        else if (ch === "ं" || ch === "ँ") out += "n"
        else if (ch === "ः") out += "h"
        else if (ch === NUKTA_SIGN || ch === VIRAMA) continue
        else out += ch
    }
    return out
}

const SUBS: [RegExp, string][] = [
    [/ksh/g, "ks"],
    [/chh/g, "c"],
    [/ch/g, "c"],
    [/sh/g, "s"],
    [/ph/g, "f"],
    [/([kgjtdbr])h/g, "$1"],
    [/x/g, "ks"],
    [/q/g, "k"],
    [/z/g, "j"],
    [/[wv]/g, "b"],
    [/ee|ii|ey/g, "i"],
    [/oo|uu/g, "u"],
    [/aa/g, "a"],
    [/au|ou/g, "o"],
    [/ai|ei/g, "e"],
    [/(.)\1+/g, "$1"],
]

/** A rough sound key: "Raam Bahaadur", "राम बहादुर" and "rambahadur" all give "rambadur"-like keys. */
export function soundKey(s: string): string {
    let t = toLatin(s).toLowerCase().replace(/[^a-z]/g, "")
    for (const [re, to] of SUBS) t = t.replace(re, to)
    if (t.length > 3) t = t.replace(/[ah]$/, "")
    return t
}

function distance(a: string, b: string): number {
    if (a === b) return 0
    const prev = Array.from({ length: b.length + 1 }, (_, i) => i)
    for (let i = 1; i <= a.length; i++) {
        let diag = prev[0]!
        prev[0] = i
        for (let j = 1; j <= b.length; j++) {
            const tmp = prev[j]!
            prev[j] = Math.min(prev[j]! + 1, prev[j - 1]! + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1))
            diag = tmp
        }
    }
    return prev[b.length]!
}

/** 1 = same sound key, 0 = nothing alike */
export function similarity(a: string, b: string): number {
    if (!a || !b) return 0
    return 1 - distance(a, b) / Math.max(a.length, b.length)
}

export interface NameRow {
    id: string
    name: string
    aliases?: string[] | null
}

export type NameMatch<T> =
    | { status: "hit"; row: T; score: number }
    | { status: "ambiguous"; options: T[] }
    | { status: "none" }

const HIT = 0.8
const MAYBE = 0.6
const MARGIN = 0.12

/** How well the words he said fit one name: the whole name, or its first word(s) ("Sita" for "Sita Devi"). */
export function nameScore(heardWords: string[], name: string): number {
    const heard = soundKey(heardWords.join(""))
    if (!heard) return 0
    const words = name.split(/\s+/).filter(Boolean)
    let best = similarity(heard, soundKey(name))
    for (let n = 1; n < words.length; n++) best = Math.max(best, similarity(heard, soundKey(words.slice(0, n).join(""))) * 0.85)
    return best
}

/** The customer he meant, two or three he might have meant, or nobody. */
export function matchName<T extends NameRow>(heardWords: string[], rows: T[]): NameMatch<T> {
    if (!heardWords.length || !rows.length) return { status: "none" }
    const scored = rows
        .map((row) => ({ row, score: Math.max(nameScore(heardWords, row.name), ...(row.aliases ?? []).map((a) => nameScore(heardWords, a) + 0.01)) }))
        .sort((a, b) => b.score - a.score)
    const [top, second] = scored
    if (!top || top.score < MAYBE) return { status: "none" }
    const close = scored.filter((s) => s.score >= MAYBE && top.score - s.score < MARGIN)
    if (top.score >= HIT && (!second || top.score - second.score >= MARGIN)) return { status: "hit", row: top.row, score: top.score }
    return { status: "ambiguous", options: close.slice(0, 3).map((s) => s.row) }
}
