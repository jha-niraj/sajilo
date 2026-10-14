"use client"

import { useSyncExternalStore } from "react"

/**
 * Chrome fires `beforeinstallprompt` once, right after the first page loads - usually /munshi, long
 * before he opens More. An inline script in the root layout catches it before React hydrates and
 * keeps it on window; this hook reads it from any screen. iOS never fires it, so callers fall back
 * to the Share -> Add to Home Screen hint.
 */
export type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

declare global {
    interface Window {
        __sajiloInstall?: InstallEvent | null
    }
}

type Snapshot = { prompt: InstallEvent | null; installed: boolean; ios: boolean }
const SERVER: Snapshot = { prompt: null, installed: true, ios: false }
let last: Snapshot = SERVER

function read(): Snapshot {
    const nav = navigator as Navigator & { standalone?: boolean }
    const next: Snapshot = {
        prompt: window.__sajiloInstall ?? null,
        installed: window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true,
        ios: /iphone|ipad|ipod/i.test(nav.userAgent) || (nav.platform === "MacIntel" && nav.maxTouchPoints > 1),
    }
    if (next.prompt !== last.prompt || next.installed !== last.installed || next.ios !== last.ios) last = next
    return last
}

function subscribe(cb: () => void) {
    const mq = window.matchMedia("(display-mode: standalone)")
    window.addEventListener("sajilo:install", cb)
    mq.addEventListener("change", cb)
    return () => {
        window.removeEventListener("sajilo:install", cb)
        mq.removeEventListener("change", cb)
    }
}

export function useInstall() {
    const snap = useSyncExternalStore(subscribe, read, () => SERVER)
    const prompt = snap.prompt
        ? async () => {
              await snap.prompt!.prompt()
              const { outcome } = await snap.prompt!.userChoice
              // A prompt can only be used once; Chrome sends a fresh one later if he said no.
              window.__sajiloInstall = null
              window.dispatchEvent(new Event("sajilo:install"))
              return outcome === "accepted"
          }
        : null
    return { installed: snap.installed, ios: snap.ios, prompt }
}
