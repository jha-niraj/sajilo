/**
 * Spoken amounts in Hindi, Nepali, Maithili and English, in Latin or Devanagari letters:
 * "paanch saya" 500, "dedh hazar" 1500, "saadhe teen sau" 350, "2 hazar 500" 2500, "५००" 500.
 * Works on tokens so the parser knows which words were the number and which were the name.
 */

const UNITS: Record<string, number> = {}
const add = (n: number, ...words: string[]) => words.forEach((w) => (UNITS[w] = n))

add(0, "zero", "shunya", "sunya", "शून्य", "सुन्ना")
add(1, "ek", "one", "एक")
add(2, "do", "dui", "du", "two", "दो", "दुई", "दू")
add(3, "teen", "tin", "three", "तीन")
add(4, "char", "chaar", "chari", "chaari", "four", "चार", "चारि")
add(5, "paanch", "panch", "paach", "pach", "five", "पांच", "पाँच", "पाच")
add(6, "chha", "chhah", "chhe", "six", "छह", "छः", "छ", "छे")
add(7, "saat", "sat", "seven", "सात")
add(8, "aath", "ath", "aat", "eight", "आठ")
add(9, "nau", "nine", "नौ")
add(10, "das", "dus", "dash", "ten", "दस", "दश")
add(11, "gyarah", "gyara", "eghara", "eleven", "ग्यारह", "एघार")
add(12, "barah", "bara", "bahra", "baarah", "twelve", "बारह", "बाह्र")
add(13, "terah", "tera", "tehra", "thirteen", "तेरह", "तेह्र")
add(14, "chaudah", "chaudha", "chauda", "fourteen", "चौदह", "चौध")
add(15, "pandrah", "pandra", "pandhra", "fifteen", "पंद्रह", "पन्द्रह", "पन्ध्र")
add(16, "solah", "sola", "sorha", "sixteen", "सोलह", "सोह्र")
add(17, "satrah", "satra", "seventeen", "सत्रह", "सत्र")
add(18, "atharah", "athara", "athaara", "eighteen", "अठारह", "अठार")
add(19, "unnis", "unnais", "unais", "nineteen", "उन्नीस", "उन्नाइस")
add(20, "bees", "bis", "twenty", "बीस")
add(25, "pachchis", "pachis", "pachhis", "पच्चीस", "पच्चिस")
add(30, "tees", "tis", "thirty", "तीस")
add(35, "paintis", "paitis", "पैंतीस", "पैँतीस")
add(40, "chalis", "chaalis", "chalees", "forty", "चालीस", "चालिस")
add(45, "paintalis", "paitalis", "पैंतालीस", "पैँतालीस")
add(50, "pachas", "pachaas", "fifty", "पचास")
add(55, "pachpan", "pachpanna", "पचपन", "पचपन्न")
add(60, "saath", "sathi", "saathi", "sixty", "साठ", "साठी")
add(70, "sattar", "sattari", "seventy", "सत्तर", "सत्तरी")
add(75, "pachhattar", "pachattar", "pachahattar", "पचहत्तर", "पचहत्तरी")
add(80, "assi", "asi", "eighty", "अस्सी", "असी")
add(90, "nabbe", "nabbey", "ninety", "नब्बे")

const HUNDRED = new Set(["sau", "saw", "saya", "say", "sai", "sae", "hundred", "सौ", "सय", "सए"])
const BIG: Record<string, number> = {
    hazar: 1000, hajar: 1000, hazaar: 1000, hajaar: 1000, thousand: 1000, हजार: 1000, हज़ार: 1000,
    lakh: 100000, lac: 100000, laakh: 100000, लाख: 100000,
}
/** Numbers that stand for a fraction: dedh = 1.5, dhai = 2.5 */
const FRACTION: Record<string, number> = { dedh: 1.5, derh: 1.5, dedha: 1.5, डेढ: 1.5, डेढ़: 1.5, dhai: 2.5, adhai: 2.5, arhai: 2.5, adai: 2.5, ढाई: 2.5, अढाई: 2.5, अढ़ाई: 2.5 }
/** Words that shift the next multiplier: sawa sau 125, saadhe teen sau 350, paune do sau 175 */
const SHIFT: Record<string, number> = { sawa: 0.25, sava: 0.25, सवा: 0.25, saadhe: 0.5, sadhe: 0.5, saade: 0.5, साढे: 0.5, साढ़े: 0.5, paune: -0.25, paone: -0.25, पौने: -0.25 }

