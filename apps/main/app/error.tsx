"use client"

import { useEffect, useState } from "react"
import { isNetworkError } from "@/lib/offline/network"

const RELOAD_KEY = "sajilo.offlineReload"

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    const [offline, setOffline] = useState(false)

    // Moving between screens offline fails when the screen's data wasn't fetched ahead. A full
    // load goes through the service worker, which has the saved copy, so try that once.
    useEffect(() => {
        console.error(error)
        if (!isNetworkError(error) && navigator.onLine) return
        setOffline(true)
        const here = location.pathname + location.search
        const last = JSON.parse(sessionStorage.getItem(RELOAD_KEY) ?? "null") as { at: number; path: string } | null
        if (last && last.path === here && Date.now() - last.at < 15_000) return
        sessionStorage.setItem(RELOAD_KEY, JSON.stringify({ at: Date.now(), path: here }))
        location.reload()
    }, [error])

    return (
        <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-8 text-center">
            <h1 className="text-2xl font-semibold text-ink">{offline ? "इन्टरनेट छैन" : "केही गडबड भयो"}</h1>
            <p className="max-w-xs text-ink-3">
                {offline ? "This screen isn't saved on this phone yet. Open it once with internet and it will work offline." : "Something went wrong"}
            </p>
            <div className="mt-4 flex gap-3">
                <button onClick={reset} className="rounded-2xl bg-ink px-6 py-4 text-[16px] font-semibold text-paper">
                    फेरि प्रयास · Retry
                </button>
                <a href="/today" className="rounded-2xl bg-paper-2 px-6 py-4 text-[16px] font-semibold text-ink">
                    आज · Today
                </a>
            </div>
        </main>
    )
}
