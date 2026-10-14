"use client"

import { useCallback, useEffect, useRef, useState } from "react"

const SPEECH_RMS = 0.045
const SILENCE_RMS = 0.02
const SILENCE_AFTER_SPEECH_MS = 1400
const MAX_MS = 25_000

/**
 * One utterance for the chat mic: records until he taps stop or goes quiet after speaking.
 * `level` (0..1) follows his voice for the talking animation.
 */
export function useDictation(onDone: (audio: Blob) => void) {
    const [recording, setRecording] = useState(false)
    const level = useRef(0)
    const stopRef = useRef<() => void>(() => {})
    const onDoneRef = useRef(onDone)
    onDoneRef.current = onDone

    const start = useCallback(async () => {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        const ctx = new Ctx()
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 1024
        ctx.createMediaStreamSource(stream).connect(analyser)

        const rec = new MediaRecorder(stream)
        const chunks: BlobPart[] = []
        rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)

        let raf = 0
        let spokeAt = 0
        let lastLoud = 0
        let cancelled = false
        const startedAt = performance.now()
        const buf = new Float32Array(analyser.fftSize)

        const cleanup = () => {
            cancelAnimationFrame(raf)
            level.current = 0
            stream.getTracks().forEach((t) => t.stop())
            void ctx.close()
            setRecording(false)
        }
        rec.onstop = () => {
            cleanup()
            if (!cancelled && spokeAt) onDoneRef.current(new Blob(chunks, { type: rec.mimeType || "audio/webm" }))
        }
        const stop = (cancel = false) => {
            cancelled = cancel
            if (rec.state !== "inactive") rec.stop()
        }
        stopRef.current = () => stop(false)

        const loop = () => {
            analyser.getFloatTimeDomainData(buf)
            let sum = 0
            for (const v of buf) sum += v * v
            const rms = Math.sqrt(sum / buf.length)
            level.current = Math.min(1, rms * 7)
            const now = performance.now()
            if (rms > SPEECH_RMS) {
                if (!spokeAt) spokeAt = now
                lastLoud = now
            } else if (spokeAt && rms < SILENCE_RMS && now - lastLoud > SILENCE_AFTER_SPEECH_MS) return stop()
            if (now - startedAt > MAX_MS) return stop()
            raf = requestAnimationFrame(loop)
        }

        rec.start(250)
        setRecording(true)
        raf = requestAnimationFrame(loop)
    }, [])

    const stop = useCallback(() => stopRef.current(), [])

    useEffect(() => () => stopRef.current(), [])

    return { recording, level, start, stop }
}
