import "server-only"

const BASE = "https://api.sarvam.ai"

function key(): string {
    const k = process.env.SARVAM_API_KEY
    if (!k) throw new Error("NO_SARVAM")
    return k
}

/** Speech -> text with Saaras v4. `keyterms` bias recognition toward his customers' names. */
export async function transcribe(audio: Blob, lang: "ne" | "en", keyterms: string[]): Promise<{ text: string; language: string | null }> {
    // Browsers label recordings "audio/webm;codecs=opus"; Sarvam only accepts the bare type.
    const type = (audio.type.split(";")[0] || "audio/webm").trim()
    const clean = new Blob([await audio.arrayBuffer()], { type })
    const form = new FormData()
    form.append("file", clean, type.includes("mp4") ? "speech.mp4" : type.includes("ogg") ? "speech.ogg" : "speech.webm")
    form.append("model", "saaras:v4")
    form.append("language_code", lang === "ne" ? "ne-IN" : "unknown")
    // Sarvam refuses the whole request when a keyterm repeats (a customer who is also an udharo person).
    const seen = new Set<string>()
    const terms = keyterms
        .map((k) => k.trim())
        .filter((k) => k && k.length <= 64 && !seen.has(k.toLowerCase()) && seen.add(k.toLowerCase()))
        .slice(0, 50)
    if (terms.length) form.append("keyterms", JSON.stringify(terms))
    const res = await fetch(`${BASE}/speech-to-text`, {
        method: "POST",
        headers: { "api-subscription-key": key() },
        body: form,
        signal: AbortSignal.timeout(30_000),
    })
    if (!res.ok) throw new Error(`stt ${res.status}: ${(await res.text()).slice(0, 200)}`)
    const data = (await res.json()) as { transcript: string; language_code: string | null }
    return { text: data.transcript?.trim() ?? "", language: data.language_code }
}

const DEVANAGARI = /[ऀ-ॿ]/

/**
 * Text -> speech with Bulbul v3. There is no Nepali voice yet, so Devanagari text is read by a
 * Hindi voice (same script); English text uses the English voice.
 */
export async function speak(text: string, voice = "shubh"): Promise<string | null> {
    const clean = text.replace(/[*_`#>]/g, "").replace(/\s+/g, " ").trim().slice(0, 2400)
    if (!clean) return null
    const res = await fetch(`${BASE}/text-to-speech`, {
        method: "POST",
        headers: { "api-subscription-key": key(), "Content-Type": "application/json" },
        body: JSON.stringify({
            text: clean,
            language_code: DEVANAGARI.test(clean) ? "hi-IN" : "en-IN",
            model: "bulbul:v3",
            speaker: voice,
            pace: 1.0,
            speech_sample_rate: 24000,
            output_audio_codec: "mp3",
        }),
        signal: AbortSignal.timeout(30_000),
    })
    if (!res.ok) throw new Error(`tts ${res.status}: ${(await res.text()).slice(0, 200)}`)
    const data = (await res.json()) as { audios: string[] }
    return data.audios?.[0] ?? null
}
