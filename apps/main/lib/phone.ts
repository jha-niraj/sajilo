// Nepali mobile numbers: 10 digits starting with 9. Stored as +977XXXXXXXXXX.
const NE_TO_EN: Record<string, string> = { "०": "0", "१": "1", "२": "2", "३": "3", "४": "4", "५": "5", "६": "6", "७": "7", "८": "8", "९": "9" }

export function toAsciiDigits(s: string): string {
    return s.replace(/[०-९]/g, (d) => NE_TO_EN[d] ?? d)
}

export function normalizePhone(input: string): string | null {
    let digits = toAsciiDigits(input).replace(/\D/g, "")
    if (digits.startsWith("977") && digits.length === 13) digits = digits.slice(3)
    if (!/^9\d{9}$/.test(digits)) return null
    return `+977${digits}`
}

export function phoneTempEmail(e164: string): string {
    return `${e164.replace(/\D/g, "")}@phone.sajilo.app`
}

export function displayPhone(e164: string | null | undefined): string {
    if (!e164) return ""
    return e164.replace(/^\+977/, "")
}
