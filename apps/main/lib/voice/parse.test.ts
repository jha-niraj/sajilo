import { describe, expect, it } from "vitest"
import { findNumbers, parseAmount, tokenize } from "./numbers"
import { matchName, soundKey, toLatin } from "./names"
import { detectLang, parseUtterance, type Parsed, type Who } from "./parse"

const TODAY = "2026-11-13" // a Friday

const PEOPLE: Who[] = [
    { kind: "customer", id: "c1", name: "Ram Bahadur", daily: 500 },
    { kind: "customer", id: "c2", name: "Ram Babu", daily: 200 },
    { kind: "customer", id: "c3", name: "Ramesh", daily: 100, owes: 200 },
    { kind: "customer", id: "c4", name: "Sita Devi", daily: 200 },
    { kind: "customer", id: "c5", name: "Sita Kumari", daily: 300 },
    { kind: "customer", id: "c6", name: "Mohan", daily: 100 },
    { kind: "customer", id: "c7", name: "Mohan Lal", daily: 1000 },
    { kind: "customer", id: "c8", name: "राजेश किराना", daily: 500, aliases: ["Rajesh dukan"] },
    { kind: "person", id: "p1", name: "Bikash", owes: 300 },
]

const parse = (text: string) => parseUtterance({ text, people: PEOPLE, today: TODAY })
const entries = (p: Parsed) => (p.type === "entries" ? p.entries : [])
const hitId = (p: Parsed, i = 0) => {
    const m = entries(p)[i]?.match
    return m?.status === "hit" ? m.row.id : m?.status
}

describe("numbers", () => {
    it.each([
        ["500", 500],
        ["५००", 500],
        ["1,500", 1500],
        ["paanch saya", 500],
        ["paanch sau", 500],
        ["pachas", 50],
        ["do sau pachas", 250],
        ["ek sau", 100],
        ["dedh sau", 150],
        ["dedh hazar", 1500],
        ["dhai saya", 250],
        ["sawa sau", 125],
        ["saadhe teen sau", 350],
        ["paune do sau", 175],
        ["2 hazar 500", 2500],
        ["paanch hazar paanch sau", 5500],
        ["das hazar", 10000],
        ["ek lakh", 100000],
        ["पाँच सय", 500],
        ["दुई सय पचास", 250],
        ["पाँच सौ", 500],
        ["डेढ़ हजार", 1500],
        ["दस हज़ार", 10000],
        ["five hundred", 500],
        ["two thousand", 2000],
        ["chhe saya", 600],
        ["रु ५००", 500],
        ["500rs", 500],
    ])("%s = %d", (text, n) => expect(parseAmount(text)).toBe(n))

    it("two amounts side by side stay two", () => {
        expect(findNumbers(tokenize("500 200")).map((s) => s.value)).toEqual([500, 200])
    })
    it("everyday words are not numbers", () => {
        expect(parseAmount("thik chha")).toBeNull()
        expect(parseAmount("do it")).toBeNull()
        expect(parseAmount("thik chhai")).toBeNull()
    })
})

describe("names", () => {
    it("reads Devanagari", () => {
        expect(toLatin("राम")).toBe("raam")
        expect(toLatin("राम बहादुर")).toBe("raam bahaadur")
        expect(toLatin("सीता")).toBe("siitaa")
    })
    it("spellings share a key", () => {
        expect(soundKey("Raam Bahaadur")).toBe(soundKey("Ram Bahadur"))
        expect(soundKey("राम बहादुर")).toBe(soundKey("Ram Bahadur"))
        expect(soundKey("Seeta")).toBe(soundKey("Sita"))
        expect(soundKey("Bikas")).toBe(soundKey("Bikash"))
        expect(soundKey("Vikash")).toBe(soundKey("Bikash"))
    })
    it("full name wins, first name alone is ambiguous", () => {
        const m = matchName(["sita"], PEOPLE)
        expect(m.status).toBe("ambiguous")
        expect(m.status === "ambiguous" && m.options.map((o) => o.id).sort()).toEqual(["c4", "c5"])
        expect(matchName(["mohan"], PEOPLE)).toMatchObject({ status: "hit", row: { id: "c6" } })
        expect(matchName(["xyz", "abc"], PEOPLE).status).toBe("none")
    })
    it("aliases match", () => {
        expect(matchName(["rajesh", "dukan"], PEOPLE)).toMatchObject({ status: "hit", row: { id: "c8" } })
    })
})

