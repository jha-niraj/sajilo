"use client"

import { cn } from "@repo/ui/lib/utils"
import { useI18n } from "@/lib/i18n"
import type { Lang } from "@/lib/dict"

export function LangToggle({ onChange, className }: { onChange?: (lang: Lang) => void; className?: string }) {
    const { lang, setLang } = useI18n()
    const pick = (l: Lang) => {
        setLang(l)
        onChange?.(l)
    }
    return (
        <div className={cn("inline-flex rounded-full bg-paper-2 p-1 text-sm font-medium", className)} role="group" aria-label="Language">
            {(["en", "ne"] as const).map((l) => (
                <button
                    key={l}
                    type="button"
                    onClick={() => pick(l)}
                    aria-pressed={lang === l}
                    className={cn(
                        "rounded-full px-3 py-1.5 transition-colors",
                        lang === l ? "bg-card text-ink shadow-sm" : "text-ink-3",
                    )}
                >
                    {l === "ne" ? "नेपाली" : "English"}
                </button>
            ))}
        </div>
    )
}
