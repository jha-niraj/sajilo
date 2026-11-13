/**
 * The voice loop's brain, pure (engine.test.ts): one sentence in, the next state, what to say and
 * what to save out. The hook (components/munshi/use-voice-ledger.ts) runs the saves through the
 * offline queue, so it works the same with or without signal.
 */
import { tokenize } from "./numbers"
import { matchName } from "./names"
import { detectLang, parseUtterance, type EntryKind, type ParsedEntry, type VoiceLang, type Who } from "./parse"
import { REPLIES } from "./replies"

export type Pool = "ntc:eload" | "ntc:card" | "ncell:eload" | "ncell:card"

/** What the phone knows right now, built by lib/voice/book.ts. */
export interface VoiceBook {
    today: string
    lockedToday: boolean
    people: Who[]
    /** today's marks by customer id */
    marks: Record<string, { status: string; amount: number }>
    /** customers due today and not marked yet, route order */
    unpaid: string[]
    collectionToday: number
    rechargeCashToday: number
    stock: Record<Pool, number>
    /** what "galti" would remove, or null */
    lastSaved: string | null
}

export interface VoiceCard {
    id: string
    who: Who | null
    /** names he might have meant, when the name was unclear */
    options: Who[]
    heard: string
    amount: number | null
    /** null until he says deposit or payback */
    kind: EntryKind | null
    date: string
    provider: "ntc" | "ncell" | null
    stock: "eload" | "card" | null
}

export type Need = "name" | "kind" | "network" | "amount" | "stock" | null
export type Warn = "duplicate" | "unusual" | null

export type Awaiting = null | { type: "amount"; cardId: string } | { type: "close_count"; expected: number } | { type: "close_confirm"; counted: number; expected: number }

export interface EngineState {
    cards: VoiceCard[]
    awaiting: Awaiting
    lang: VoiceLang
}

export type Effect =
    | { type: "save"; cards: VoiceCard[] }
    | { type: "undo" }
    | { type: "close"; date: string; counted: number }
    | { type: "alias"; customerId: string; alias: string }

export interface Step {
    state: EngineState
    say: string
    effects: Effect[]
    /** false: not a ledger sentence; online it goes to Munshi's agent */
    handled: boolean
    /** an answer the screen should show as a list (missed today) */
    show?: "unpaid"
}

const MONEY_KINDS: EntryKind[] = ["deposit", "credit", "payback"]
const poolOf = (c: VoiceCard): Pool | null => (c.provider && c.stock ? (`${c.provider}:${c.stock}` as Pool) : null)

export function cardNeed(c: VoiceCard, book: VoiceBook): Need {
    if (!c.who) return "name"
    if (c.kind === null) return "kind"
    if (MONEY_KINDS.includes(c.kind) && c.amount === null) return "amount"
    if (c.kind === "credit") {
        const pool = poolOf(c)
        if (!pool) return "network"
        if ((book.stock[pool] ?? 0) < (c.amount ?? 0)) return "stock"
    }
    return null
}

export function cardWarn(c: VoiceCard, book: VoiceBook): Warn {
    if (!c.who || c.who.kind !== "customer" || c.kind !== "deposit" || c.amount === null) return null
    const mark = c.date === book.today ? book.marks[c.who.id] : undefined
    if (mark && mark.amount > 0) return "duplicate"
    const daily = c.who.daily ?? 0
    if ((daily > 0 && c.amount > daily * 5) || c.amount % 10 !== 0) return "unusual"
    return null
}

const set = (...w: string[]) => new Set(w)
const DEPOSIT_WORDS = set("jama", "jamma", "deposit", "saving", "bachat", "जमा", "जम्मा", "बचत")
const PAYBACK_WORDS = set("wapas", "vapas", "firta", "phirta", "payback", "udhaar", "udhar", "udharo", "वापस", "फिर्ता", "उधार", "उधारो")
const CANCEL = set("cancel", "chhod", "chhodo", "chhoddo", "chhodidinu", "rahne", "rahanedo", "rehnedo", "chhoddu", "छोड़", "छोड़ो", "छोडिदिनु", "छोड", "रहने", "क्यान्सल")

