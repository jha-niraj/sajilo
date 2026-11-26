"use client"

import type { useRouter } from "next/navigation"
import { clearLocalData } from "@/lib/offline/store"
import { PrefetchKind } from "@/lib/prefetch-kind"

type Router = ReturnType<typeof useRouter>

/**
 * One short request (the Worker clears the cookies before Next loads), then the login page from
 * the router cache. A 401 means the session already ended elsewhere: still signed out here.
 * Afterwards nothing of his stays in the tab: the offline copy and saved pages are deleted and the
 * router cache is refreshed, so Back can't redraw his numbers on a shared phone. A bare `/login`,
 * never a return address.
 */
export async function signOutNow(router: Router): Promise<void> {
    const res = await fetch("/api/sign-out", { method: "POST" })
    if (!res.ok && res.status !== 401) throw new Error(`sign-out ${res.status}`)
    await clearLocalData()
    router.push("/login")
    router.refresh()
}

/** The login page ready in the router cache before he taps Sign out (it is static: the whole page). */
export function prefetchLogin(router: Router) {
    router.prefetch("/login", { kind: PrefetchKind.AUTO })
}
