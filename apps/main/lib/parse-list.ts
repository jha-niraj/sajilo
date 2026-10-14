import { toAsciiDigits } from "./phone"

export interface ParsedCustomerLine {
    name: string
    defaultAmount: number | null
    phone: string | null
    bankAccountNo: string | null
}

const RUPEE = /^(rs\.?|npr|रु\.?|रू\.?)$/i

/**
 * "Ram Kirana, 200, 9841234567" / "राम किराना २००" / "1. Sita Store - Rs 300 - A/c 0123456".
 * Phone = 10 digits starting with 9. Amount = first other number up to 6 digits.
 * A longer digit run is taken as the bank account number.
 */
export function parseCustomerLine(raw: string): ParsedCustomerLine | null {
    const line = toAsciiDigits(raw)
        .replace(/^\s*\d+\s*[.)]\s+/, "")
        .trim()
    if (!line) return null

    const tokens = line.split(/[,\t|;]+|\s+-\s+|\s{2,}/).flatMap((p) => p.trim().split(/\s+/)).filter(Boolean)
    let phone: string | null = null
    let amount: number | null = null
    let account: string | null = null
    const nameParts: string[] = []

    for (const tok of tokens) {
        const clean = tok.replace(/[,/-]/g, "")
        if (RUPEE.test(tok) || /^a\/?c:?$/i.test(tok) || tok === "खाता") continue
        if (/^9\d{9}$/.test(clean) && !phone) phone = clean
        else if (/^\d{1,6}$/.test(clean) && amount === null) amount = Number(clean)
        else if (/^\d{7,}$/.test(clean) && !account) account = clean
        else if (/^rs\.?\d+$/i.test(tok) && amount === null) amount = Number(tok.replace(/\D/g, ""))
        else nameParts.push(tok)
    }

    const name = nameParts.join(" ").replace(/[-:]+$/, "").trim()
    if (!name) return null
    return { name, defaultAmount: amount, phone, bankAccountNo: account }
}

export function parseCustomerList(text: string): ParsedCustomerLine[] {
    return text
        .split(/\r?\n/)
        .map(parseCustomerLine)
        .filter((x): x is ParsedCustomerLine => x !== null)
}
