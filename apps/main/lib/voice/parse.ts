/**
 * What he said, as something the app can act on. Pure and tested (parse.test.ts); runs on the
 * phone for both online (Saaras transcript) and offline (on-device recognition) speech.
 * Rules: plan/phase-5-voice-first.md.
 */
import { findNumbers, tokenize, type NumberSpan } from "./numbers"
import { matchName, type NameMatch } from "./names"

export type VoiceLang = "hi" | "ne" | "mai" | "en"

/** Someone he can name: a collection customer, or a recharge udharo person who is not a customer. */
export interface Who {
    kind: "customer" | "person"
    id: string
    name: string
    aliases?: string[] | null
    /** customers: their daily amount */
    daily?: number
    /** recharge udharo they still owe (customers too, through their linked person) */
    owes?: number
}

export type EntryKind = "deposit" | "credit" | "payback" | "shop_closed" | "no_money"

export interface ParsedEntry {
    match: NameMatch<Who>
    /** the words taken as the name, for "X list mein nahi hai" and for learning aliases */
    heard: string
    amount: number | null
    /** null = deposit or payback, he must say which (customer who also owes udharo) */
    kind: EntryKind | null
    provider: "ntc" | "ncell" | null
    stock: "eload" | "card" | null
}

export type Parsed =
    | { type: "entries"; entries: ParsedEntry[]; date: string }
    | { type: "yes" }
    | { type: "no"; amount: number | null }
    | { type: "undo" }
    | { type: "amount"; amount: number }
    | { type: "ask"; question: "missed" | "cash" | "owed"; match: NameMatch<Who> | null }
    | { type: "close_day" }
    | { type: "unknown" }

const set = (...w: string[]) => new Set(w)

const YES = set("haan", "han", "ha", "haa", "hn", "hm", "hmm", "ho", "hunchha", "huncha", "hunxa", "thik", "theek", "thick", "sahi", "ok", "okay", "yes", "yeah", "ji", "jee", "bilkul", "save", "confirm", "hai", "chha", "chhai", "achhi", "hau", "हाँ", "हां", "हा", "हो", "जी", "ठीक", "ठिक", "सही", "हुन्छ", "छ", "छै", "अछि", "बिल्कुल", "हँ")
const NO = set("nahi", "nahin", "nai", "naa", "na", "no", "nope", "hoina", "hoena", "galat", "mat", "nako", "naai", "नहीं", "नही", "होइन", "नाइ", "नै", "गलत", "ना")
const UNDO = set("galti", "galati", "galt", "undo", "hatau", "hatao", "hataunu", "mitau", "mitao", "गल्ती", "गलती", "हटाऊ", "हटाओ", "हटाउ", "मेटाऊ")

const WHO = set("kisne", "kisle", "kasle", "kasko", "kaun", "kon", "kun", "kone", "ke", "who", "किसने", "कसले", "कौन", "कुन", "के", "केकर", "कोन")
const NEG = set("nahi", "nahin", "nai", "diena", "diyena", "deena", "chhaina", "chaina", "na", "not", "havent", "hasnt", "didnt", "नहीं", "नही", "दिएन", "छैन", "नै", "देलक", "नइ")
const HOW_MUCH = set("kitna", "kitni", "kitne", "kati", "kitek", "katek", "kaete", "kate", "how", "कितना", "कितनी", "कति", "कतेक", "कत्ते")
const MONEY = set("paisa", "paise", "cash", "rupaiya", "rupaye", "rupees", "rakam", "hona", "hunu", "hunuparne", "chahiye", "पैसा", "पैसे", "रुपैयाँ", "रुपये", "रुपया", "होना", "हुनुपर्ने", "चाहिए", "रकम", "नगद")
const OWED = set("baaki", "baki", "bakaya", "udhaar", "udhar", "udharo", "owe", "owes", "due", "बाकी", "बाँकी", "बकाया", "उधार", "उधारो")
const DAY = set("din", "dino", "day", "aaj", "aja", "aaja", "today", "hisab", "hisaab", "दिन", "आज", "हिसाब")
const CLOSE = set("band", "bandh", "close", "khatam", "sakiyo", "sakkiyo", "sakyo", "sakau", "sakaau", "बन्द", "बंद", "खतम", "सकियो", "सकाऊ", "सकाउ")

