"use client"

import { useEffect, useState, useSyncExternalStore } from "react"
import { useLiveQuery } from "dexie-react-hooks"
import { CloudCheck, CloudOff, RefreshCw } from "lucide-react"
import { cn } from "@repo/ui/lib/utils"
import { useI18n } from "@/lib/i18n"
import { idb } from "@/lib/offline/store"
import { flush, getSyncState, startSyncLoop, subscribeSync } from "@/lib/offline/sync"

function useOnline() {
    return useSyncExternalStore(
        (cb) => {
            window.addEventListener("online", cb)
            window.addEventListener("offline", cb)
            return () => {
                window.removeEventListener("online", cb)
                window.removeEventListener("offline", cb)
            }
        },
        () => navigator.onLine,
        () => true,
    )
}

/** Small, calm status: never technical, never red unless money is waiting to be saved. */
export function SyncPill({ className }: { className?: string }) {
    const { t } = useI18n()
    const online = useOnline()
    const syncing = useSyncExternalStore(subscribeSync, () => getSyncState().syncing, () => false)
    const pending = useLiveQuery(() => idb().outbox.count(), [], 0)
    const [showSaved, setShowSaved] = useState(false)

    useEffect(() => startSyncLoop(), [])

    useEffect(() => {
        if (!syncing && pending === 0) {
            setShowSaved(true)
            const id = setTimeout(() => setShowSaved(false), 2500)
            return () => clearTimeout(id)
        }
    }, [syncing, pending])

    let content: React.ReactNode = null
    let tone = "bg-paper-2 text-ink-2"
    if (!online) {
        content = (
            <>
                <CloudOff className="h-4 w-4" /> {pending ? t("unsaved", { count: pending }) : t("offline")}
            </>
        )
        tone = "bg-flag-soft text-[#8a5a08]"
    } else if (syncing || pending > 0) {
        content = (
            <button type="button" onClick={() => void flush()} className="inline-flex items-center gap-1.5">
                <RefreshCw className={cn("h-4 w-4", syncing && "animate-spin")} />
                {pending ? t("unsaved", { count: pending }) : t("syncing")}
            </button>
        )
    } else if (showSaved) {
        content = (
            <>
                <CloudCheck className="h-4 w-4" /> {t("synced")}
            </>
        )
        tone = "bg-paid-soft text-paid"
    }

    if (!content) return null
    return (
        <span className={cn("inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium", tone, className)}>
            {content}
        </span>
    )
}
