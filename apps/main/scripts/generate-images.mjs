// Generates the app icon options and the auth-screen illustrations with OpenAI, saves them under
// public/, and writes a .webp next to every .png.
//
//   pnpm images                     # everything not generated yet
//   pnpm images auth-pin icon-b     # only these (by name, see JOBS)
//   pnpm images --force             # redo even if the file exists
//   pnpm images --model gpt-image-1.5 --quality medium
//
// Reads OPENAI_API_KEY from apps/main/.env. WebP needs cwebp (brew install webp).
import fs from "node:fs"
import path from "node:path"
import { execFileSync } from "node:child_process"
import { fileURLToPath } from "node:url"

const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const pub = path.join(app, "public")

const STYLE = [
    "Modern cartoon illustration, cool and playful: bold clean shapes, thick confident outlines,",
    "soft subtle grain texture, gentle shading, slightly exaggerated friendly proportions.",
    "Strict palette: saffron orange #c8611f, warm cream #faf6ee, light sand #f3ecdf, deep brown #2a2118,",
    "a touch of leaf green #2f8a57 and a little violet #6b5bd2 for sparkle.",
    "Absolutely no text, letters, numbers or logos anywhere in the image.",
].join(" ")

const HERO =
    "The same main character in every scene: a cheerful Nepali man in his late 50s, short grey moustache, " +
    "a Dhaka topi cap, cream kurta with a brown waistcoat, a cross-body cloth satchel and a small " +
    "red-bound ledger book. He is a daily-savings collector who walks his market route every day."

const SCENE = `${STYLE} ${HERO} Isolated subject on a transparent background, no frame, no ground shadow box, centred with generous empty margin.`

const ICON =
    "App icon for 'Sajilo', a friendly money-collection app for a Nepali savings collector. " +
    "Square 1024x1024 artwork filling the whole canvas edge to edge (no rounded corners, no outer border, " +
    "the OS will mask it). Simple, bold, readable at 48px. Palette: saffron #c8611f, cream #faf6ee, " +
    "deep brown #2a2118, a hint of violet #6b5bd2. Cartoon-modern, soft depth, no small details, no text except where asked."

/** name -> output path (without extension), prompt and options */
const JOBS = {
    "icon-a": {
        out: "brand/icon-options/icon-a",
        size: "1024x1024",
        background: "opaque",
        prompt: `${ICON} A bold cream Devanagari letter स centred on a rich saffron gradient tile, with a small shiny gold coin tucked at its lower right, gentle 3D bevel.`,
    },
    "icon-b": {
        out: "brand/icon-options/icon-b",
        size: "1024x1024",
        background: "opaque",
        prompt: `${ICON} A chunky cartoon clay piggy-bank style coin pot (Nepali gagri shape) in saffron with a cream coin dropping in, on a cream background. No letters.`,
    },
    "icon-c": {
        out: "brand/icon-options/icon-c",
        size: "1024x1024",
        background: "opaque",
        prompt: `${ICON} An open red-bound ledger book seen from slightly above with a big green tick mark on the page and a coin beside it, on a saffron background. No letters.`,
    },
    "icon-d": {
        out: "brand/icon-options/icon-d",
        size: "1024x1024",
        background: "opaque",
        prompt: `${ICON} A glowing round orb with a warm radial gradient (cream highlight, saffron body, violet rim glow) floating on a deep brown background, with a tiny cream स letter subtly inside it.`,
    },
    "auth-welcome": {
        out: "images/auth/welcome",
        size: "1536x1024",
        background: "transparent",
        prompt: `${SCENE} He waves hello warmly with one hand, holding his ledger in the other, a small cluster of shop awnings and marigold garlands softly behind him. Welcoming, morning light mood.`,
    },
    "auth-phone": {
        out: "images/auth/phone",
        size: "1536x1024",
        background: "transparent",
        prompt: `${SCENE} He holds up a simple smartphone and looks at it with a confident smile, a small speech-bubble shape with a phone-handset icon floating beside him (no text).`,
    },
    "auth-pin": {
        out: "images/auth/pin",
        size: "1536x1024",
        background: "transparent",
        prompt: `${SCENE} He holds a big friendly cartoon padlock / shield in saffron and cream next to his ledger, four small round dots floating above it like a PIN, safe and secure feeling.`,
    },
    "auth-name": {
        out: "images/auth/name",
        size: "1536x1024",
        background: "transparent",
        prompt: `${SCENE} He proudly points to himself with a thumb, a blank name tag pinned on his waistcoat, a few sparkles around him. Happy introduction mood.`,
    },
    "auth-confirm": {
        out: "images/auth/confirm",
        size: "1536x1024",
        background: "transparent",
        prompt: `${SCENE} He double-checks his ledger with a pencil behind his ear, a large green tick bubble floating next to him. Careful but cheerful.`,
    },
    "auth-done": {
        out: "images/auth/done",
        size: "1536x1024",
        background: "transparent",
        prompt: `${SCENE} He celebrates with both arms up, coins and marigold petals bursting around him like confetti, a small glowing saffron-violet orb (his AI helper Munshi) floating at his shoulder.`,
    },
}

