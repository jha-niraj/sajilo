"use client"

import { useEffect } from "react"
import { Toaster } from "@repo/ui/components/ui/sonner"
import { I18nProvider } from "@/lib/i18n"
import type { Lang } from "@/lib/dict"

export function Providers({ lang, children }: { lang: Lang; children: React.ReactNode }) {
    useEffect(() => {
        if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
            navigator.serviceWorker.register("/sw.js").catch(() => {})
        }
    }, [])

    return (
        <I18nProvider initialLang={lang}>
            {children}
            <Toaster position="bottom-center" offset={{ bottom: "calc(7rem + env(safe-area-inset-bottom))" }} mobileOffset={{ bottom: "calc(7rem + env(safe-area-inset-bottom))" }} />
        </I18nProvider>
    )
}
