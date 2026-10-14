"use client"

import { useEffect } from "react"
import { Toaster } from "@repo/ui/components/ui/sonner"
import { I18nProvider } from "@/lib/i18n"
import type { Lang } from "@/lib/dict"

export function Providers({ lang, children }: { lang: Lang; children: React.ReactNode }) {
    useEffect(() => {
        if (!("serviceWorker" in navigator)) return
        if (process.env.NODE_ENV === "production") {
            navigator.serviceWorker.register("/sw.js").catch(() => {})
            return
        }
        // A worker left over from testing a production build would serve that build's pages and
        // scripts on top of the dev server, and their server-action ids don't exist here.
        void navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => void r.unregister()))
        void caches?.keys().then((keys) => keys.filter((k) => k.startsWith("sajilo-")).forEach((k) => void caches.delete(k)))
    }, [])

    return (
        <I18nProvider initialLang={lang}>
            {children}
            <Toaster position="bottom-center" offset={{ bottom: "calc(7rem + env(safe-area-inset-bottom))" }} mobileOffset={{ bottom: "calc(7rem + env(safe-area-inset-bottom))" }} />
        </I18nProvider>
    )
}