const args = process.argv.slice(2)
const flag = (name, fallback) => {
    const i = args.indexOf(`--${name}`)
    return i >= 0 ? args[i + 1] : fallback
}
const force = args.includes("--force")
const model = flag("model", "gpt-image-2")
const quality = flag("quality", "high")
const flagValues = new Set(["--model", "--quality"].map((f) => flag(f.slice(2))).filter(Boolean))
const picked = args.filter((a) => !a.startsWith("--") && !flagValues.has(a))

const unknown = picked.filter((n) => !JOBS[n])
if (unknown.length) {
    console.error(`Unknown: ${unknown.join(", ")}. Choose from: ${Object.keys(JOBS).join(", ")}`)
    process.exit(1)
}
if (!process.env.OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY is not set. Run with `pnpm images` (loads apps/main/.env).")
    process.exit(1)
}

let cwebp = true
try {
    execFileSync("cwebp", ["-version"], { stdio: "ignore" })
} catch {
    cwebp = false
    console.warn("cwebp not found - PNGs only. Install with `brew install webp` and re-run to add .webp.")
}

async function generate(job, background) {
    const res = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        body: JSON.stringify({ model, prompt: job.prompt, size: job.size, quality, background, output_format: "png", n: 1 }),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
        const message = body?.error?.message ?? `HTTP ${res.status}`
        // Transparent backgrounds are still in preview on some models; fall back to the app's cream.
        if (background === "transparent" && /background|transparent/i.test(message)) {
            console.warn(`  transparent not supported on ${model}, retrying on cream`)
            return generate({ ...job, prompt: job.prompt.replace("on a transparent background", "on a plain flat warm cream #faf6ee background") }, "opaque")
        }
        throw new Error(message)
    }
    const b64 = body?.data?.[0]?.b64_json
    if (!b64) throw new Error("No image in the response")
    return Buffer.from(b64, "base64")
}

function toWebp(png) {
    if (!cwebp) return
    const webp = png.replace(/\.png$/, ".webp")
    execFileSync("cwebp", ["-quiet", "-q", "85", "-m", "6", "-alpha_q", "100", png, "-o", webp])
    return webp
}

const kb = (f) => `${Math.round(fs.statSync(f).size / 1024)} KB`

const names = picked.length ? picked : Object.keys(JOBS)
const todo = names.filter((n) => force || !fs.existsSync(path.join(pub, `${JOBS[n].out}.png`)))
const skipped = names.filter((n) => !todo.includes(n))
if (skipped.length) console.log(`Already there (use --force to redo): ${skipped.join(", ")}`)
if (!todo.length) {
    for (const n of skipped) {
        const png = path.join(pub, `${JOBS[n].out}.png`)
        if (cwebp && !fs.existsSync(png.replace(/\.png$/, ".webp"))) toWebp(png)
    }
    process.exit(0)
}

console.log(`Generating ${todo.length} with ${model} (${quality}): ${todo.join(", ")}`)

let failed = 0
const queue = [...todo]
async function worker() {
    for (let name = queue.shift(); name; name = queue.shift()) {
        const job = JOBS[name]
        const png = path.join(pub, `${job.out}.png`)
        try {
            const buf = await generate(job, job.background)
            fs.mkdirSync(path.dirname(png), { recursive: true })
            fs.writeFileSync(png, buf)
            const webp = toWebp(png)
            console.log(`✓ ${name}  public/${job.out}.png (${kb(png)})${webp ? ` + .webp (${kb(webp)})` : ""}`)
        } catch (e) {
            failed++
            console.error(`✗ ${name}: ${e.message}`)
        }
    }
}
await Promise.all([worker(), worker(), worker()])
if (failed) process.exit(1)