const CREDIT = set("udhaar", "udhar", "udharo", "udhaaro", "credit", "उधार", "उधारो", "बाकी", "बाँकी")
const PAYBACK = set("wapas", "vapas", "waapas", "firta", "phirta", "fiirta", "tiryo", "tiro", "tirnu", "tireko", "chukaya", "chukta", "chukaye", "chukao", "chukayo", "return", "returned", "back", "lautaya", "वापस", "फिर्ता", "तिर्यो", "तिरे", "चुकाया", "चुकता", "लौटाया", "चुकयलक")
const SHOP = set("pasal", "dukan", "dokan", "shop", "पसल", "दुकान", "दोकान")
const RECHARGE = set("recharge", "richarge", "load", "eload", "topup", "रिचार्ज", "लोड", "ntc", "ncell", "namaste", "card", "kard", "कार्ड", "नमस्ते", "एनटीसी", "एनसेल")
const NTC = set("ntc", "namaste", "नमस्ते", "एनटीसी")
const NCELL = set("ncell", "encell", "एनसेल", "cell")
const CARD = set("card", "kard", "कार्ड")
const ELOAD = set("load", "eload", "लोड")
const YESTERDAY = set("kal", "hijo", "kaali", "kaalhi", "kailh", "kaili", "yesterday", "कल", "हिजो", "काल्हि", "कालि")

/** Words that are never part of a name: helpers, verbs, money words. */
const FILLER = set(
    "ko", "ke", "ka", "ki", "ne", "le", "lai", "laai", "ji", "jee", "se", "sanga", "bata", "ra", "aur", "ani", "ar", "and", "evam", "tatha",
    "rs", "ru", "re", "rupaiya", "rupaye", "rupiya", "rupya", "rupees", "rupee", "taka", "paisa", "paise",
    "diya", "diye", "diyo", "dio", "diyau", "delak", "delakai", "dela", "delkai", "deu", "de", "di", "dinu", "diyeko", "gave", "paid", "pay", "payment",
    "jama", "jamma", "deposit", "gar", "garnu", "garyo", "gareko", "garau", "kar", "karo", "kardo", "karu", "kariyau", "kiya", "liya", "liyo", "lelak",
    "aaj", "aaja", "aja", "today", "hai", "chha", "chhai", "achhi", "cha", "ho", "hun", "hua", "bhayo", "bhel", "gelai", "ge", "mein", "ma", "me",
    "bhai", "dai", "didi", "bahini", "kaka", "kaki", "uncle", "aunty", "sir", "madam", "saab", "paas", "pas", "pani", "bhi", "taraf", "sahab", "please", "plz", "naya", "nayan",
    "को", "के", "का", "की", "ने", "ले", "लाई", "जी", "से", "सँग", "र", "और", "आ", "रु", "रुपैयाँ", "रुपये", "रुपया", "पैसा",
    "दिया", "दियो", "देलक", "देलकै", "जमा", "गर", "गर्‍यो", "गर्यो", "कर", "करो", "किया", "लियो", "आज", "है", "छ", "छै", "अछि", "भयो", "मा", "में",
    ",",
)

const has = (tokens: string[], s: Set<string>) => tokens.some((t) => s.has(t))

function addDays(ad: string, n: number): string {
    const [y, m, d] = ad.split("-").map(Number) as [number, number, number]
    const t = new Date(Date.UTC(y, m - 1, d + n))
    return t.toISOString().slice(0, 10)
}