let seq = 0
const cardId = () => `vc-${Date.now().toString(36)}-${(seq++).toString(36)}`

function toCard(e: ParsedEntry, date: string): VoiceCard {
    const who = e.match.status === "hit" ? e.match.row : null
    return {
        id: cardId(),
        who,
        options: e.match.status === "ambiguous" ? e.match.options : [],
        heard: e.heard,
        amount: e.amount,
        kind: e.kind,
        date,
        provider: e.provider,
        stock: e.stock,
    }
}

/** He picked a name for an unclear card (by voice or by tapping): set it, and fix a kind that depended on who it was. */
export function chooseWho(c: VoiceCard, who: Who): VoiceCard {
    let kind = c.kind
    if (kind === "deposit" && who.kind === "person") kind = "payback"
    return { ...c, who, options: [], kind }
}

/** Should picking `who` for what he said be remembered as another name for them? */
export function aliasFor(c: VoiceCard, who: Who): string | null {
    // Picking one of the offered look-alikes ("Sita" -> Sita Kumari) is not a new name for her.
    if (who.kind !== "customer" || !c.heard || c.options.length) return null
    const said = c.heard.trim().toLowerCase()
    if (said === who.name.toLowerCase() || (who.aliases ?? []).includes(said)) return null
    return said
}

function prompt(cards: VoiceCard[], book: VoiceBook, lang: VoiceLang): string {
    const R = REPLIES[lang]
    for (const c of cards) {
        const need = cardNeed(c, book)
        if (!need) continue
        if (need === "name") return c.options.length ? R.which(c.options.map((o) => o.name)) : R.notInList(c.heard)
        if (need === "kind") return R.whichKind(c.who!.name)
        if (need === "network") return R.whichNetwork
        if (need === "amount") return R.howMuch
        const pool = poolOf(c)!
        return R.stockLow(book.stock[pool] ?? 0)
    }
    const warned = cards.find((c) => cardWarn(c, book))
    if (warned) {
        const w = cardWarn(warned, book)!
        return w === "duplicate" ? R.duplicate(warned.who!.name, warned.amount!) : R.unusual(warned.who!.name, warned.amount!)
    }
    if (cards.length === 1) {
        const c = cards[0]!
        const when = c.date === book.today ? null : R.yesterday
        return R.confirmOne(c.who!.name, c.amount, R.kind[c.kind!], when)
    }
    return R.confirmMany(
        cards.length,
        cards.reduce((s, c) => s + (c.amount ?? 0), 0),
    )
}

/** Fills the first open question on the cards from a short answer ("Ram Babu", "jama", "NTC load", "300"). */
function answer(cards: VoiceCard[], text: string, book: VoiceBook, amount: number | null): { cards: VoiceCard[]; effects: Effect[] } | null {
    const i = cards.findIndex((c) => cardNeed(c, book) && cardNeed(c, book) !== "stock")
    if (i < 0) return null
    const c = cards[i]!
    const need = cardNeed(c, book)
    const words = tokenize(text)
    const effects: Effect[] = []
    let next: VoiceCard | null = null
    if (need === "name") {
        const pool = c.options.length ? c.options : book.people
        const m = matchName(
            words.filter((w) => !CANCEL.has(w)),
            pool,
        )
        if (m.status === "hit") {
            next = chooseWho(c, m.row)
            const alias = aliasFor(c, m.row)
            if (alias) effects.push({ type: "alias", customerId: m.row.id, alias })
        } else if (m.status === "ambiguous" && !c.options.length) next = { ...c, options: m.options }
    } else if (need === "kind") {
        if (words.some((w) => PAYBACK_WORDS.has(w))) next = { ...c, kind: "payback" }
        else if (words.some((w) => DEPOSIT_WORDS.has(w))) next = { ...c, kind: "deposit" }
    } else if (need === "network") {
        const provider = words.some((w) => ["ntc", "namaste", "नमस्ते", "एनटीसी"].includes(w)) ? "ntc" : words.some((w) => ["ncell", "encell", "cell", "एनसेल"].includes(w)) ? "ncell" : c.provider
        const stock = words.some((w) => ["card", "kard", "कार्ड"].includes(w)) ? "card" : words.some((w) => ["load", "eload", "लोड"].includes(w)) ? "eload" : c.stock
        if (provider !== c.provider || stock !== c.stock) next = { ...c, provider, stock }
    } else if (need === "amount" && amount !== null) next = { ...c, amount }
    if (!next) return null
    return { cards: cards.map((x, k) => (k === i ? next! : x)), effects }
}

