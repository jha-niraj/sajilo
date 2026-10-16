import "server-only"
import { z } from "zod"
import { generateText } from "ai"
import { logAiUsage } from "@repo/ai/usage"
import { adToBs } from "@repo/calendar"
import { parseCustomerList } from "@/lib/parse-list"
import { munshiModel, samplingFor } from "@/lib/munshi/model"

export type ScanKind = "customers" | "collections" | "loans"

const conf = z.enum(["high", "low"]).catch("low")
const num = z.coerce.number().nullable().catch(null)
const str = z.string().trim().nullable().catch(null)
const bsDate = z
    .object({ year: z.coerce.number(), month: z.coerce.number(), day: z.coerce.number() })
    .nullable()
    .catch(null)

export const customerRowSchema = z.object({ name: z.string().trim().min(1), dailyAmount: num, phone: str, accountNo: str, confidence: conf })
export const collectionRowSchema = z.object({ name: z.string().trim().min(1), date: bsDate, amount: num, confidence: conf })
export const loanRowSchema = z.object({
    name: z.string().trim().min(1),
    amount: num,
    date: bsDate,
    ratePer100: num,
    phone: str,
    confidence: conf,
})

export type CustomerScanRow = z.infer<typeof customerRowSchema>
export type CollectionScanRow = z.infer<typeof collectionRowSchema>
export type LoanScanRow = z.infer<typeof loanRowSchema>

export type ScanResult =
    | { kind: "customers"; rows: CustomerScanRow[]; ai: boolean }
    | { kind: "collections"; rows: CollectionScanRow[]; ai: boolean }
    | { kind: "loans"; rows: LoanScanRow[]; ai: boolean }

const COMMON = `You read OCR text of a handwritten Nepali notebook page kept by a bank daily-savings collector in Nepal.
The text may mix Nepali (Devanagari) and English, use Nepali digits (०-९), and contain OCR mistakes. Fix obvious OCR errors in names.
Return ONLY JSON. Every row gets "confidence": "high" when you are sure, "low" when anything in it is a guess.
Dates in the notebook are Bikram Sambat (BS). Output dates as {"year":2083,"month":6,"day":12} (month 1 = Baishakh). If only day numbers are written, use the given current BS year and month. If a date is missing use null.
Amounts are rupees as plain numbers (no commas). Never invent rows that are not in the text.`

const PROMPTS: Record<ScanKind, string> = {
    customers: `${COMMON}
This page is the LIST OF CUSTOMERS (shops/people) he collects from, in route order, with how much each gives daily.
Return {"rows":[{"name":"...","dailyAmount":200,"phone":"98XXXXXXXX or null","accountNo":"bank account no or null","confidence":"high"}]} in the same order as the page. Skip page titles, headings and totals; only real customers.`,
    collections: `${COMMON}
This page records PAST DAILY COLLECTIONS: who paid how much on which date. It may be a table with names as rows and dates as columns, or a list per day.
Return one row per (person, date) payment: {"rows":[{"name":"...","date":{"year":2083,"month":6,"day":12},"amount":200,"confidence":"high"}]}. Skip blank or zero cells.`,
    loans: `${COMMON}
This page records MONEY HE LENT to people, usually with amount, date given, and interest rate as "Rs X per 100 per month" (सयकडा).
Return {"rows":[{"name":"...","amount":20000,"date":{"year":2083,"month":5,"day":3},"ratePer100":2,"phone":null,"confidence":"high"}]}. ratePer100 is null if not written.`,
}

function fallback(kind: ScanKind, text: string): ScanResult {
    if (kind === "customers") {
        return {
            kind,
            ai: false,
            rows: parseCustomerList(text).map((p) => ({
                name: p.name,
                dailyAmount: p.defaultAmount,
                phone: p.phone,
                accountNo: p.bankAccountNo,
                confidence: "low" as const,
            })),
        }
    }
    return { kind, ai: false, rows: [] } as ScanResult
}

/** Pull the first JSON object out of a model reply (models sometimes wrap it in ``` fences or prose). */
function extractJson(text: string): unknown {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
    const body = fenced ? fenced[1]! : text
    const start = body.indexOf("{")
    const end = body.lastIndexOf("}")
    if (start < 0 || end <= start) return null
    try {
        return JSON.parse(body.slice(start, end + 1))
    } catch {
        return null
    }
}

export async function structureScan(kind: ScanKind, text: string, today: string, userId: string, scanId: string): Promise<ScanResult> {
    const m = munshiModel()
    if (!m || !text.trim()) return fallback(kind, text)

    const bs = adToBs(today)
    let reply: string
    try {
        const res = await generateText({
            model: m.model,
            system: PROMPTS[kind],
            prompt: `Current BS date: ${bs.year}-${bs.month}-${bs.day}\n\nOCR TEXT:\n${text.slice(0, 20_000)}\n\nReturn only the JSON object.`,
            ...samplingFor(m, 0),
            abortSignal: AbortSignal.timeout(60_000),
        })
        reply = res.text
        void logAiUsage({
            referenceId: scanId,
            referenceType: `SCAN_${kind.toUpperCase()}`,
            modelId: m.id,
            inputTokens: res.usage?.promptTokens ?? 0,
            outputTokens: res.usage?.completionTokens ?? 0,
            userId,
        })
    } catch (e) {
        console.error("[scan] structuring failed", e)
        return fallback(kind, text)
    }

    const raw = extractJson(reply)
    if (!raw) return fallback(kind, text)
    const rows = (raw as { rows?: unknown[] })?.rows ?? []
    const schema = kind === "customers" ? customerRowSchema : kind === "collections" ? collectionRowSchema : loanRowSchema
    const parsed = rows.map((r) => schema.safeParse(r)).flatMap((r) => (r.success ? [r.data] : []))
    return { kind, ai: true, rows: parsed } as ScanResult
}
