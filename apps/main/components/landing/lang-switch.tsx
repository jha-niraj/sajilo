"use client"

import { cn } from "@repo/ui/lib/utils"
import { LANGS, type Lang } from "@/lib/dict"
import { useI18n } from "@/lib/i18n"

const SHORT: Record<Lang, string> = { en: "EN", ne: "ने", mai: "मै" }
const FULL: Record<Lang, string> = { en: "English", ne: "नेपाली", mai: "Maithili" }

export function LangSwitch({ className }: { className?: string }) {
    const { lang, setLang } = useI18n()
    return (
        <div className={cn("inline-flex rounded-full border border-line bg-card p-0.5 text-[13px] font-semibold", className)} role="group" aria-label="Language">
            {LANGS.map((l) => (
                <button
                    key={l}
                    type="button"
                    onClick={() => setLang(l)}
                    aria-pressed={lang === l}
                    aria-label={FULL[l]}
                    title={FULL[l]}
                    className={cn("h-8 min-w-9 rounded-full px-2 transition-colors", lang === l ? "bg-ink text-paper" : "text-ink-2 hover:text-ink")}
                >
                    {SHORT[l]}
                </button>
            ))}
        </div>
    )
}
