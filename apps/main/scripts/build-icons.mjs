/* global process, Buffer */
// Builds every app icon from one full-bleed square source (no API, free to re-run):
//   public/icons/icon-192.png, icon-512.png, maskable-512.png, apple-touch-icon.png (180),
//   favicon-48.png, and public/favicon.ico (16, 32, 48 inside).
//
//   pnpm icon:build                          # from public/brand/icon-source.png
//   pnpm icon:build path/to/source.png [--out some/dir]
//
// Uses macOS `sips` for resizing.
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { execFileSync } from "node:child_process"
import { fileURLToPath } from "node:url"

const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const args = process.argv.slice(2)
const outIdx = args.indexOf("--out")
const outDir = outIdx >= 0 ? path.resolve(args[outIdx + 1]) : path.join(app, "public")
const source = path.resolve(args.find((a, i) => !a.startsWith("--") && i !== outIdx + 1) ?? path.join(app, "public/brand/icon-source.png"))

if (!fs.existsSync(source)) {
    console.error(`Source not found: ${path.relative(process.cwd(), source)} - run \`pnpm icon\` first.`)
    process.exit(1)
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sajilo-icons-"))
function resize(size, dest) {
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    execFileSync("sips", ["-s", "format", "png", "-z", String(size), String(size), source, "--out", dest], { stdio: "ignore" })
    return dest
}

const icons = path.join(outDir, "icons")
const made = [
    resize(512, path.join(icons, "icon-512.png")),
    resize(192, path.join(icons, "icon-192.png")),
    // The source is already full bleed with the mark inside the safe zone, so it is maskable as is.
    resize(512, path.join(icons, "maskable-512.png")),
    resize(180, path.join(icons, "apple-touch-icon.png")),
    resize(48, path.join(icons, "favicon-48.png")),
]

// ICO with PNG-compressed entries (supported by every current browser and Windows Vista+).
const sizes = [16, 32, 48]
const pngs = sizes.map((s) => fs.readFileSync(resize(s, path.join(tmp, `${s}.png`))))
const header = Buffer.alloc(6)
header.writeUInt16LE(0, 0)
header.writeUInt16LE(1, 2)
header.writeUInt16LE(sizes.length, 4)
let offset = 6 + 16 * sizes.length
const entries = sizes.map((s, i) => {
    const e = Buffer.alloc(16)
    e.writeUInt8(s >= 256 ? 0 : s, 0)
    e.writeUInt8(s >= 256 ? 0 : s, 1)
    e.writeUInt8(0, 2)
    e.writeUInt8(0, 3)
    e.writeUInt16LE(1, 4)
    e.writeUInt16LE(32, 6)
    e.writeUInt32LE(pngs[i].length, 8)
    e.writeUInt32LE(offset, 12)
    offset += pngs[i].length
    return e
})
const ico = path.join(outDir, "favicon.ico")
fs.writeFileSync(ico, Buffer.concat([header, ...entries, ...pngs]))
made.push(ico)
fs.rmSync(tmp, { recursive: true, force: true })

for (const f of made) console.log(`✓ ${path.relative(app, f)} (${Math.round(fs.statSync(f).size / 1024)} KB)`)
