"use server"

import { db, and, eq, desc, sql } from "@repo/db"
import { scanJob, customer, loan } from "@repo/db/schema"
import { submitDigitiseJob, checkJobStatus, fetchJobOutput, pickOutputText, sarvamHtmlToText } from "@repo/sarvamai"
import { isR2Configured, putObject, generateKey, deleteFile } from "@repo/storage"
import { actionCollectorId } from "@/lib/session"
import { nepalToday } from "@/lib/today"
import { structureScan, type ScanKind, type ScanResult } from "@/lib/scan/structure"
import { applyOps, fillEntries } from "@/lib/collection/server"
import { findOrCreateBorrower } from "@/lib/lending/server"
import { createCustomers } from "./customer.action"

const MAX_BYTES = 10 * 1024 * 1024
const KINDS: ScanKind[] = ["customers", "collections", "loans"]

/** One row on the review screen, as he edits it (kept in `scan_job.draft`). */
export interface ScanDraftRow {
    key: string
    name: string
    amount: string
    phone: string
    account: string
    date: string
    rate: string
    customerId: string
    low: boolean
}

export type ScanState =
    | { id: string; kind: ScanKind; status: "reading" | "structuring"; hasPhoto: boolean; isPdf: boolean }
    | { id: string; kind: ScanKind; status: "review"; result: ScanResult; rawText: string; draft: ScanDraftRow[] | null; hasPhoto: boolean; isPdf: boolean }
    | { id: string; kind: ScanKind; status: "applied"; result: ScanResult; rawText: string; draft: ScanDraftRow[] | null; appliedAt: string | null; appliedCount: number; hasPhoto: boolean; isPdf: boolean }
    | { id: string; kind: ScanKind; status: "failed"; error: string; hasPhoto: boolean; isPdf: boolean }

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
    if (!job) return { id, kind: "customers", status: "failed", error: "not_found", hasPhoto: false, isPdf: false }
    const base = { id, kind: job.kind, hasPhoto: Boolean(job.r2Key), isPdf: job.imageMime === "application/pdf" }
    const draft = (job.draft as ScanDraftRow[] | null) ?? null
    if (job.status === "review") return { ...base, status: "review", result: job.result as ScanResult, rawText: job.rawText ?? "", draft }
    if (job.status === "applied")
        return {
            ...base,
            status: "applied",
            result: job.result as ScanResult,
            rawText: job.rawText ?? "",
            draft,
            appliedAt: job.appliedAt?.toISOString() ?? null,
            // Pages saved before the count was kept: the rows that were on screen.
            appliedCount: job.appliedCount ?? (draft ?? (job.result as ScanResult | null)?.rows ?? []).length,
        }
    if (job.status === "failed") return { ...base, status: "failed", error: job.error ?? "failed" }

    const apiKey = process.env.SARVAM_API_KEY!
    try {
        let text = job.rawText
        if (!text) {
            const st = await checkJobStatus(job.sarvamJobId!, apiKey)
            if (!st.terminal) return { ...base, status: "reading" }
            if (st.failed) throw new Error(`sarvam ${st.state}`)
            const files = await fetchJobOutput(job.sarvamJobId!, apiKey, "md")
            text = pickOutputText(files, "md") || sarvamHtmlToText(pickOutputText(files, "html"))
            await db.update(scanJob).set({ rawText: text, status: "structuring" }).where(eq(scanJob.id, id))
        }
        const result = await structureScan(job.kind, text, nepalToday(), collectorId, id)
        await db.update(scanJob).set({ result, status: "review" }).where(eq(scanJob.id, id))
        return { ...base, status: "review", result, rawText: text, draft: null }
    } catch (e) {
        const error = e instanceof Error ? e.message : String(e)
        await db.update(scanJob).set({ status: "failed", error }).where(eq(scanJob.id, id))
        return { ...base, status: "failed", error }
    }
}