/** Which language he spoke, for the reply. Ties go to the app's language. */
export function detectLang(text: string, fallback: VoiceLang): VoiceLang {
    const t = tokenize(text)
    const count = (words: string[]) => t.filter((x) => words.includes(x)).length
    const score: Record<VoiceLang, number> = {
        ne: count(["cha", "chha", "chhaina", "garyo", "diyo", "diena", "hunchha", "huncha", "lai", "le", "kati", "hoina", "rupaiya", "sakiyo", "hijo", "aaja", "kasle", "छ", "छैन", "गर्यो", "दियो", "दिएन", "हुन्छ", "लाई", "कति", "होइन", "रुपैयाँ", "सय", "हिजो", "कसले"]),
        hi: count(["hai", "diya", "nahi", "nahin", "kitna", "kisne", "ne", "sau", "rupaye", "haan", "karo", "kal", "chahiye", "है", "दिया", "नहीं", "कितना", "किसने", "सौ", "रुपये", "हाँ", "करो", "चाहिए"]),
        mai: count(["chhai", "achhi", "delak", "delkai", "nai", "kahu", "hamar", "ahan", "kaili", "kailh", "katek", "ekar", "bhel", "gelai", "छै", "अछि", "देलक", "देलकै", "नै", "हमर", "अहाँ", "कतेक", "भेल"]),
        en: count(["paid", "gave", "rupees", "yes", "no", "who", "how", "much", "today", "close", "the", "has", "hasnt", "undo"]),
    }
    const best = (Object.entries(score) as [VoiceLang, number][]).sort((a, b) => b[1] - a[1])[0]!
    return best[1] > 0 && best[1] > (score[fallback] ?? 0) ? best[0] : fallback
}

function weekdayOffset(tokens: string[], today: string): number | null {
    const DAYS: [number, string[]][] = [
        [0, ["sombar", "somvar", "somwar", "monday", "सोमबार", "सोमवार"]],
        [1, ["mangalbar", "mangalvar", "mangalwar", "tuesday", "मंगलबार", "मङ्गलबार", "मंगलवार"]],
        [2, ["budhabar", "budhbar", "budhvar", "budhwar", "wednesday", "बुधबार", "बुधवार"]],
        [3, ["bihibar", "guruvar", "guruwar", "brihaspativar", "thursday", "बिहिबार", "गुरुवार", "बृहस्पतिवार"]],
        [4, ["sukrabar", "shukrabar", "shukravar", "shukrawar", "friday", "शुक्रबार", "शुक्रवार"]],
        [5, ["sanibar", "shanibar", "shanivar", "shaniwar", "saturday", "शनिबार", "शनिवार"]],
        [6, ["aaitabar", "aitabar", "itvar", "itwar", "ravivar", "raviwar", "sunday", "आइतबार", "इतवार", "रविवार"]],
    ]
    const hit = DAYS.find(([, words]) => has(tokens, new Set(words)))
    if (!hit) return null
    const [y, m, d] = today.split("-").map(Number) as [number, number, number]
    const todayMon0 = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7
    return -((todayMon0 - hit[0] + 7) % 7)
}

/** Splits the sentence at each amount: the words before an amount (since the last one) are its name. */
function segments(tokens: string[], spans: NumberSpan[]) {
    const out: { words: string[]; amount: number | null; context: string[] }[] = []
    let from = 0
    spans.forEach((s, i) => {
        let words = tokens.slice(from, s.start)
        const nextStart = spans[i + 1]?.start ?? tokens.length
        let tail = tokens.slice(s.end, nextStart)
        // "500 Ram Bahadur ko": the name comes after the amount when nothing came before it
        if (!words.some((w) => !FILLER.has(w) && !isKeyword(w)) && i === spans.length - 1) {
            words = tail
            tail = []
        }
        out.push({ words, amount: s.value, context: [...words, ...tail] })
        from = s.end
    })
    return out
}

const KEYWORDS = [CREDIT, PAYBACK, SHOP, RECHARGE, YESTERDAY, CLOSE, OWED]
const isKeyword = (w: string) => KEYWORDS.some((k) => k.has(w)) || YES.has(w) || NO.has(w)
/** Nepali and Maithili join "le", "lai", "ko" to the name: "रमेशले", "Rameshlai". */
const SUFFIX = /(ले|लाई|लै|को|का|की|के|कै|सँग|बाट)$/
const LATIN_SUFFIX = /(lai|le|ko)$/
function stripSuffix(w: string): string {
    if (SUFFIX.test(w) && w.replace(SUFFIX, "").length >= 2) return w.replace(SUFFIX, "")
    if (/^[a-z]+$/.test(w) && w.length >= 6 && LATIN_SUFFIX.test(w)) return w.replace(LATIN_SUFFIX, "")
    return w
}
const nameWords = (words: string[]) => words.filter((w) => !FILLER.has(w) && !isKeyword(w) && w !== "band" && w !== "बन्द").map(stripSuffix)

