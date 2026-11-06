"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { formatBs, formatBsMonth, adToBs, toNepaliDigits, WEEKDAYS_NE, WEEKDAYS_EN, adDayOfWeek } from "@repo/calendar"
import { calLang, isLang, type DictKey, type Lang } from "./dict"
import { formatMoney, groupIndian, translate, type Vars } from "./format"

interface I18n {
    lang: Lang
    /** False on a static page until the saved language has been read in the browser */
    ready: boolean
    setLang: (lang: Lang) => void
    t: (key: DictKey, vars?: Vars) => string
    num: (n: number) => string
    money: (n: number) => string
    date: (ad: string, withYear?: boolean) => string
    weekday: (ad: string) => string
    month: (year: number, month: number) => string
}

const I18nContext = createContext<I18n | null>(null)

export const LANG_STORAGE_KEY = "sajilo.lang"

/**
 * `initialLang` comes from the server where the page is dynamic anyway (the signed-in app). Static
 * pages (login, sign-up) leave it out and read the saved language in the browser; they show a
 * loader until `ready`, so the wrong language never flashes.
 */
export function I18nProvider({ initialLang, children }: { initialLang?: Lang; children: React.ReactNode }) {
    const [lang, setLangState] = useState<Lang>(initialLang ?? "en")
    const [ready, setReady] = useState(initialLang !== undefined)

    useEffect(() => {
        if (initialLang !== undefined) return
        let saved: string | null = null
        try {
            saved = localStorage.getItem(LANG_STORAGE_KEY) ?? document.cookie.match(/(?:^|; )sajilo\.lang=(ne|en|mai)/)?.[1] ?? null
        } catch {
            // storage blocked
        }
        if (isLang(saved)) setLangState(saved)
        setReady(true)
    }, [initialLang])

    useEffect(() => {
        document.documentElement.lang = lang === "mai" ? "mai" : lang
    }, [lang])

    const setLang = useCallback((next: Lang) => {
        setLangState(next)
        try {
            localStorage.setItem(LANG_STORAGE_KEY, next)
            document.cookie = `${LANG_STORAGE_KEY}=${next}; path=/; max-age=31536000; samesite=lax`
        } catch {
            // storage blocked (private mode); the in-memory language still applies
        }
    }, [])

    const value = useMemo<I18n>(
        () => ({
            lang,
            ready,
            setLang,
            t: (key, vars) => translate(lang, key, vars),
            num: (n) => (lang === "ne" ? toNepaliDigits(groupIndian(n)) : groupIndian(n)),
            money: (n) => formatMoney(n, lang),
            date: (ad, withYear = false) => formatBs(adToBs(ad), calLang(lang), withYear),
            weekday: (ad) => (lang === "ne" ? WEEKDAYS_NE : WEEKDAYS_EN)[adDayOfWeek(ad)]!,
            month: (year, month) => formatBsMonth(year, month, calLang(lang)),
        }),
        [lang, ready, setLang],
    )

    return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18n {
    const ctx = useContext(I18nContext)
    if (!ctx) throw new Error("useI18n must be used inside I18nProvider")
    return ctx
}
