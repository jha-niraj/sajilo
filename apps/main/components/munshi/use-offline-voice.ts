"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useLiveQuery } from "dexie-react-hooks"
import { idb } from "@/lib/offline/store"
import { newOpId } from "@/lib/offline/sync"
import { installOfflineVoice, listenLocally, offlineVoiceStatus, speakLocally, type OfflineVoiceStatus } from "@/lib/voice/local"
import type { VoiceLang } from "@/lib/voice/parse"
import { useVoiceSession, type VoiceStatus } from "./use-voice-session"

/** Notes said offline that still need going through (recordings or words). */
export function usePendingClips() {
    return useLiveQuery(() => idb().clips.orderBy("createdAt").toArray(), [], [])
}

export async function keepClip(date: string, note: { audio?: Blob; text?: string }) {
    await idb().clips.put({ id: newOpId(), date, createdAt: Date.now(), ...note })
}

/**
 * Talk with no signal. With Chrome's on-device Hindi pack he is heard on the phone and the voice
 * loop runs as usual (replies in the phone's voice); without it, each sentence is kept as a
 * recording to go through once online.
 */
export function useOfflineVoice({
    active,
    today,
    names,
    onText,
    laterLine,
}: {
    /** offline right now */
    active: boolean
    today: string
    names: string[]
    /** what he said -> what to say back; null = not understood here (kept for later) */
    onText: (text: string) => Promise<{ say: string; lang: VoiceLang } | null>
    laterLine: () => { say: string; lang: VoiceLang }
}) {
    const [support, setSupport] = useState<OfflineVoiceStatus | null>(null)
    const [status, setStatus] = useState<VoiceStatus>("off")
    const [partial, setPartial] = useState("")
    const level = useRef(0)
    const running = useRef(false)
    const abort = useRef<AbortController | null>(null)
    const onTextRef = useRef(onText)
    onTextRef.current = onText
    const laterRef = useRef(laterLine)
    laterRef.current = laterLine

    useEffect(() => {
        void offlineVoiceStatus().then(setSupport)
    }, [active])

    // Without on-device recognition: record each sentence and keep it.
    const clipSession = useVoiceSession({
        onUtterance: async (blob) => {
            await keepClip(today, { audio: blob })
            const l = laterRef.current()
            await speakLocally(l.say, l.lang)
            return { audio: null }
        },
    })

    const stop = useCallback(() => {
        running.current = false
        abort.current?.abort()
        window.speechSynthesis?.cancel()
        level.current = 0
        setPartial("")
        setStatus("off")
        clipSession.stop()
    }, [clipSession])

    const loop = useCallback(async () => {
        running.current = true
        while (running.current) {
            setStatus("listening")
            setPartial("")
            level.current = 0.35
            abort.current = new AbortController()
            let text = ""
            try {
                text = await listenLocally({
                    names,
                    signal: abort.current.signal,
                    onPartial: (p) => {
                        setPartial(p)
                        level.current = 0.35 + Math.random() * 0.5
                    },
                })
            } catch {
                setSupport("unavailable")
                break
            }
            level.current = 0
            if (!running.current) break
            if (!text) break
            setStatus("thinking")
            const reply = await onTextRef.current(text).catch(() => null)
            if (!running.current) break
            const line = reply ?? laterRef.current()
            if (!reply) await keepClip(today, { text })
            setStatus("speaking")
            await speakLocally(line.say, line.lang)
        }
        running.current = false
        level.current = 0
        setStatus("off")
    }, [names, today])

    const toggle = useCallback(async () => {
        if (support === "available") {
            if (running.current) return stop()
            void loop()
            return
        }
        await clipSession.toggle()
    }, [clipSession, loop, stop, support])

    useEffect(() => {
        if (!active) stop()
    }, [active, stop])

    const install = useCallback(async () => {
        setSupport("downloading")
        const ok = await installOfflineVoice()
        setSupport(ok ? "available" : await offlineVoiceStatus())
        return ok
    }, [])

    const local = support === "available"
    return {
        support,
        local,
        status: local ? status : clipSession.status,
        level: local ? level : clipSession.level,
        partial,
        toggle,
        stop,
        install,
    }
}
