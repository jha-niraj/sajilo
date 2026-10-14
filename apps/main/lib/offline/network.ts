"use client"

import { useSyncExternalStore } from "react"

// navigator.onLine only knows whether there is a network, not whether the server answers: on
// weak shop wifi it says "online" while every request fails. A failed sync flips `reachable`
// so the app shows offline mode until a request gets through again.
let reachable = true
const listeners = new Set<() => void>()

function notify() {
    for (const l of listeners) l()
}

export function setReachable(value: boolean) {
    if (reachable === value) return
    reachable = value
    notify()
}

export function isOnline(): boolean {
    if (typeof navigator === "undefined") return true
    return navigator.onLine && reachable
}

function subscribe(cb: () => void) {
    const onOnline = () => {
        reachable = true
        cb()
    }
    window.addEventListener("online", onOnline)
    window.addEventListener("offline", cb)
    listeners.add(cb)
    return () => {
        window.removeEventListener("online", onOnline)
        window.removeEventListener("offline", cb)
        listeners.delete(cb)
    }
}

export function useOnline(): boolean {
    return useSyncExternalStore(subscribe, isOnline, () => true)
}

/** A request that failed before reaching the server (no network, server unreachable). */
export function isNetworkError(e: unknown): boolean {
    if (typeof navigator !== "undefined" && !navigator.onLine) return true
    const msg = e instanceof Error ? `${e.name} ${e.message}` : String(e)
    return /failed to fetch|networkerror|network request failed|load failed|fetch failed|timeout|aborted/i.test(msg)
}
