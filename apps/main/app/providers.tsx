"use client"

import { useEffect } from "react"
import { Toaster } from "@repo/ui/components/ui/sonner"
import { I18nProvider } from "@/lib/i18n"

export function Providers({ children }: { children: React.ReactNode }) {
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
        <I18nProvider>
            {children}
            <Toaster position="top-center" offset={{ top: "calc(0.75rem + env(safe-area-inset-top))" }} mobileOffset={{ top: "calc(0.75rem + env(safe-area-inset-top))" }} />
        </I18nProvider>
    )
}
