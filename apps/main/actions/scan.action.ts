"use server"

import { db, and, eq, desc, sql } from "@repo/db"
import { scanJob, customer, loan } from "@repo/db/schema"
import { submitDigitiseJob, checkJobStatus, fetchJobOutput, pickOutputText, sarvamHtmlToText } from "@repo/sarvamai"
import { isR2Configured, putObject, generateKey } from "@repo/storage"
import { actionCollectorId } from "@/lib/session"
import { nepalToday } from "@/lib/today"
import { structureScan, type ScanKind, type ScanResult } from "@/lib/scan/structure"
import { applyOps, fillEntries } from "@/lib/collection/server"
import { findOrCreateBorrower } from "@/lib/lending/server"
import { createCustomers } from "./customer.action"

const MAX_BYTES = 10 * 1024 * 1024
const KINDS: ScanKind[] = ["customers", "collections", "loans"]

export type ScanState =
    | { id: string; status: "reading" | "structuring" }
    | { id: string; status: "review"; result: ScanResult; rawText: string }
    | { id: string; status: "applied" }
    | { id: string; status: "failed"; error: string }

export async function startScan(formData: FormData): Promise<{ id: string } | { error: "no_sarvam" | "too_big" | "bad_file" }> {
    const collectorId = await actionCollectorId()
    const apiKey = process.env.SARVAM_API_KEY
    if (!apiKey) return { error: "no_sarvam" }

    const kind = String(formData.get("kind")) as ScanKind
    const file = formData.get("file")
    if (!KINDS.includes(kind) || !(file instanceof File)) return { error: "bad_file" }
    if (file.size > MAX_BYTES) return { error: "too_big" }

    const bytes = new Uint8Array(await file.arrayBuffer())
    const mime = file.type || "image/jpeg"

    let r2Key: string | null = null
    if (isR2Configured()) {
        try {
            r2Key = generateKey("scans", collectorId, file.name || "page.jpg")
            await putObject(r2Key, bytes, mime)
        } catch (e) {
            console.error("[scan] could not keep photo in R2", e)
            r2Key = null
        }
    }

    const jobId = await submitDigitiseJob(bytes, {
        apiKey,
        language: "ne-IN",
        outputFormat: "md",
        contentType: "handwritten",
        mime,
        log: () => {},
    })

    const [row] = await db
        .insert(scanJob)
        .values({ collectorId, kind, status: "reading", sarvamJobId: jobId, r2Key, imageMime: mime })
        .returning({ id: scanJob.id })
    return { id: row!.id }
}

export async function pollScan(id: string): Promise<ScanState> {
    const collectorId = await actionCollectorId()
    const job = await db.query.scanJob.findFirst({ where: and(eq(scanJob.id, id), eq(scanJob.collectorId, collectorId)) })
    if (!job) return { id, status: "failed", error: "not_found" }
    if (job.status === "review") return { id, status: "review", result: job.result as ScanResult, rawText: job.rawText ?? "" }
    if (job.status === "applied") return { id, status: "applied" }
    if (job.status === "failed") return { id, status: "failed", error: job.error ?? "failed" }

    const apiKey = process.env.SARVAM_API_KEY!
    try {
        let text = job.rawText
        if (!text) {
            const st = await checkJobStatus(job.sarvamJobId!, apiKey)
            if (!st.terminal) return { id, status: "reading" }
            if (st.failed) throw new Error(`sarvam ${st.state}`)
            const files = await fetchJobOutput(job.sarvamJobId!, apiKey, "md")
            text = pickOutputText(files, "md") || sarvamHtmlToText(pickOutputText(files, "html"))
            await db.update(scanJob).set({ rawText: text, status: "structuring" }).where(eq(scanJob.id, id))
        }
        const result = await structureScan(job.kind, text, nepalToday(), collectorId, id)
        await db.update(scanJob).set({ result, status: "review" }).where(eq(scanJob.id, id))
        return { id, status: "review", result, rawText: text }
    } catch (e) {
        const error = e instanceof Error ? e.message : String(e)
        await db.update(scanJob).set({ status: "failed", error }).where(eq(scanJob.id, id))
        return { id, status: "failed", error }
    }
}

export interface ApplyCustomersRow {
    name: string
    dailyAmount: number
    phone?: string | null
    accountNo?: string | null
}
export interface ApplyCollectionsRow {
    customerId: string
    date: string
    amount: number
}
export interface ApplyLoansRow {
    name: string
    amount: number
    date: string
    ratePer100: number
    phone?: string | null
}

export async function applyScan(
    id: string,
    payload:
        | { kind: "customers"; rows: ApplyCustomersRow[] }
        | { kind: "collections"; rows: ApplyCollectionsRow[] }
        | { kind: "loans"; rows: ApplyLoansRow[] },
): Promise<{ count: number }> {
    const collectorId = await actionCollectorId()
    const job = await db.query.scanJob.findFirst({ where: and(eq(scanJob.id, id), eq(scanJob.collectorId, collectorId)) })
    if (!job || job.status === "applied") return { count: 0 }
    const today = nepalToday()
    let count = 0

    if (payload.kind === "customers") {
        const res = await createCustomers(
            payload.rows
                .filter((r) => r.name.trim() && r.dailyAmount > 0)
                .map((r) => ({ name: r.name, defaultAmount: r.dailyAmount, phone: r.phone, bankAccountNo: r.accountNo, startDate: today })),
        )
        count = res.count
    } else if (payload.kind === "collections") {
        const now = new Date(Date.now() - 1000).toISOString()
        const rows = payload.rows.filter((r) => r.amount > 0 && r.date <= today)
        // Customers who started later than an imported payment start from that payment instead.
        const earliest = new Map<string, string>()
        for (const r of rows) if (!earliest.has(r.customerId) || r.date < earliest.get(r.customerId)!) earliest.set(r.customerId, r.date)
        for (const [cid, d] of earliest) {
            await db
                .update(customer)
                .set({ startDate: d })
                .where(and(eq(customer.id, cid), eq(customer.collectorId, collectorId), sql`${customer.startDate} > ${d}`))
            await fillEntries(collectorId, [cid], d, today)
        }
        const res = await applyOps(
            collectorId,
            rows.map((r, i) => ({ opId: `scan-${id}-${i}`, customerId: r.customerId, date: r.date, status: "paid", amountReceived: Math.round(r.amount), markedAt: now })),
        )
        count = res.applied.length
    } else {
        for (const r of payload.rows) {
            if (!r.name.trim() || !(r.amount > 0)) continue
            const borrowerId = await findOrCreateBorrower(collectorId, { name: r.name, phone: r.phone })
            await db.insert(loan).values({ collectorId, borrowerId, principal: r.amount, ratePer100: r.ratePer100, startDate: r.date })
            count++
        }
    }

    await db.update(scanJob).set({ status: "applied", appliedAt: new Date() }).where(eq(scanJob.id, id))
    return { count }
}

export async function recentScans() {
    const collectorId = await actionCollectorId()
    return db
        .select({ id: scanJob.id, kind: scanJob.kind, status: scanJob.status, createdAt: scanJob.createdAt })
        .from(scanJob)
        .where(eq(scanJob.collectorId, collectorId))
        .orderBy(desc(scanJob.createdAt))
        .limit(10)
}
