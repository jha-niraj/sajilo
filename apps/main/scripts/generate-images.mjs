/* global process, Buffer */
// Generates the auth-screen illustrations with OpenAI, saves them under public/, and writes a
// .webp next to every .png. The app icon has its own script (generate-icon.mjs).
//
//   pnpm images                     # everything not generated yet
//   pnpm images auth-pin auth-done  # only these (by name, see JOBS)
//   pnpm images --force             # redo even if the file exists
//   pnpm images --model gpt-image-1.5 --quality medium
//   pnpm images --webp              # only rebuild the .webp files from the saved PNGs (no API)
//
// Reads OPENAI_API_KEY from apps/main/.env. Auth art gets its flat cream background cut out, so
// the .webp is transparent and sits on any page colour.
import fs from "node:fs"
import path from "node:path"
import sharp from "sharp"
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

/** name -> output path (without extension), prompt and options */
const JOBS = {
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
const webpOnly = args.includes("--webp")
const model = flag("model", "gpt-image-2")
const quality = flag("quality", "high")
const flagValues = new Set(["--model", "--quality"].map((f) => flag(f.slice(2))).filter(Boolean))
const picked = args.filter((a) => !a.startsWith("--") && !flagValues.has(a))

const unknown = picked.filter((n) => !JOBS[n])
if (unknown.length) {
    console.error(`Unknown: ${unknown.join(", ")}. Choose from: ${Object.keys(JOBS).join(", ")}`)
    process.exit(1)
}
if (!webpOnly && !process.env.OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY is not set. Run with `pnpm images` (loads apps/main/.env).")
    process.exit(1)
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

/**
 * Makes the flat generated background transparent: flood-fill from the edges over pixels within a
 * few levels of the edge colour (so the cream kurta, which only touches the background through its
 * outline, is never eaten), clear larger enclosed pockets of exactly that colour (between arm and
 * body), then feather the edge pixels so the outline stays smooth.
 */
async function cutout(png) {
    const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true })
    const W = info.width
    const H = info.height
    const N = W * H
    const border = []
    for (let x = 0; x < W; x++) border.push(x, (H - 1) * W + x)
    for (let y = 0; y < H; y++) border.push(y * W, y * W + W - 1)
    const bg = [0, 1, 2].map((c) => border.map((i) => data[i * 3 + c]).sort((a, b) => a - b)[border.length >> 1])
    const dist = new Uint8Array(N)
    for (let i = 0; i < N; i++) {
        dist[i] = Math.max(Math.abs(data[i * 3] - bg[0]), Math.abs(data[i * 3 + 1] - bg[1]), Math.abs(data[i * 3 + 2] - bg[2]))
    }
    const NEAR = 8
    const FAR = 40
    const clear = new Uint8Array(N)
    const flood = (seeds, limit) => {
        const stack = seeds.filter((i) => dist[i] <= limit && !clear[i])
        for (const i of stack) clear[i] = 1
        const region = [...stack]
        while (stack.length) {
            const i = stack.pop()
            const x = i % W
            for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) {
                if (j >= 0 && j < N && !clear[j] && dist[j] <= limit) {
                    clear[j] = 1
                    stack.push(j)
                    region.push(j)
                }
            }
        }
        return region
    }
    flood(border, NEAR)
    // Enclosed pockets: only big, near-exact matches, so small light details stay.
    const seen = new Uint8Array(N)
    for (let i = 0; i < N; i++) {
        if (clear[i] || seen[i] || dist[i] > 3) continue
        const region = flood([i], 3)
        for (const j of region) seen[j] = 1
        if (region.length < 600) for (const j of region) clear[j] = 0
    }
    const rgba = Buffer.alloc(N * 4)
    for (let i = 0; i < N; i++) {
        rgba[i * 4] = data[i * 3]
        rgba[i * 4 + 1] = data[i * 3 + 1]
        rgba[i * 4 + 2] = data[i * 3 + 2]
        let a = 255
        if (clear[i]) a = 0
        else {
            const x = i % W
            const edge = (x > 0 && clear[i - 1]) || (x < W - 1 && clear[i + 1]) || (i >= W && clear[i - W]) || (i + W < N && clear[i + W])
            if (edge) a = Math.round(255 * Math.min(1, Math.max(0, (dist[i] - NEAR) / (FAR - NEAR))))
        }
        rgba[i * 4 + 3] = a
    }
    return sharp(rgba, { raw: { width: W, height: H, channels: 4 } }).trim({ threshold: 0 })
}

/** Auth art is shown at most ~200px tall, so 600px covers 3x screens at a fraction of the size. */
async function toWebp(png) {
    const webp = png.replace(/\.png$/, ".webp")
    const isArt = png.includes(`${path.sep}images${path.sep}auth${path.sep}`)
    const img = isArt ? (await cutout(png)).resize({ height: 600, withoutEnlargement: true }) : sharp(png)
    await img.webp({ quality: 85, alphaQuality: 100, effort: 6 }).toFile(webp)
    return webp
}

const kb = (f) => `${Math.round(fs.statSync(f).size / 1024)} KB`

const names = picked.length ? picked : Object.keys(JOBS)
const todo = names.filter((n) => force || !fs.existsSync(path.join(pub, `${JOBS[n].out}.png`)))
const skipped = names.filter((n) => !todo.includes(n))
if (skipped.length && !webpOnly) console.log(`Already there (use --force to redo): ${skipped.join(", ")}`)
if (webpOnly || !todo.length) {
    for (const n of names) {
        const png = path.join(pub, `${JOBS[n].out}.png`)
        if (!fs.existsSync(png)) continue
        if (webpOnly || !fs.existsSync(png.replace(/\.png$/, ".webp"))) console.log(`✓ ${n}  ${path.relative(pub, await toWebp(png))} (${kb(png.replace(/\.png$/, ".webp"))})`)
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
            const webp = await toWebp(png)
            console.log(`✓ ${name}  public/${job.out}.png (${kb(png)})${webp ? ` + .webp (${kb(webp)})` : ""}`)
        } catch (e) {
            failed++
            console.error(`✗ ${name}: ${e.message}`)
        }
    }
}
await Promise.all([worker(), worker(), worker()])
if (failed) process.exit(1)