describe("entries", () => {
    it.each([
        ["Ram Bahadur paanch saya", "c1", 500],
        ["Ram Bahadur ko 500", "c1", 500],
        ["राम बहादुर पाँच सय", "c1", 500],
        ["राम बहादुर ने पाँच सौ दिया", "c1", 500],
        ["Raam Bahaadur 500 rupaiya jama", "c1", 500],
        ["Ram Babu ne do sau diya", "c2", 200],
        ["Sita Devi ko dui saya", "c4", 200],
        ["Mohan Lal ek hazar", "c7", 1000],
        ["Mohan 100", "c6", 100],
        ["500 Ram Bahadur", "c1", 500],
        ["Ram Bahadur delak paanch say", "c1", 500],
        ["राजेश किराना ५००", "c8", 500],
        ["Rajesh kirana 500", "c8", 500],
    ])("%s", (text, id, amount) => {
        const p = parse(text)
        expect(p.type).toBe("entries")
        expect(hitId(p)).toBe(id)
        expect(entries(p)[0]!.amount).toBe(amount)
        expect(entries(p)[0]!.kind).toBe("deposit")
    })

    it("several in one breath", () => {
        const p = parse("Ram Bahadur 500, Sita Devi 200 aur Mohan 100")
        expect(entries(p).map((e) => [e.match.status === "hit" ? e.match.row.id : null, e.amount])).toEqual([
            ["c1", 500],
            ["c4", 200],
            ["c6", 100],
        ])
    })

    it("asks which Sita", () => {
        const p = parse("Sita 200")
        expect(entries(p)[0]!.match.status).toBe("ambiguous")
    })

    it("unknown name is kept so he can add it", () => {
        const p = parse("Gopal 300")
        expect(entries(p)[0]!.match.status).toBe("none")
        expect(entries(p)[0]!.heard).toBe("gopal")
    })

    it("udharo and recharge", () => {
        const p = parse("Ramesh ko 200 ka recharge udhaar")
        expect(entries(p)[0]).toMatchObject({ kind: "credit", amount: 200, provider: null })
        expect(entries(parse("Bikash lai ncell 100 udharo"))[0]).toMatchObject({ kind: "credit", provider: "ncell", amount: 100 })
        expect(entries(parse("Mohan ntc card 500 udhaar"))[0]).toMatchObject({ kind: "credit", provider: "ntc", stock: "card" })
    })

    it("payback", () => {
        expect(entries(parse("Ramesh ne 100 wapas diya"))[0]).toMatchObject({ kind: "payback", amount: 100 })
        expect(entries(parse("रमेशले १०० फिर्ता गर्यो"))[0]?.kind).toBe("payback")
        // only owes udharo, not a customer
        expect(entries(parse("Bikash ne 100 diya"))[0]).toMatchObject({ kind: "payback" })
        // a customer who also owes udharo, no word said: ask
        expect(entries(parse("Ramesh ne 100 diya"))[0]!.kind).toBeNull()
    })

    it("shop closed and no money", () => {
        expect(entries(parse("Mohan ko pasal band"))[0]).toMatchObject({ kind: "shop_closed", amount: null })
        expect(entries(parse("Sita Devi ke paas paisa nahi"))[0]).toMatchObject({ kind: "no_money" })
    })

    it("yesterday and weekdays", () => {
        expect(parse("kal Ram Bahadur 500")).toMatchObject({ date: "2026-11-12" })
        expect(parse("hijo Ram Bahadur 500")).toMatchObject({ date: "2026-11-12" })
        expect(parse("budhbar Ram Bahadur 500")).toMatchObject({ date: "2026-11-11" })
        expect(parse("Ram Bahadur 500")).toMatchObject({ date: TODAY })
    })
})

describe("replies and commands", () => {
    it.each(["haan", "ho", "thik chha", "ठीक है", "हुन्छ", "yes", "haan ji", "thik chhai", "हो"])("yes: %s", (t) => expect(parse(t).type).toBe("yes"))
    it.each(["nahi", "hoina", "no", "नहीं", "नै", "galat"])("no: %s", (t) => expect(parse(t)).toEqual({ type: "no", amount: null }))
    it("correction", () => {
        expect(parse("nahi, chhe saya")).toEqual({ type: "no", amount: 600 })
        expect(parse("होइन, ७००")).toEqual({ type: "no", amount: 700 })
    })
    it.each(["galti", "गल्ती", "undo"])("undo: %s", (t) => expect(parse(t).type).toBe("undo"))
    it("a bare amount", () => expect(parse("chaar hazar teen sau pachas")).toEqual({ type: "amount", amount: 4350 }))
    it.each(["aaj kisne nahi diya", "kasle diena aaja", "आज किसने नहीं दिया", "who hasn't paid today"])("missed: %s", (t) =>
        expect(parse(t)).toMatchObject({ type: "ask", question: "missed" }),
    )
    it.each(["kitna paisa hona chahiye", "aaja kati paisa hunuparne", "कति पैसा छ"])("cash: %s", (t) =>
        expect(parse(t)).toMatchObject({ type: "ask", question: "cash" }),
    )
    it("owed by one person", () => {
        const p = parse("Ramesh ka kitna baaki hai")
        expect(p).toMatchObject({ type: "ask", question: "owed" })
        expect(p.type === "ask" && p.match?.status === "hit" && p.match.row.id).toBe("c3")
    })
    it.each(["din band karo", "aaj ko hisab band", "दिन बन्द गर", "close the day"])("close: %s", (t) => expect(parse(t).type).toBe("close_day"))
    it("noise", () => {
        expect(parse("").type).toBe("unknown")
        expect(parse("umm ah").type).toBe("unknown")
    })
})

describe("language", () => {
    it.each([
        ["Ram Bahadur ne paanch sau diya", "hi"],
        ["राम बहादुरले पाँच सय दियो", "ne"],
        ["Ram Bahadur paanch saya delak", "mai"],
        ["Ram Bahadur paid five hundred", "en"],
        ["kati paisa chha", "ne"],
        ["kitna paisa hai", "hi"],
    ] as const)("%s -> %s", (text, lang) => expect(detectLang(text, "hi")).toBe(lang))
})
