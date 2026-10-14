/* global process, Buffer */
// Generates ONE app icon image with OpenAI: an abstract, full-bleed maskable mark.
// Saves public/brand/icon-source.png (+ .webp). Refuses to overwrite unless --force, so a stray
// re-run never spends credit. Then run `pnpm icon:build` (free) for every size and favicon.ico.
//
//   pnpm icon                      # medium quality (cheapest that still looks good)
//   pnpm icon --quality high       # costs more
//   pnpm icon --force              # replace the existing source
import fs from "node:fs"
import path from "node:path"
import { execFileSync } from "node:child_process"
import { fileURLToPath } from "node:url"

const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const out = path.join(app, "public/brand/icon-source.png")

const args = process.argv.slice(2)
const flag = (name, fallback) => {
    const i = args.indexOf(`--${name}`)
    return i >= 0 ? args[i + 1] : fallback
}
const model = flag("model", "gpt-image-2")
const quality = flag("quality", "medium")

const PROMPT = [
    "A premium mobile app icon, square 1024x1024, designed as a MASKABLE icon.",
    "Full bleed: the background fills the entire canvas edge to edge - no border, no frame, no rounded corners,",
    "no inner square or tile, no margin. Background: a rich, smooth warm saffron gradient, lighter #dd7a35 at the",
    "top left to deep amber #b4501a at the bottom right, with a very soft glow behind the centre.",
    "In the centre, kept entirely inside the middle 60% of the canvas (the safe zone of a circle mask), one single",
    "abstract mark: a soft, flowing, organic form made of two or three overlapping rounded shapes, like smooth",
    "petals or ribbons folding into each other, in warm cream #faf6ee with gentle depth, a soft inner light and a",
    "subtle violet #6b5bd2 glow where the shapes overlap.",
    "It must NOT be a letter, number, word, symbol, coin, object, animal or anything recognisable - purely abstract.",
    "Bold, calm, minimal, balanced, readable at 32px. No text anywhere.",
].join(" ")

if (fs.existsSync(out) && !args.includes("--force")) {
    console.log("public/brand/icon-source.png already exists - not spending credit. Use --force to replace it.")
    process.exit(0)
}
if (!process.env.OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY is not set. Run with `pnpm icon` (loads apps/main/.env).")
    process.exit(1)
}

console.log(`Generating 1 icon with ${model} (${quality})...`)
const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model, prompt: PROMPT, size: "1024x1024", quality, background: "opaque", output_format: "png", n: 1 }),
})
const body = await res.json().catch(() => ({}))
if (!res.ok) {
    console.error(`OpenAI: ${body?.error?.message ?? `HTTP ${res.status}`}`)
    process.exit(1)
}
const b64 = body?.data?.[0]?.b64_json
if (!b64) {
    console.error("No image in the response")
    process.exit(1)
}

fs.mkdirSync(path.dirname(out), { recursive: true })
fs.writeFileSync(out, Buffer.from(b64, "base64"))
try {
    execFileSync("cwebp", ["-quiet", "-q", "90", out, "-o", out.replace(/\.png$/, ".webp")])
} catch {
    console.warn("cwebp not found - skipped the .webp (brew install webp)")
}
console.log("✓ public/brand/icon-source.png - check it, then run `pnpm icon:build`")
