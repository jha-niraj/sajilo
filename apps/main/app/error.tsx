"use client"

import { useEffect } from "react"

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    useEffect(() => {
        console.error(error)
    }, [error])

    return (
        <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-8 text-center">
            <h1 className="text-2xl font-semibold text-ink">केही गडबड भयो</h1>
            <p className="text-ink-3">Something went wrong</p>
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
