import { describe, expect, it } from "vitest"
import { replyParts, stripMarkdown } from "./plain-text"

describe("stripMarkdown", () => {
    it("keeps the words and drops the markup", () => {
        expect(stripMarkdown("आज कुल **Rs 1,350** सङ्कलन")).toBe("आज कुल Rs 1,350 सङ्कलन")
        expect(stripMarkdown("## Today\n* Ram Kirana\n* Sita")).toBe("Today\n- Ram Kirana\n- Sita")
        expect(stripMarkdown("this is *really* `done`")).toBe("this is really done")
        expect(stripMarkdown("stray ** here")).toBe("stray  here")
        expect(stripMarkdown("2 * 3 = 6")).toBe("2 * 3 = 6")
    })
})

describe("replyParts", () => {
    it("marks bold runs", () => {
        expect(replyParts("Total **Rs 1,350** today")).toEqual([
            { text: "Total ", bold: false },
            { text: "Rs 1,350", bold: true },
            { text: " today", bold: false },
        ])
    })

    it("leaves an unfinished bold (still streaming) as plain text without stars", () => {
        expect(replyParts("Total **Rs 1,3")).toEqual([{ text: "Total Rs 1,3", bold: false }])
    })
})
