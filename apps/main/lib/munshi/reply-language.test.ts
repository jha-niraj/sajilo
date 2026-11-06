import { describe, expect, it } from "vitest"
import { replyLanguage, replyLanguageRule } from "./reply-language"

describe("replyLanguage", () => {
    it.each([
        ["Mohan Dairy lai naya customer thapa, daily 250", "ne-roman"],
        ["aaja kasle tiryo?", "ne-roman"],
        ["kati baki cha", "ne-roman"],
        ["Ram Kirana le 200 diyo", "ne-roman"],
        ["Shyam ko rin kati cha", "ne-roman"],
        ["आज कसले तिरेन?", "ne"],
        ["Who has not paid today?", "en"],
        ["Add Mohan Dairy as a new customer, 250 daily", "en"],
        ["How much is still out in loans?", "en"],
    ])("%s -> %s", (text, want) => {
        expect(replyLanguage(text)).toBe(want)
    })

    it("speaks Devanagari for Roman Nepali in voice", () => {
        expect(replyLanguageRule("ne-roman", true)).toContain("Devanagari")
        expect(replyLanguageRule("ne-roman", false)).toContain("Roman Nepali")
    })
})
