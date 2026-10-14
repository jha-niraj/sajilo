'use client'

import { useCallback, useEffect, useState } from 'react'
import { Volume2, VolumeX } from 'lucide-react'
import { cn } from '../../lib/utils'

/**
 * The app's notification sounds, and the one preference that governs them.
 *
 * ## Synthesised, not sampled
 *
 * Every sound here is generated with Web Audio at the moment it plays. There are no `.mp3` files,
 * no fetch, nothing to license and nothing to bundle - and it works with no network at all, which
 * matters for a product whose own marketing is about schools on a weak connection.
 *
 * It is also the only version that stays tunable: a sound built from three numbers can be adjusted
 * by changing a number, where a sampled one has to be re-recorded by somebody else.
 *
 * ## Only success and error make a sound
 *
 * Those are the two a teacher needs to hear WITHOUT looking - did the fee save, did the register
 * fail. Info, warning and message are 39 calls out of nearly 2,000 and are rarely urgent. A sound
 * that fires constantly stops carrying information, and the one you actually need to hear is the
 * failure.
 *
 * ## Nothing here ever throws
 *
 * Audio is the most interruptible API in a browser: it is blocked before a user gesture, absent in
 * some embedded webviews, and can fail on a device with no output. **A notification must never fail
 * because its sound could not play** - the toast is the message, the sound is an accompaniment. So
 * every call is wrapped and a failure is silent in both senses.
 */

/**
 * The preference key.
 *
 * `localStorage` does not cross origins, so each app keeps its own copy under the same NAME. That
 * is worth knowing before somebody reports that muting the staff app did not mute the portal: it
 * is the same key, not the same storage.
 */
const SOUND_KEY = 'gk-sound'

/** Fired on the window when the preference changes, so every listener in this tab keeps up. */
const SOUND_EVENT = 'gk-sound-change'

/**
 * ON by default, and the default has to survive a storage read that throws.
 *
 * A private window, blocked site data or a locked-down webview all make `localStorage` throw on
 * ACCESS, not return null. Defaulting to on inside the catch is what stops that turning the
 * feature off for people who never chose to.
 */
export function isSoundOn(): boolean {
    if (typeof window === 'undefined') return true
    try {
        return window.localStorage.getItem(SOUND_KEY) !== 'off'
    } catch {
        return true
    }
}

export function setSoundOn(on: boolean): void {
    try {
        window.localStorage.setItem(SOUND_KEY, on ? 'on' : 'off')
    } catch {
        // Storage blocked. The preference will not survive a reload, which is better than the
        // toggle appearing not to work at all.
    }
    window.dispatchEvent(new CustomEvent(SOUND_EVENT, { detail: on }))
}

/**
 * Read the preference reactively.
 *
 * Starts at `true` rather than reading storage during render, because the server renders this too
 * and a value read from `localStorage` on the first pass is a hydration mismatch. The effect
 * corrects it immediately, and being briefly wrong about a sound costs nothing.
 *
 * Listens to BOTH events: `storage` fires for other tabs, the custom one for this tab. Without the
 * second, muting in the sidebar would not quieten a toast raised on the same page.
 */
export function useSoundEnabled(): [boolean, (on: boolean) => void] {
    const [on, setOn] = useState(true)

    useEffect(() => {
        setOn(isSoundOn())
        const sync = () => setOn(isSoundOn())
        const local = (e: Event) => setOn((e as CustomEvent<boolean>).detail)
        window.addEventListener('storage', sync)
        window.addEventListener(SOUND_EVENT, local)
        return () => {
            window.removeEventListener('storage', sync)
            window.removeEventListener(SOUND_EVENT, local)
        }
    }, [])

    const set = useCallback((next: boolean) => { setSoundOn(next); setOn(next) }, [])
    return [on, set]
}

/**
 * ONE AudioContext for the page, created lazily on first play.
 *
 * Creating it at module load would start a suspended context on every page whether or not a sound
 * is ever played, and some browsers log a warning about exactly that. Lazily also means it is
 * created inside a user-triggered call stack, which is when a browser is willing to resume it.
 */
