import { toNepaliDigits } from "@repo/calendar"
import { dict, type DictKey, type Lang } from "./dict"

export type Vars = Record<string, string | number>

// South Asian grouping: 1,00,000
export function groupIndian(n: number): string {
    const neg = n < 0
    const [int, dec] = Math.abs(n).toFixed(2).split(".") as [string, string]
    const last3 = int.slice(-3)
    const rest = int.slice(0, -3)
    const grouped = rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + last3 : last3
    const withDec = dec === "00" ? grouped : `${grouped}.${dec}`
    return (neg ? "-" : "") + withDec
}

export function formatMoney(n: number, lang: Lang): string {
    const s = groupIndian(n)
    return lang === "ne" ? `रु ${toNepaliDigits(s)}` : `Rs ${s}`
}

export function translate(lang: Lang, key: DictKey, vars?: Vars): string {
    let s: string = dict[lang][key] ?? dict.en[key] ?? key
    if (vars) {
        for (const [k, v] of Object.entries(vars)) {
            const value = typeof v === "number" && lang === "ne" ? toNepaliDigits(v) : String(v)
            s = s.replaceAll(`{${k}}`, value)
        }
    }
    return s
}
