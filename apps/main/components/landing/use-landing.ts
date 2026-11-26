"use client"

import { useI18n } from "@/lib/i18n"
import { LANDING } from "@/lib/landing/copy"

export function useLanding() {
    const { lang } = useI18n()
    return { lang, c: LANDING[lang] }
}
