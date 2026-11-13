"use client"

/**
 * Speech on the phone itself, for when there is no signal. Recognition is Chrome's on-device Web
 * Speech (`processLocally`, a Hindi pack he downloads once); replies use the phone's own voice.
 * Facts and limits: plan/phase-5-voice-first.md (Notes).
 */

export type OfflineVoiceStatus = "available" | "downloadable" | "downloading" | "unavailable" | "unsupported"

const LANG = "hi-IN"
const INSTALLED_KEY = "sajilo.offlineVoice"

interface RecognitionResultLike {
    isFinal: boolean
    0: { transcript: string }
}
interface RecognitionLike {
    lang: string
    continuous: boolean
    interimResults: boolean
    maxAlternatives: number
    processLocally?: boolean
    phrases?: unknown[]
    onresult: ((e: { resultIndex: number; results: ArrayLike<RecognitionResultLike> }) => void) | null
    onerror: ((e: { error: string }) => void) | null
    onend: (() => void) | null
    onspeechstart?: (() => void) | null
    start(): void
    stop(): void
    abort(): void
}
interface RecognitionCtor {
    new (): RecognitionLike
    available?: (o: { langs: string[]; processLocally: boolean }) => Promise<string>
    install?: (o: { langs: string[]; processLocally: boolean }) => Promise<boolean>
}

function ctor(): RecognitionCtor | null {
    if (typeof window === "undefined") return null
    const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }
    return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

/** Can this phone hear him with no internet? Packs read "downloadable" until install() ran once on this site. */
export async function offlineVoiceStatus(): Promise<OfflineVoiceStatus> {
    const SR = ctor()
    if (!SR?.available) return "unsupported"
    try {
        return (await SR.available({ langs: [LANG], processLocally: true })) as OfflineVoiceStatus
    } catch {
        return "unsupported"
    }
}

/** Downloads the Hindi pack (or unlocks one already there). Must run from a tap. */
export async function installOfflineVoice(): Promise<boolean> {
    const SR = ctor()
    if (!SR?.install) return false
    try {
        const ok = await SR.install({ langs: [LANG], processLocally: true })
        if (ok) localStorage.setItem(INSTALLED_KEY, "1")
        return ok
    } catch {
        return false
    }
}

export const offlineVoiceWasInstalled = () => {
    try {
        return localStorage.getItem(INSTALLED_KEY) === "1"
    } catch {
        return false
    }
}

/**
 * One sentence, heard on the phone. Resolves with what he said ("" for silence), or rejects when
 * local recognition cannot run. `onPartial` shows the words as they come.
 */
export function listenLocally(opts: { names: string[]; onPartial?: (text: string) => void; signal?: AbortSignal }): Promise<string> {
    const SR = ctor()
    if (!SR) return Promise.reject(new Error("unsupported"))
    return new Promise((resolve, reject) => {
        const rec = new SR()
        rec.lang = LANG
        rec.continuous = false
        rec.interimResults = true
        rec.maxAlternatives = 1
        rec.processLocally = true
        // Bias toward his customers' names where the phone supports it.
        const Phrase = (window as unknown as { SpeechRecognitionPhrase?: new (p: string, boost?: number) => unknown }).SpeechRecognitionPhrase
        let usedPhrases = false
        if (Phrase && "phrases" in rec && opts.names.length) {
            try {
                rec.phrases = opts.names.slice(0, 50).map((n) => new Phrase(n, 3))
                usedPhrases = true
            } catch {
                usedPhrases = false
            }
        }
        let text = ""
        let settled = false
        const finish = (fn: () => void) => {
            if (settled) return
            settled = true
            fn()
        }
        rec.onresult = (e) => {
            let interim = ""
            for (let i = 0; i < e.results.length; i++) {
                const r = e.results[i]!
                if (r.isFinal) text = r[0].transcript
                else interim += r[0].transcript
            }
            opts.onPartial?.(text || interim)
        }
        rec.onerror = (e) => {
            if (e.error === "no-speech" || e.error === "aborted") return finish(() => resolve(""))
            if (e.error === "phrases-not-supported" && usedPhrases) {
                settled = true
                rec.phrases = []
                void listenLocally({ ...opts, names: [] }).then(resolve, reject)
                return
            }
            finish(() => reject(new Error(e.error)))
        }
        rec.onend = () => finish(() => resolve(text.trim()))
        opts.signal?.addEventListener("abort", () => rec.abort())
        try {
            rec.start()
        } catch (e) {
            finish(() => reject(e))
        }
    })
}

/** The phone's own voice: a Hindi voice reads Devanagari (Nepali and Maithili too). */
export function speakLocally(text: string, lang: "hi" | "ne" | "mai" | "en"): Promise<void> {
    if (typeof window === "undefined" || !("speechSynthesis" in window) || !text) return Promise.resolve()
    const synth = window.speechSynthesis
    const want = lang === "en" ? ["en-IN", "en-GB", "en-US"] : lang === "ne" ? ["ne-NP", "hi-IN"] : ["hi-IN"]
    const voices = synth.getVoices()
    const voice = want.map((l) => voices.find((v) => v.lang.replace("_", "-") === l)).find(Boolean)
    return new Promise((resolve) => {
        const u = new SpeechSynthesisUtterance(text)
        if (voice) u.voice = voice
        u.lang = voice?.lang ?? (lang === "en" ? "en-IN" : "hi-IN")
        u.rate = 0.95
        u.onend = () => resolve()
        u.onerror = () => resolve()
        synth.cancel()
        synth.speak(u)
        // Some phones never fire onend
        setTimeout(resolve, Math.min(15_000, 1500 + text.length * 90))
    })
}
