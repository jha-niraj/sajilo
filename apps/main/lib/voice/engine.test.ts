import { describe, expect, it } from "vitest"
import { editCard, handle, initialState, type EngineState, type VoiceBook } from "./engine"
import type { Who } from "./parse"

const people: Who[] = [
    { kind: "customer", id: "c1", name: "Ram Bahadur", daily: 500 },
    { kind: "customer", id: "c2", name: "Ram Babu", daily: 200 },
    { kind: "customer", id: "c3", name: "Ramesh", daily: 100, owes: 200 },
    { kind: "customer", id: "c4", name: "Sita Devi", daily: 200 },
    { kind: "customer", id: "c5", name: "Sita Kumari", daily: 300 },
    { kind: "person", id: "p1", name: "Bikash", owes: 300 },
]
const book = (over: Partial<VoiceBook> = {}): VoiceBook => ({
    today: "2026-11-13",
    lockedToday: false,
    people,
    marks: {},
    unpaid: ["Sita Kumari", "Mohan Lal"],
    collectionToday: 3900,
    rechargeCashToday: 450,
    stock: { "ntc:eload": 9000, "ntc:card": 0, "ncell:eload": 4700, "ncell:card": 0 },
    lastSaved: null,
    ...over,
})

function run(texts: string[], b = book(), start: EngineState = initialState("hi")) {
    let s = start
    const out: ReturnType<typeof handle>[] = []
    for (const t of texts) {
        const step = handle(s, t, b)
        out.push(step)
        s = step.state
    }
    return out
}

describe("voice loop", () => {
    it("deposit: say it, hear it back, haan saves", () => {
        const [a, b] = run(["Ram Bahadur paanch sau", "haan"])
        expect(a!.say).toContain("Ram Bahadur, 500 जमा")
        expect(a!.state.cards).toHaveLength(1)
        expect(b!.effects[0]).toMatchObject({ type: "save" })
        expect(b!.state.cards).toHaveLength(0)
    })

    it("nahi then a new amount", () => {
        const [, b, c] = run(["Ram Bahadur 500", "nahi", "chhe sau"])
        expect(b!.say).toBe("कितना?")
        expect(c!.state.cards[0]!.amount).toBe(600)
    })

    it("two at once, one haan", () => {
        const [a, b] = run(["Ram Bahadur 500, Sita Devi 200", "haan"])
        expect(a!.say).toContain("2 एंट्री, कुल 700")
        expect(b!.effects[0]).toMatchObject({ type: "save" })
        expect((b!.effects[0] as { cards: unknown[] }).cards).toHaveLength(2)
    })

    it("asks which Sita, answer by name, learns nothing when the name is exact", () => {
        const [a, b] = run(["Sita 200", "Sita Kumari"])
        expect(a!.say).toContain("Sita Devi या Sita Kumari?")
        expect(b!.state.cards[0]!.who?.id).toBe("c5")
        expect(b!.effects).toEqual([])
    })

    it("an unknown name, then the right one, is learned as an alias", () => {
        const [a, b] = run(["Kancha 500", "Ram Bahadur"])
        expect(a!.say).toContain("लिस्ट में नहीं")
        expect(b!.state.cards[0]!.who?.id).toBe("c1")
        expect(b!.effects).toEqual([{ type: "alias", customerId: "c1", alias: "kancha" }])
    })

    it("deposit or payback for someone who is both", () => {
        const [a, b] = run(["Ramesh ne 100 diya", "jama"])
        expect(a!.say).toContain("जमा या उधार वापस")
        expect(b!.state.cards[0]!.kind).toBe("deposit")
    })

    it("udharo asks for the network, then checks stock", () => {
        const [a, b] = run(["Ramesh ko 200 ka recharge udhaar", "NTC load"])
        expect(a!.say).toContain("NTC या Ncell")
        expect(b!.state.cards[0]).toMatchObject({ provider: "ntc", stock: "eload" })
        const [, , c] = run(["Ramesh ko 200 ka recharge udhaar", "ntc card", "haan"])
        expect(c!.effects).toEqual([])
        expect(c!.say).toContain("स्टॉक")
    })

    it("warns on a repeat and on an odd amount", () => {
        const [a] = run(["Ram Bahadur 500"], book({ marks: { c1: { status: "paid", amount: 500 } } }))
        expect(a!.say).toContain("पहले ही सेव")
        const [b] = run(["Ram Babu 5000"])
        expect(b!.say).toContain("पक्का")
    })

    it("answers from the book", () => {
        expect(run(["aaj kisne nahi diya"])[0]!.say).toContain("Sita Kumari, Mohan Lal")
        expect(run(["kitna paisa hona chahiye"])[0]!.say).toContain("4,350")
        expect(run(["Bikash ka kitna baaki hai"])[0]!.say).toContain("300")
    })

    it("closes the day after the count", () => {
        const [a, b, c] = run(["din band karo", "chaar hazar teen sau", "haan"])
        expect(a!.say).toContain("4,350")
        expect(b!.say).toContain("50 कम")
        expect(c!.effects).toEqual([{ type: "close", date: "2026-11-13", counted: 4300 }])
    })

    it("nahi to a repeat drops it; galti drops an unsaved card first", () => {
        const b = book({ marks: { c1: { status: "paid", amount: 500 } }, lastSaved: "Ram Bahadur 500" })
        const [, n] = run(["Ram Bahadur 500", "nahi"], b)
        expect(n!.state.cards).toHaveLength(0)
        const [, g] = run(["Ram Babu 200", "galti"], b)
        expect(g!.state.cards).toHaveLength(0)
        expect(g!.effects).toEqual([])
    })

    it("galti undoes the last save", () => {
        const [a] = run(["galti"], book({ lastSaved: "Ram Bahadur 500" }))
        expect(a!.effects).toEqual([{ type: "undo" }])
        expect(run(["galti"])[0]!.say).toContain("कुछ नहीं")
    })

    it("replies in the language he spoke", () => {
        expect(run(["राम बहादुरले पाँच सय दियो"])[0]!.say).toContain("ठिक छ?")
        expect(run(["Ram Bahadur paid five hundred"])[0]!.say).toContain("Okay?")
    })

    it("anything else goes to the agent", () => {
        expect(run(["what is the weather"])[0]!.handled).toBe(false)
    })

    it("tapping a name on the card", () => {
        const s = run(["Sita 200"])[0]!.state
        const out = editCard(s, s.cards[0]!.id, { who: people[4]! }, book())
        expect(out.state.cards[0]!.who?.id).toBe("c5")
        expect(out.say).toContain("Sita Kumari, 200")
    })
})
