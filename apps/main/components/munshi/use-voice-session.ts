"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { OrbState } from "./orb"

const SPEECH_RMS = 0.045
const SILENCE_RMS = 0.02
const SILENCE_AFTER_SPEECH_MS = 1100
const NO_SPEECH_TIMEOUT_MS = 8000
const MAX_UTTERANCE_MS = 25_000

export type VoiceStatus = OrbState | "off"

function pickMime(): string {
    const options = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/aac"]
    for (const m of options) if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) return m
    return ""
}

/**
 * Hands-free voice loop: listen -> (he stops talking) -> think -> speak -> listen again.
 * Tap once to start, tap again to stop. Tapping while Munshi speaks interrupts and listens.
 * `level` (0..1) follows his voice while listening and Munshi's while speaking - it drives the orb.
 */
export function useVoiceSession({
    onUtterance,
}: {
    /** Send his speech; resolve with Munshi's audio (base64 mp3) or null */
    onUtterance: (audio: Blob) => Promise<{ audio?: string | null; endSession?: boolean } | null>
}) {
    const [status, setStatus] = useState<VoiceStatus>("off")
    const [error, setError] = useState<string | null>(null)
    const level = useRef(0)

    const ctxRef = useRef<AudioContext | null>(null)
    const streamRef = useRef<MediaStream | null>(null)
    const recRef = useRef<MediaRecorder | null>(null)
    const audioRef = useRef<HTMLAudioElement | null>(null)
    const rafRef = useRef(0)
    const activeRef = useRef(false)
    const onUtteranceRef = useRef(onUtterance)
    onUtteranceRef.current = onUtterance

    const stopMeter = () => cancelAnimationFrame(rafRef.current)

    const meter = (analyser: AnalyserNode, onFrame?: (rms: number, now: number) => void) => {
        const buf = new Float32Array(analyser.fftSize)
        const loop = () => {
            analyser.getFloatTimeDomainData(buf)
            let sum = 0
            for (const v of buf) sum += v * v
            const rms = Math.sqrt(sum / buf.length)
            level.current = Math.min(1, rms * 7)
            onFrame?.(rms, performance.now())
            rafRef.current = requestAnimationFrame(loop)
        }
        stopMeter()
        rafRef.current = requestAnimationFrame(loop)
    }

    const ensureContext = async () => {
        if (!ctxRef.current) {
            const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
            ctxRef.current = new Ctx()
        }
        if (ctxRef.current.state === "suspended") await ctxRef.current.resume()
        return ctxRef.current
    }

    const listen = useCallback(async () => {
        if (!activeRef.current) return
        setStatus("listening")
        const ctx = await ensureContext()
        if (!streamRef.current) {
            streamRef.current = await navigator.mediaDevices.getUserMedia({
                audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
            })
        }
        const source = ctx.createMediaStreamSource(streamRef.current)
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 1024
        source.connect(analyser)

        const mime = pickMime()
        const rec = new MediaRecorder(streamRef.current, mime ? { mimeType: mime } : undefined)
        recRef.current = rec
        const chunks: BlobPart[] = []
        rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)

        const startedAt = performance.now()
        let spokeAt = 0
        let lastLoud = 0
        let finished = false
        const finish = (hadSpeech: boolean) => {
            if (finished) return
            finished = true
            stopMeter()
            level.current = 0
            source.disconnect()
            rec.onstop = async () => {
                if (!activeRef.current) return
                if (!hadSpeech) {
                    activeRef.current = false
                    setStatus("off")
                    return
                }
                const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" })
                setStatus("thinking")
                const res = await onUtteranceRef.current(blob).catch(() => null)
                if (!activeRef.current) return
                if (res?.endSession) {
                    activeRef.current = false
                    setStatus("off")
                    return
                }
                if (res?.audio) await play(res.audio)
                if (activeRef.current) void listen()
            }
            if (rec.state !== "inactive") rec.stop()
        }

        rec.start(250)
        meter(analyser, (rms, now) => {
            if (rms > SPEECH_RMS) {
                if (!spokeAt) spokeAt = now
                lastLoud = now
            } else if (spokeAt && rms < SILENCE_RMS && now - lastLoud > SILENCE_AFTER_SPEECH_MS) {
                finish(true)
            }
            if (!spokeAt && now - startedAt > NO_SPEECH_TIMEOUT_MS) finish(false)
            if (now - startedAt > MAX_UTTERANCE_MS) finish(Boolean(spokeAt))
        })
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    const play = useCallback(async (base64: string) => {
        const ctx = await ensureContext()
        setStatus("speaking")
        const el = new Audio(`data:audio/mpeg;base64,${base64}`)
        audioRef.current = el
        const src = ctx.createMediaElementSource(el)
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 1024
        src.connect(analyser)
        analyser.connect(ctx.destination)
        meter(analyser)
        await new Promise<void>((resolve) => {
            el.onended = () => resolve()
            el.onerror = () => resolve()
            el.play().catch(() => resolve())
        })
        stopMeter()
        level.current = 0
        src.disconnect()
        audioRef.current = null
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    const stopAll = useCallback(() => {
        activeRef.current = false
        stopMeter()
        level.current = 0
        if (recRef.current && recRef.current.state !== "inactive") {
            recRef.current.onstop = null
            recRef.current.stop()
        }
        audioRef.current?.pause()
        audioRef.current = null
        streamRef.current?.getTracks().forEach((t) => t.stop())
        streamRef.current = null
        setStatus("off")
    }, [])

    const toggle = useCallback(async () => {
        setError(null)
        if (status === "speaking") {
            audioRef.current?.pause()
            audioRef.current?.dispatchEvent(new Event("ended"))
            return
        }
        if (activeRef.current) return stopAll()
        try {
            activeRef.current = true
            await listen()
        } catch (e) {
            activeRef.current = false
            setStatus("off")
            setError(e instanceof Error && e.name === "NotAllowedError" ? "mic_denied" : "mic_failed")
        }
    }, [listen, status, stopAll])

    /** Play one line without starting a listening session (welcome greeting). */
    const sayOnce = useCallback(
        async (base64: string) => {
            if (activeRef.current) return
            await play(base64)
            setStatus("off")
        },
        [play],
    )

    useEffect(() => () => stopAll(), [stopAll])

    return { status, level, toggle, stop: stopAll, sayOnce, error }
}
