import "server-only"
import { db, and, eq, asc } from "@repo/db"
import { customer, borrower } from "@repo/db/schema"
import { adToBs, bsToAd, formatBs, toNepaliDigits } from "@repo/calendar"
import { listLoans } from "@/lib/lending/server"
import type { MunshiToolContext } from "./types"

const norm = (s: string) => s.toLowerCase().normalize("NFC").replace(/[\s.\-_,]/g, "")

/** Exact, then unique partial match. Otherwise the closest names, so Munshi can ask which one. */
export function matchName<T extends { name: string }>(rows: T[], name: string): { hit?: T; candidates: string[] } {
    const n = norm(name)
    if (!n) return { candidates: [] }
    const exact = rows.filter((r) => norm(r.name) === n)
    if (exact.length === 1) return { hit: exact[0], candidates: [] }
    const partial = rows.filter((r) => norm(r.name).includes(n) || n.includes(norm(r.name)))
    if (partial.length === 1) return { hit: partial[0], candidates: [] }
    return { candidates: (partial.length ? partial : rows).slice(0, 8).map((r) => r.name) }
}

export function notFound(candidates: string[]) {
    return { error: "not_found", did_you_mean: candidates }
}

export async function activeCustomers(ctx: Pick<MunshiToolContext, "collectorId">) {
    return db
        .select()
        .from(customer)
        .where(and(eq(customer.collectorId, ctx.collectorId), eq(customer.isActive, true)))
        .orderBy(asc(customer.routeOrder))
}

export async function borrowers(ctx: Pick<MunshiToolContext, "collectorId">) {
    return db.select().from(borrower).where(eq(borrower.collectorId, ctx.collectorId))
}

export async function activeLoansNamed(ctx: Pick<MunshiToolContext, "collectorId" | "today">) {
    const loans = await listLoans(ctx.collectorId, ctx.today, "active")
    return loans.map((l) => ({ ...l, name: l.borrowerName }))
}

/** Names for the system prompt and for speech recognition keyterms. */
export async function knownNames(ctx: Pick<MunshiToolContext, "collectorId">) {
    const [c, b] = await Promise.all([activeCustomers(ctx), borrowers(ctx)])
    return { customers: c.map((x) => x.name), borrowers: b.map((x) => x.name) }
}

export const bsLabel = (ad: string) => formatBs(adToBs(ad), "en")

/** Confirm cards are read by him in the app's language; the tool results stay English for the model. */
export function cardWords(lang: "ne" | "en") {
    const ne = lang === "ne"
    const rs = (n: number) => (ne ? `रु ${toNepaliDigits(n.toLocaleString("en-IN"))}` : `Rs ${n.toLocaleString("en-IN")}`)
    return {
        rs,
        date: (ad: string) => formatBs(adToBs(ad), lang),
        paid: (n: number) => rs(n),
        shopClosed: ne ? "पसल बन्द" : "Shop closed",
        noMoney: ne ? "आज पैसा छैन" : "No money today",
        newCustomer: (name: string) => (ne ? `नयाँ ग्राहक: ${name}` : `New customer: ${name}`),
        daily: (n: number) => (ne ? `दिनको ${rs(n)}` : `${rs(n)} daily`),
        loanTo: (name: string, n: number) => (ne ? `${name} लाई सापटी: ${rs(n)}` : `Loan to ${name}: ${rs(n)}`),
        rate: (r: number) => (ne ? `सयकडा मासिक रु ${toNepaliDigits(r)}` : `Rs ${r} per 100 per month`),
        given: (ad: string) => (ne ? `दिएको: ${formatBs(adToBs(ad), "ne")}` : `Given ${formatBs(adToBs(ad), "en")}`),
        newBorrower: ne ? "नयाँ ऋणी" : "New borrower",
        returned: (name: string, n: number) => (ne ? `${name} ले ${rs(n)} फिर्ता गर्यो` : `${name} returned ${rs(n)}`),
        owesToday: (n: number) => (ne ? `आज जम्मा ${rs(n)} बाँकी` : `Owes ${rs(n)} today`),
    }
}

export function bsArgToAd(d: { year?: number; month?: number; day?: number } | null | undefined): string | null {
    if (!d?.year || !d.month || !d.day) return null
    try {
        return bsToAd({ year: Number(d.year), month: Number(d.month), day: Number(d.day) })
    } catch {
        return null
    }
}
