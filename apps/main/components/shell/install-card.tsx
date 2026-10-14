"use client"

import { Download, Share } from "lucide-react"
import { useI18n } from "@/lib/i18n"
import { useInstall } from "@/lib/install"

/** "Add to home screen": a real install button where the browser allows it, otherwise the steps. */
export function InstallCard() {
    const { t } = useI18n()
    const { installed, ios, prompt } = useInstall()
    if (installed) return null

    if (prompt) {
        return (
            <button
                type="button"
                onClick={() => void prompt()}
                className="flex w-full items-center gap-3 rounded-[24px] bg-saffron p-4 text-left text-white"
            >
                <Download className="h-6 w-6 shrink-0" />
                <span className="flex-1 text-[15px] font-semibold">{t("installApp")}</span>
                <span className="rounded-full bg-white/20 px-3 py-1 text-[14px] font-semibold">{t("install")}</span>
            </button>
        )
    }

    const Icon = ios ? Share : Download
    return (
        <div className="flex items-start gap-3 rounded-[24px] bg-saffron-soft p-4 ring-1 ring-saffron/20">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-saffron text-white">
                <Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
                <p className="text-[15px] font-semibold text-ink">{t("installApp")}</p>
                <p className="mt-1 text-[14px] leading-snug text-ink-2">{t(ios ? "installHintIos" : "installHintOther")}</p>
            </div>
        </div>
    )
}
