// Renders pitch/deck.html to pitch/Sajilo-pitch-deck.pdf (and PNG previews with --png).
// Run from the repo root: node pitch/render.mjs [--png]
import { chromium } from "playwright"
import { pathToFileURL } from "node:url"
import { resolve } from "node:path"
const deck = resolve("pitch/deck.html")
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1280, height: 720 } })
await p.goto(pathToFileURL(deck).href, { waitUntil: "networkidle" })
await p.evaluate(() => document.fonts.ready)
await p.pdf({ path: resolve("pitch/Sajilo-pitch-deck.pdf"), width: "1280px", height: "720px", printBackground: true })
if (process.argv.includes("--png")) {
    await p.emulateMedia({ media: "print" })
    const slides = await p.locator(".slide").all()
    for (const [i, s] of slides.entries()) await s.screenshot({ path: resolve(`pitch/.preview/slide-${i + 1}.png`) })
}
await b.close()
console.log("ok")
