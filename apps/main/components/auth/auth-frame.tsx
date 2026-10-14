"use client"

import { BrandMark } from "@/components/brand"
import { LangToggle } from "@/components/lang-toggle"
import { useI18n } from "@/lib/i18n"

export function AuthFrame({ children }: { children: React.ReactNode }) {
    const { t } = useI18n()
    return (
        <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 pt-safe">
            <header className="flex items-center justify-between pt-5">
                <div className="flex items-center gap-2.5">
                    <BrandMark size={36} />
                    <div className="leading-tight">
                        <p className="text-lg font-semibold text-ink">{t("appName")}</p>
                        <p className="text-[13px] text-ink-3">{t("tagline")}</p>
                    </div>
                </div>
                <LangToggle />
            </header>
            <div className="flex flex-1 flex-col pb-safe">{children}</div>
        </main>
    )
}