/** His edits on the review screen. Only while the page is still waiting to be saved. */
export async function saveScanDraft(id: string, rows: ScanDraftRow[]): Promise<{ ok: boolean }> {
    const collectorId = await actionCollectorId()
    const clip = (v: unknown, n: number) => String(v ?? "").slice(0, n)
    const clean: ScanDraftRow[] = rows.slice(0, 300).map((r) => ({
        key: clip(r.key, 40),
        name: clip(r.name, 120),
        amount: clip(r.amount, 20),
        phone: clip(r.phone, 30),
        account: clip(r.account, 40),
        date: clip(r.date, 10),
        rate: clip(r.rate, 10),
        customerId: clip(r.customerId, 60),
        low: Boolean(r.low),
    }))
    const done = await db
        .update(scanJob)
        .set({ draft: clean })
        .where(and(eq(scanJob.id, id), eq(scanJob.collectorId, collectorId), eq(scanJob.status, "review")))
        .returning({ id: scanJob.id })
    return { ok: done.length > 0 }
}

/** Removes a scan and its photo. Customers, payments or loans it already saved stay. */
export async function deleteScan(id: string): Promise<{ ok: boolean }> {
    const collectorId = await actionCollectorId()
    const [row] = await db
        .delete(scanJob)
        .where(and(eq(scanJob.id, id), eq(scanJob.collectorId, collectorId)))
        .returning({ r2Key: scanJob.r2Key })
    if (row?.r2Key) await deleteFile(row.r2Key).catch((e) => console.error("[scan] could not delete photo", e))
    return { ok: Boolean(row) }
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
): Promise<{ count: number; already?: boolean }> {
    const collectorId = await actionCollectorId()
    // Claim the page first, so a double tap (or two phones) can never save it twice.
    const [claimed] = await db
        .update(scanJob)
        .set({ status: "applied", appliedAt: new Date() })
        .where(and(eq(scanJob.id, id), eq(scanJob.collectorId, collectorId), eq(scanJob.status, "review")))
        .returning({ id: scanJob.id })
    if (!claimed) return { count: 0, already: true }
    const today = nepalToday()
    let count = 0
    try {

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

    } catch (e) {
        await db.update(scanJob).set({ status: "review", appliedAt: null }).where(eq(scanJob.id, id))
        throw e
    }

    await db.update(scanJob).set({ appliedCount: count }).where(eq(scanJob.id, id))
    return { count }
}

export interface RecentScan {
    id: string
    kind: ScanKind
    status: "reading" | "structuring" | "review" | "applied" | "failed"
    createdAt: string
    appliedAt: string | null
    /** Rows found (or, once saved, rows saved) */
    count: number
    hasPhoto: boolean
    isPdf: boolean
}

export async function recentScans(): Promise<RecentScan[]> {
    const collectorId = await actionCollectorId()
    const rows = await db
        .select({
            id: scanJob.id,
            kind: scanJob.kind,
            status: scanJob.status,
            createdAt: scanJob.createdAt,
            appliedAt: scanJob.appliedAt,
            appliedCount: scanJob.appliedCount,
            result: scanJob.result,
            draft: scanJob.draft,
            r2Key: scanJob.r2Key,
            imageMime: scanJob.imageMime,
        })
        .from(scanJob)
        .where(eq(scanJob.collectorId, collectorId))
        .orderBy(desc(scanJob.createdAt))
        .limit(30)
    return rows.map((r) => ({
        id: r.id,
        kind: r.kind,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
        appliedAt: r.appliedAt?.toISOString() ?? null,
        count:
            r.status === "applied" && r.appliedCount !== null
                ? r.appliedCount
                : ((r.draft as unknown[] | null) ?? (r.result as { rows?: unknown[] } | null)?.rows ?? []).length,
        hasPhoto: Boolean(r.r2Key),
        isPdf: r.imageMime === "application/pdf",
    }))
}
