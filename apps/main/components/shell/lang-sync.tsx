"use client"

import { useEffect } from "react"
import { updateSettings } from "@/actions/settings.action"
import { useI18n } from "@/lib/i18n"

/** Set by the login page; the language he picked there is copied to his settings once he is in. */
export const LANG_SYNC_KEY = "sajilo.syncLang"

/**
 * The login page can't save the language itself: its action would be POSTed to `/` with the new
 * session cookie, and the middleware sends a signed-in visitor on `/` to Munshi. So it leaves a
 * note, and the first signed-in page saves it (Munshi's replies and voice follow that setting).
 */
export function LangSync() {
    const { lang } = useI18n()
    useEffect(() => {
        let pending: string | null = null
        try {
            pending = sessionStorage.getItem(LANG_SYNC_KEY)
            sessionStorage.removeItem(LANG_SYNC_KEY)
        } catch {
            return
        }
        if (pending) void updateSettings({ language: lang }).catch(() => {})
    }, [lang])
    return null
}