export function initialState(lang: VoiceLang): EngineState {
    return { cards: [], awaiting: null, lang }
}

export function handle(state: EngineState, text: string, book: VoiceBook): Step {
    const lang = detectLang(text, state.lang)
    const R = REPLIES[lang]
    const parsed = parseUtterance({ text, people: book.people, today: book.today })
    const base = { ...state, lang }
    const done = (s: Partial<EngineState>, say: string, effects: Effect[] = [], extra: Partial<Step> = {}): Step => ({
        state: { ...base, ...s },
        say,
        effects,
        handled: true,
        ...extra,
    })
    const words = tokenize(text)
    const amountSaid = parsed.type === "amount" ? parsed.amount : parsed.type === "no" ? parsed.amount : null

    if (words.some((w) => CANCEL.has(w)) && (state.cards.length || state.awaiting)) return done({ cards: [], awaiting: null }, R.cancelled)

    const aw = state.awaiting
    if (aw?.type === "close_count") {
        if (amountSaid !== null) return done({ awaiting: { type: "close_confirm", counted: amountSaid, expected: aw.expected } }, R.closeDiff(amountSaid, aw.expected - amountSaid))
        if (parsed.type === "no") return done({ awaiting: null }, R.cancelled)
    }
    if (aw?.type === "close_confirm") {
        if (parsed.type === "yes") return done({ awaiting: null }, R.closed, [{ type: "close", date: book.today, counted: aw.counted }])
        if (amountSaid !== null) return done({ awaiting: { ...aw, counted: amountSaid } }, R.closeDiff(amountSaid, aw.expected - amountSaid))
        if (parsed.type === "no") return done({ awaiting: null }, R.cancelled)
    }
    if (aw?.type === "amount" && amountSaid !== null) {
        const cards = state.cards.map((c) => (c.id === aw.cardId ? { ...c, amount: amountSaid } : c))
        return done({ cards, awaiting: null }, prompt(cards, book, lang))
    }

    // A short answer to the open question on a card ("Ram Babu", "jama", "NTC load")
    if (state.cards.length && parsed.type !== "entries" && parsed.type !== "yes" && parsed.type !== "undo") {
        const filled = answer(state.cards, text, book, amountSaid)
        if (filled) return done({ cards: filled.cards, awaiting: null }, prompt(filled.cards, book, lang), filled.effects)
    }

    switch (parsed.type) {
        case "entries": {
            const added = parsed.entries.map((e) => toCard(e, parsed.date))
            const cards = [...state.cards, ...added]
            return done({ cards, awaiting: null }, prompt(cards, book, lang))
        }
        case "yes":
            return confirmAll(base, book)
        case "no": {
            const last = state.cards.at(-1)
            if (!last) return done({ awaiting: null }, R.cancelled)
            if (parsed.amount !== null) {
                const cards = state.cards.map((c) => (c === last ? { ...c, amount: parsed.amount } : c))
                return done({ cards }, prompt(cards, book, lang))
            }
            // "Phir se?" -> "nahi": he does not want it again, so the card goes.
            if (cardWarn(last, book) === "duplicate") {
                const cards = state.cards.filter((c) => c !== last)
                return done({ cards, awaiting: null }, cards.length ? prompt(cards, book, lang) : R.cancelled)
            }
            return done({ awaiting: { type: "amount", cardId: last.id } }, R.howMuch)
        }
        case "amount": {
            const last = state.cards.at(-1)
            if (!last) return { state: base, say: "", effects: [], handled: false }
            const cards = state.cards.map((c) => (c === last ? { ...c, amount: parsed.amount } : c))
            return done({ cards, awaiting: null }, prompt(cards, book, lang))
        }
        case "undo":
            // A mistake in what he just said: drop that card first, before touching anything saved.
            if (state.cards.length) {
                const cards = state.cards.slice(0, -1)
                return done({ cards, awaiting: null }, cards.length ? prompt(cards, book, lang) : R.cancelled)
            }
            return book.lastSaved ? done({}, R.undone(book.lastSaved), [{ type: "undo" }]) : done({}, R.nothingToUndo)
        case "ask": {
            if (parsed.question === "missed") {
                const names = book.unpaid
                return done({}, names.length ? R.missed(names.slice(0, 5), names.length) : R.noneMissed, [], { show: "unpaid" })
            }
            if (parsed.question === "cash") {
                const total = book.collectionToday + book.rechargeCashToday
                return done({}, R.cash(total, book.collectionToday, book.rechargeCashToday))
            }
            const m = parsed.match
            if (m?.status === "hit") return done({}, (m.row.owes ?? 0) > 0 ? R.owed(m.row.name, m.row.owes!) : R.owesNothing(m.row.name))
            return { state: base, say: "", effects: [], handled: false }
        }
        case "close_day": {
            if (book.lockedToday) return done({}, R.dayLocked)
            const expected = book.collectionToday + book.rechargeCashToday
            return done({ awaiting: { type: "close_count", expected } }, R.closeAsk(expected))
        }
        default:
            return { state: base, say: "", effects: [], handled: false }
    }
}

