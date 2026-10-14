/* global process */
// Runs after `opennextjs-cloudflare build`. OpenNext copies every value from .env and
// .env.production into the Worker code (.open-next/cloudflare/next-env.mjs) as a fallback for
// process.env, which would ship the dev .env and every key inside the bundle. The real values come
// from Worker secrets (`wrangler deploy --secrets-file .env.production`), so keep NEXT_PUBLIC_* only
// (already inlined by `next build` anyway). Prints key counts, never values.
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const file = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.open-next/cloudflare/next-env.mjs")

if (!fs.existsSync(file)) {
    console.error("Run `opennextjs-cloudflare build` first (.open-next/cloudflare/next-env.mjs not found).")
    process.exit(1)
}

const { production = {} } = await import(pathToFileURL(file).href)
const publicOnly = Object.fromEntries(Object.entries(production).filter(([k]) => k.startsWith("NEXT_PUBLIC_")))
fs.writeFileSync(file, ["production", "development", "test"].map((m) => `export const ${m} = ${JSON.stringify(publicOnly)};\n`).join(""))
console.log(`Removed ${Object.keys(production).length - Object.keys(publicOnly).length} env values from the Worker bundle; kept ${Object.keys(publicOnly).length} NEXT_PUBLIC_*.`)