function kindFor(context: string[], match: NameMatch<Who>, amount: number | null): EntryKind | null {
    if (has(context, SHOP) && has(context, CLOSE)) return "shop_closed"
    if (amount === null && has(context, MONEY) && has(context, NEG)) return "no_money"
    if (has(context, PAYBACK)) return "payback"
    if (has(context, CREDIT) || has(context, RECHARGE)) return "credit"
    if (match.status !== "hit") return "deposit"
    const who = match.row
    if (who.kind === "person") return "payback"
    return (who.owes ?? 0) > 0 ? null : "deposit"
}

export interface ParseInput {
    text: string
    people: Who[]
    today: string
}

export function parseUtterance({ text, people, today }: ParseInput): Parsed {
    const tokens = tokenize(text)
    const words = tokens.filter((t) => t !== ",")
    if (!words.length) return { type: "unknown" }
    const spans = findNumbers(tokens)

    if (has(words, UNDO) && words.length <= 4) return { type: "undo" }

    // Questions come before entries: "Ramesh ka kitna baaki?" names someone but is not an entry.
    if (has(words, HOW_MUCH) && !spans.length) {
        if (has(words, OWED)) {
            const name = nameWords(words.filter((w) => !HOW_MUCH.has(w) && !MONEY.has(w)))
            return { type: "ask", question: "owed", match: name.length ? matchName(name, people) : null }
        }
        if (has(words, MONEY) || words.includes("cash")) return { type: "ask", question: "cash", match: null }
    }
    if (has(words, WHO) && has(words, NEG) && !spans.length) {
        // "ke" is also "of": "Sita Devi ke paas paisa nahi" names someone, so it is not the question
        const rest = nameWords(words.filter((w) => !WHO.has(w) && !NEG.has(w) && !MONEY.has(w) && !DAY.has(w)))
        if (!rest.length || matchName(rest, people).status === "none") return { type: "ask", question: "missed", match: null }
    }
    if (has(words, CLOSE) && has(words, DAY) && !has(words, SHOP) && !spans.length) return { type: "close_day" }

    const yes = has(words, YES)
    const no = has(words, NO)

    if (!spans.length) {
        // "Mohan ko pasal band", "Sita ko paisa chhaina": a name with no amount
        const name = nameWords(words.filter((w) => !NEG.has(w) && !MONEY.has(w) && !SHOP.has(w)))
        const shut = has(words, SHOP) && (has(words, CLOSE) || words.includes("band"))
        const broke = has(words, MONEY) && has(words, NEG)
        if (name.length && (shut || broke)) {
            const match = matchName(name, people)
            if (match.status !== "none") {
                return {
                    type: "entries",
                    date: dateOf(words, today),
                    entries: [{ match, heard: name.join(" "), amount: null, kind: shut ? "shop_closed" : "no_money", provider: null, stock: null }],
                }
            }
        }
        if (no && !yes) return { type: "no", amount: null }
        if (yes && words.length <= 5) return { type: "yes" }
        if (no) return { type: "no", amount: null }
        return { type: "unknown" }
    }

    // "nahi, chhe saya": a correction of the amount on the open card
    if (no && spans.length === 1 && words.filter((w) => !NO.has(w) && !FILLER.has(w)).length <= spans[0]!.end - spans[0]!.start) {
        return { type: "no", amount: spans[0]!.value }
    }

    const segs = segments(tokens, spans)
    const entries: ParsedEntry[] = []
    for (const s of segs) {
        const name = nameWords(s.words)
        if (!name.length) continue
        const match = matchName(name, people)
        const kind = kindFor(s.context, match, s.amount)
        entries.push({
            match,
            heard: name.join(" "),
            amount: s.amount,
            kind,
            provider: has(s.context, NTC) ? "ntc" : has(s.context, NCELL) ? "ncell" : null,
            stock: has(s.context, CARD) ? "card" : has(s.context, ELOAD) ? "eload" : null,
        })
    }
    if (entries.length) return { type: "entries", entries, date: dateOf(words, today) }
    if (spans.length === 1) return { type: "amount", amount: spans[0]!.value }
    return { type: "unknown" }
}

function dateOf(words: string[], today: string): string {
    if (has(words, YESTERDAY)) return addDays(today, -1)
    const off = weekdayOffset(words, today)
    return off === null ? today : addDays(today, off)
}