/** Also everyday words ("chha"/"छ" = is, "do" = give, "say"): numbers only before sau/hazar. */
const WEAK = new Set(["chha", "छ", "do", "say", "saw", "sat", "ath", "tin", "sai", "sae", "ek"])

const DEV_DIGITS = "०१२३४५६७८९"

/** Lowercase, NFC, Devanagari digits to Latin, commas inside numbers removed, digits split from letters. */
export function normaliseText(s: string): string {
    let t = s.normalize("NFC").toLowerCase().replace(/['’‘]/g, "")
    t = t.replace(/[०-९]/g, (d) => String(DEV_DIGITS.indexOf(d)))
    t = t.replace(/(\d),(?=\d)/g, "$1")
    t = t.replace(/(\d)([^\d\s.])/g, "$1 $2").replace(/([^\d\s.])(\d)/g, "$1 $2")
    t = t.replace(/[।|!?;:"“”'‘’(){}[\]/\\,]+/g, " , ")
    t = t.replace(/\.(?!\d)/g, " ")
    return t.replace(/\s+/g, " ").trim()
}

export function tokenize(s: string): string[] {
    return normaliseText(s).split(" ").filter(Boolean)
}

type Kind = "digits" | "unit" | "hundred" | "big" | "fraction" | "shift"

function kindOf(tok: string): Kind | null {
    if (/^\d+(\.\d+)?$/.test(tok)) return "digits"
    if (tok in UNITS) return "unit"
    if (HUNDRED.has(tok)) return "hundred"
    if (tok in BIG) return "big"
    if (tok in FRACTION) return "fraction"
    if (tok in SHIFT) return "shift"
    return null
}

function strong(tokens: string[], i: number): boolean {
    const t = tokens[i]!
    if (!WEAK.has(t)) return true
    const next = tokens[i + 1]
    if (next && (HUNDRED.has(next) || next in BIG)) return true
    const prev = tokens[i - 1]
    // "ek sau", "do hazar" are caught above; "say"/"sai" only count right after a number ("paanch say")
    return Boolean(prev && kindOf(prev) && HUNDRED.has(t))
}

export const isNumberWord = (tok: string) => kindOf(tok) !== null

export interface NumberSpan {
    value: number
    /** token index of the first and one past the last token of the number */
    start: number
    end: number
}

/**
 * Every amount in the tokens, left to right. Two plain numbers side by side ("500 200") are two
 * amounts; "do sau pachas" or "2 hazar 500" is one.
 */
export function findNumbers(tokens: string[]): NumberSpan[] {
    const out: NumberSpan[] = []
    let i = 0
    while (i < tokens.length) {
        if (!kindOf(tokens[i]!) || !strong(tokens, i)) {
            i++
            continue
        }
        const start = i
        let total = 0
        let current = 0
        let hasCurrent = false
        /** current is a bare "N sau" that may still take tens and units ("do sau pachas") */
        let openHundred = false
        let shift = 0
        let any = false
        let j = i
        for (; j < tokens.length; j++) {
            const tok = tokens[j]!
            const k = kindOf(tok)
            if (!k || !strong(tokens, j)) break
            if (k === "digits" || k === "unit" || k === "fraction") {
                const v = k === "digits" ? Number(tok) : k === "unit" ? UNITS[tok]! : FRACTION[tok]!
                if (!hasCurrent) {
                    current = v
                    hasCurrent = true
                } else if (openHundred && v < 100) {
                    current += v
                    openHundred = false
                } else break
                any = true
            } else if (k === "shift") {
                if (hasCurrent || shift) break
                shift = SHIFT[tok]!
            } else if (k === "hundred") {
                if (hasCurrent && current >= 100) break
                current = ((hasCurrent ? current : 1) + shift) * 100
                hasCurrent = true
                openHundred = true
                shift = 0
                any = true
            } else {
                total += ((hasCurrent ? current : 1) + shift) * BIG[tok]!
                current = 0
                hasCurrent = false
                openHundred = false
                shift = 0
                any = true
            }
        }
        if (any) out.push({ value: Math.round(total + (hasCurrent ? current : 0)), start, end: j })
        i = j > start ? j : start + 1
    }
    return out
}

/** The first amount in a sentence, or null. */
export function parseAmount(s: string): number | null {
    return findNumbers(tokenize(s))[0]?.value ?? null
}