let ctx: AudioContext | null = null

function audio(): AudioContext | null {
    if (typeof window === 'undefined') return null
    try {
        if (!ctx) {
            const Ctor = window.AudioContext
                ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
            if (!Ctor) return null
            ctx = new Ctor()
        }
        // Autoplay policy suspends a context created before any gesture. Resuming is a no-op when
        // it is already running, and the promise is deliberately unawaited - a sound is not worth
        // delaying the toast that carries the actual message.
        if (ctx.state === 'suspended') void ctx.resume()
        return ctx
    } catch {
        return null
    }
}

/**
 * One note.
 *
 * The envelope is the part that matters. A raw gain switch produces an audible click at both ends
 * (a discontinuity in the waveform), so every note ramps up over 12ms and decays exponentially -
 * which is also what makes it sound like an instrument rather than a beep.
 *
 * `exponentialRampToValueAtTime` cannot reach zero, hence the small floor before the stop.
 */
function note(at: number, hz: number, seconds: number, peak: number): void {
    const a = audio()
    if (!a) return
    const osc = a.createOscillator()
    const gain = a.createGain()
    // A sine has no harmonics, so several in a row never get harsh - which a square or saw would,
    // and this plays up to 1,900 times a day.
    osc.type = 'sine'
    osc.frequency.setValueAtTime(hz, at)
    gain.gain.setValueAtTime(0.0001, at)
    gain.gain.exponentialRampToValueAtTime(peak, at + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + seconds)
    osc.connect(gain).connect(a.destination)
    osc.start(at)
    osc.stop(at + seconds + 0.02)
}

export type SoundKind = 'success' | 'error'

/**
 * Play a notification sound, unless the reader has turned them off.
 *
 * Success RISES and error FALLS, which is the one thing that makes them distinguishable without
 * being taught: a rising pair reads as completion in almost every interface anybody has used, and
 * a falling one as refusal. Error is also lower, longer and slightly louder, because it is the one
 * you need to catch while looking somewhere else.
 *
 * Kept quiet deliberately - peak gain is 0.06 and 0.08 of full scale. This fires on every saved
 * form in a staffroom, and a notification nobody can mute in the moment has to be one nobody
 * minds.
 */
export function playSound(kind: SoundKind): void {
    if (!isSoundOn()) return
    try {
        const a = audio()
        if (!a) return
        const t = a.currentTime
        if (kind === 'success') {
            // C6 then G6 - a rising fifth.
            note(t, 1046.5, 0.09, 0.06)
            note(t + 0.085, 1568.0, 0.13, 0.055)
        } else {
            // A4 then D4 - falling, lower, and given longer to land.
            note(t, 440.0, 0.11, 0.08)
            note(t + 0.1, 293.7, 0.17, 0.075)
        }
    } catch {
        // Never let a sound break the notification it belongs to.
    }
}

/**
 * The mute control.
 *
 * Deliberately shows the CURRENT state rather than the action - a speaker with sound on, a crossed
 * speaker with it off. A button labelled with what it will do reads as the state to half the
 * people who see it, and this one sits in a row of other status controls.
 */
export function SoundToggle({ className }: { className?: string }) {
    const [on, setOn] = useSoundEnabled()
    const Icon = on ? Volume2 : VolumeX
    return (
        <button
            type="button"
            onClick={() => {
                const next = !on
                setOn(next)
                // Play ON the way on, so the reader hears exactly what they just enabled. Turning
                // it off silently is the only correct behaviour in the other direction.
                if (next) playSound('success')
            }}
            aria-pressed={on}
            aria-label={on ? 'Notification sounds on' : 'Notification sounds off'}
            title={on ? 'Notification sounds on' : 'Notification sounds off'}
            className={cn(
                'inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full transition-colors',
                'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900',
                'dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white',
                className,
            )}
        >
            <Icon className="h-4 w-4" />
        </button>
    )
}
