import { cookies } from "next/headers"
import { requireCollectorId } from "@/lib/session"
import { I18nProvider } from "@/lib/i18n"
import { BottomNav } from "@/components/shell/bottom-nav"
import { OfflineBar } from "@/components/shell/offline-bar"
import { LangSync } from "@/components/shell/lang-sync"
import { langFrom, type Lang } from "@/lib/dict"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
    // Independent: the session (from its signed cookie) and the language cookie.
    const [, jar] = await Promise.all([requireCollectorId(), cookies()])
    const lang: Lang = langFrom(jar.get("sajilo.lang")?.value)
    return (
        <I18nProvider initialLang={lang}>
            <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col">
                <OfflineBar />
                <main className="flex-1 pb-6">{children}</main>
                <BottomNav />
            </div>
            <LangSync />
        </I18nProvider>
    )
}