/** A tap on a card (name, kind, network, amount, remove): the same changes the voice makes. */
export function editCard(state: EngineState, id: string, patch: Partial<VoiceCard> | "remove", book: VoiceBook): { state: EngineState; say: string; effects: Effect[] } {
    const effects: Effect[] = []
    const cards =
        patch === "remove"
            ? state.cards.filter((c) => c.id !== id)
            : state.cards.map((c) => {
                  if (c.id !== id) return c
                  if (patch.who && patch.who.id !== c.who?.id) {
                      const alias = aliasFor(c, patch.who)
                      if (alias) effects.push({ type: "alias", customerId: patch.who.id, alias })
                      return { ...chooseWho(c, patch.who), ...patch, options: [] }
                  }
                  return { ...c, ...patch }
              })
    const next = { ...state, cards, awaiting: null }
    return { state: next, say: cards.length ? prompt(cards, book, state.lang) : "", effects }
}

/** "haan", or the Save button: saves every open card once nothing is left to ask. */
export function confirmAll(state: EngineState, book: VoiceBook): Step {
    const R = REPLIES[state.lang]
    const done = (s: Partial<EngineState>, say: string, effects: Effect[] = []): Step => ({ state: { ...state, ...s }, say, effects, handled: true })
    if (!state.cards.length) return done({}, R.nothingPending)
    if (state.cards.some((c) => cardNeed(c, book))) return done({}, `${R.needsFirst} ${prompt(state.cards, book, state.lang)}`)
    if (book.lockedToday && state.cards.some((c) => c.date === book.today)) return done({ cards: [] }, R.dayLocked)
    return done({ cards: [], awaiting: null }, R.saved(state.cards.length), [{ type: "save", cards: state.cards }])
}

/** A card made by hand (picked from the list and typed): what he would have said. */
export function addCard(state: EngineState, who: Who, amount: number, book: VoiceBook): { state: EngineState; say: string; effects: Effect[] } {
    const card: VoiceCard = {
        id: cardId(),
        who,
        options: [],
        heard: who.name,
        amount,
        kind: who.kind === "person" ? "payback" : (who.owes ?? 0) > 0 ? null : "deposit",
        date: book.today,
        provider: null,
        stock: null,
    }
    const cards = [...state.cards, card]
    return { state: { ...state, cards, awaiting: null }, say: prompt(cards, book, state.lang), effects: [] }
}
