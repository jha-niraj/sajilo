"use client"

import { useEffect, useRef, useState, useSyncExternalStore } from "react"
import { usePathname, useRouter } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import { useLiveQuery } from "dexie-react-hooks"
import { toast } from "sonner"
import { CloudCheck, RefreshCw, WifiOff } from "lucide-react"
import { cn } from "@repo/ui/lib/utils"
import { useI18n } from "@/lib/i18n"
import { useOnline } from "@/lib/offline/network"
import { idb } from "@/lib/offline/store"
import { getSyncState, startSyncLoop, subscribeSync } from "@/lib/offline/sync"

const BAR_H = "calc(2.25rem + env(safe-area-inset-top))"

/**
 * One calm line at the top of every screen: offline (and how much is waiting), then "saving" and
 * "all saved" once the connection is back. It also refreshes server-drawn pages after a sync so
 * nothing shows yesterday's numbers next to today's ticks.
 */
export function OfflineBar() {
    const { t } = useI18n()
    const router = useRouter()
    const pathname = usePathname()
    const online = useOnline()
    const pending = useLiveQuery(() => idb().outbox.count(), [], 0)
    const syncing = useSyncExternalStore(subscribeSync, () => getSyncState().syncing, () => false)
    const [justBack, setJustBack] = useState(false)
    const wasOffline = useRef(false)

    useEffect(() => startSyncLoop(), [])

    useEffect(() => {
        if (online) return warmPagesLater()
    }, [online])

    useEffect(() => {
        if (!online) {
            wasOffline.current = true
            setJustBack(false)
        } else if (wasOffline.current) {
            wasOffline.current = false
            setJustBack(true)
        }
    }, [online])

    useEffect(() => {
        if (!justBack || pending > 0 || syncing) return
        const id = setTimeout(() => setJustBack(false), 2600)
        return () => clearTimeout(id)
    }, [justBack, pending, syncing])

    useEffect(() => {
        // One refresh after a sync (the server-rendered bits, e.g. Today's deposit banner, catch up).
        const onSynced = () => {
            if (!pathname.startsWith("/munshi")) router.refresh()
            sessionStorage.removeItem("sajilo.warmedAt")
            warmPages()
        }
        const onRejected = (e: Event) => toast.error(t("syncProblem", { count: (e as CustomEvent<number>).detail }))
        window.addEventListener("sajilo:synced", onSynced)
        window.addEventListener("sajilo:rejected", onRejected)
        return () => {
            window.removeEventListener("sajilo:synced", onSynced)
            window.removeEventListener("sajilo:rejected", onRejected)
        }
    }, [pathname, router, t])

    const mode: "offline" | "saving" | "saved" | null = !online ? "offline" : justBack ? (pending > 0 || syncing ? "saving" : "saved") : null

    useEffect(() => {
        document.documentElement.style.setProperty("--offline-bar", mode ? BAR_H : "0px")
    }, [mode])

    return (
        <AnimatePresence initial={false}>
            {mode && (
                <motion.div
                    key="bar"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                    className={cn(
                        "no-print sticky top-0 z-50 overflow-hidden",
                        mode === "offline" ? "bg-[#fbecc8] text-[#7a4f05]" : mode === "saving" ? "bg-paper-2 text-ink-2" : "bg-paid-soft text-paid",
                    )}
                    role="status"
                    aria-live="polite"
                >
                    <div className="pt-safe">
                        <div className="flex h-9 items-center justify-center gap-2 px-4 text-[13px] font-medium">
                            {mode === "offline" ? (
                                <>
                                    <WifiOff className="h-4 w-4 shrink-0" />
                                    <span className="truncate">
                                        <b className="font-semibold">{t("offlineBarTitle")}</b>
                                        {" · "}
                                        {pending > 0 ? t("unsaved", { count: pending }) : t("offlineBarShort")}
                                    </span>
                                </>
                            ) : mode === "saving" ? (
                                <>
                                    <RefreshCw className="h-4 w-4 shrink-0 animate-spin" />
                                    <span className="truncate">{t("backOnlineSyncing", { count: pending })}</span>
                                </>
                            ) : (
                                <>
                                    <CloudCheck className="h-4 w-4 shrink-0" />
                                    <span className="truncate">{t("allChangesSaved")}</span>
                                </>
                            )}
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}

const WARM_PAGES = ["/today", "/today/finish", "/month", "/loans", "/loans/new", "/loans/calculator", "/cash", "/manage", "/more", "/settings", "/munshi", "/recharge", "/reports"]
const WARM_EVERY_MS = 10 * 60_000

/**
 * After the page has loaded and the phone is idle (and the bottom bar's own prefetch queue has had
 * its turn), so the offline copy never competes with what he is opening. Returns a cancel.
 */
function warmPagesLater(): () => void {
    let handle: ReturnType<typeof setTimeout> | null = null
    let idle: number | null = null
    const start = () => {
        handle = setTimeout(() => {
            if (typeof window.requestIdleCallback === "function") idle = window.requestIdleCallback(warmPages, { timeout: 5000 })
            else warmPages()
        }, 4000)
    }
    if (document.readyState === "complete") start()
    else window.addEventListener("load", start, { once: true })
    return () => {
        window.removeEventListener("load", start)
        if (handle) clearTimeout(handle)
        if (idle !== null) window.cancelIdleCallback(idle)
    }
}

/** Ask the service worker to keep a fresh copy of the main screens for offline use. */
function warmPages() {
    if (typeof navigator === "undefined" || !navigator.serviceWorker?.controller) return
    const last = Number(sessionStorage.getItem("sajilo.warmedAt") ?? 0)
    if (Date.now() - last < WARM_EVERY_MS) return
    sessionStorage.setItem("sajilo.warmedAt", String(Date.now()))
    navigator.serviceWorker.controller.postMessage({ type: "warm", urls: WARM_PAGES })
}
