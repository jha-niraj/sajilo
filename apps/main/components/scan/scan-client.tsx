"use client"

import { useCallback, useEffect, useId, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { CalendarDays, Camera, Check, ChevronDown, ChevronRight, FileText, HandCoins, Images, Plus, Trash2, Users } from "lucide-react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@repo/ui/components/ui/collapsible"
import { ScrollArea } from "@repo/ui/components/ui/scroll-area"
import { cn } from "@repo/ui/lib/utils"
import { Loader } from "@repo/ui/components/ui/loader"
import { useConfirm } from "@repo/ui/components/ui/use-confirm"
import { DateField } from "@/components/day-picker"
import { bsToAd } from "@repo/calendar"
import { toNepalDateStr } from "@repo/calendar"
import { PageTop } from "@/components/shell/page-top"
import { useI18n } from "@/lib/i18n"
import { toAsciiDigits } from "@/lib/phone"
import { refreshDay } from "@/lib/offline/sync"
import { applyScan, deleteScan, pollScan, recentScans, saveScanDraft, startScan, type RecentScan, type ScanDraftRow, type ScanState } from "@/actions/scan.action"
import type { CustomerRow } from "@/actions/customer.action"
import type { DictKey } from "@/lib/dict"
import type { ScanKind } from "@/lib/scan/structure"
import { compressImage } from "./compress"
import { Choice } from "@/components/choice"
import { isOnline } from "@/lib/offline/network"

type Phase = "pick" | "opening" | "uploading" | "reading" | "structuring" | "review" | "applied" | "failed"

type EditRow = ScanDraftRow

const KIND_LABEL: Record<ScanKind, DictKey> = { customers: "scanCustomers", collections: "scanCollections", loans: "scanLoans" }
const KIND_HINT: Record<ScanKind, DictKey> = { customers: "scanHintCustomers", collections: "scanHintCollections", loans: "scanHintLoans" }
const KIND_ICON: Record<ScanKind, typeof Users> = { customers: Users, collections: CalendarDays, loans: HandCoins }
const STATUS_LABEL: Record<RecentScan["status"], DictKey> = {
    reading: "scanStatusReading",
    structuring: "scanStatusReading",
    review: "scanStatusReview",
    applied: "scanStatusApplied",
    failed: "scanStatusFailed",
}

/** Keeps the open scan in the address (?id=), so a refresh or coming back reopens it. */
function setUrlScan(id: string | null) {
    const url = new URL(window.location.href)
    if (id) url.searchParams.set("id", id)
    else url.searchParams.delete("id")
    window.history.replaceState(null, "", url.pathname + url.search)
}

function safeBsToAd(d: { year: number; month: number; day: number } | null, fallback: string): string {
    if (!d) return fallback
    try {
        return bsToAd(d)
    } catch {
        return fallback
    }
}

const norm = (s: string) => s.toLowerCase().replace(/[\s.\-_]/g, "")

function matchCustomer(name: string, customers: CustomerRow[]): string {
    const n = norm(name)
    if (!n) return ""
    const exact = customers.find((c) => norm(c.name) === n)
    if (exact) return exact.id
    const partial = customers.find((c) => norm(c.name).includes(n) || n.includes(norm(c.name)))
    return partial?.id ?? ""
}

export function ScanClient({
    initialKind,
    initialId,
    initialRecent,
    customers,
    today,
    defaultRate,
}: {
    initialKind: ScanKind
    initialId: string | null
    initialRecent: RecentScan[]
    customers: CustomerRow[]
    today: string
    defaultRate: number
}) {
    const { t, money, date } = useI18n()
    const router = useRouter()
    const [kind, setKind] = useState<ScanKind>(initialKind)
    const [phase, setPhase] = useState<Phase>(initialId ? "opening" : "pick")
    const [scanId, setScanId] = useState<string | null>(initialId)
    const [recent, setRecent] = useState<RecentScan[]>(initialRecent)
    const [applied, setApplied] = useState<{ at: string | null; count: number } | null>(null)
    const { confirm: ask, confirmDialog } = useConfirm()
    const [rows, setRows] = useState<EditRow[]>([])
    const [rawText, setRawText] = useState("")
    const [aiUsed, setAiUsed] = useState(true)
    const [preview, setPreview] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)
    const cameraId = useId()
    const galleryId = useId()

    // The rows as last loaded or saved, so the draft is only written when he actually changed something.
    const savedRows = useRef("")

    const showState = useCallback(
        (s: ScanState) => {
            setKind(s.kind)
            if (!preview && s.hasPhoto && !s.isPdf) setPreview(`/api/scan-photo/${s.id}`)
            if (s.status === "review" || s.status === "applied") {
                setRawText(s.rawText)
                setAiUsed(s.result.ai)
                const next = s.draft ?? toEditRows(s.result)
                savedRows.current = JSON.stringify(next)
                setRows(next)
                if (s.status === "applied") setApplied({ at: s.appliedAt, count: s.appliedCount })
                setPhase(s.status)
            } else if (s.status === "failed") {
                setPhase("failed")
            } else {
                setPhase(s.status === "structuring" ? "structuring" : "reading")
            }
        },
        [preview], // eslint-disable-line react-hooks/exhaustive-deps
    )

    // Reopen the scan in the address (after a refresh, or from Recent scans).
    useEffect(() => {
        if (phase !== "opening" || !scanId) return
        let stop = false
        pollScan(scanId)
            .then((s) => {
                if (stop) return
                if (s.status === "failed" && s.error === "not_found") return reset()
                showState(s)
            })
            .catch(() => !stop && setPhase("failed"))
        return () => {
            stop = true
        }
    }, [phase, scanId]) // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!scanId || (phase !== "reading" && phase !== "structuring")) return
        let stop = false
        const tick = async () => {
            if (stop) return
            const s: ScanState = await pollScan(scanId).catch(() => ({ id: scanId, kind, status: "reading" as const, hasPhoto: false, isPdf: false }))
            if (stop) return
            showState(s)
            if (s.status === "reading" || s.status === "structuring") setTimeout(tick, 3000)
        }
        const id = setTimeout(tick, 2500)
        return () => {
            stop = true
            clearTimeout(id)
        }
    }, [scanId, phase]) // eslint-disable-line react-hooks/exhaustive-deps

    // Save his edits as he goes, so nothing is lost if the app is closed before Save all.
    useEffect(() => {
        if (phase !== "review" || !scanId) return
        const json = JSON.stringify(rows)
        if (json === savedRows.current) return
        const timer = setTimeout(() => {
            savedRows.current = json
            void saveScanDraft(scanId, rows).catch(() => {})
        }, 700)
        return () => clearTimeout(timer)
    }, [rows, phase, scanId])

    const toEditRows = (r: Extract<ScanState, { status: "review" }>["result"]): EditRow[] => {
        if (r.kind === "customers")
            return r.rows.map((x, i) => ({
                key: `r${i}`,
                name: x.name,
                amount: x.dailyAmount ? String(x.dailyAmount) : "",
                phone: x.phone ?? "",
                account: x.accountNo ?? "",
                date: today,
                rate: "",
                customerId: "",
                low: x.confidence === "low" || !x.dailyAmount,
            }))
        if (r.kind === "collections")
            return r.rows.map((x, i) => {
                const customerId = matchCustomer(x.name, customers)
                return {
                    key: `r${i}`,
                    name: x.name,
                    amount: x.amount ? String(x.amount) : "",
                    phone: "",
                    account: "",
                    date: safeBsToAd(x.date, today),
                    rate: "",
                    customerId,
                    low: x.confidence === "low" || !customerId || !x.date || !x.amount,
                }
            })
        return r.rows.map((x, i) => ({
            key: `r${i}`,
            name: x.name,
            amount: x.amount ? String(x.amount) : "",
            phone: x.phone ?? "",
            account: "",
            date: safeBsToAd(x.date, today),
            rate: String(x.ratePer100 ?? defaultRate),
            customerId: "",
            low: x.confidence === "low" || !x.amount || !x.date,
        }))
    }

    const onFile = async (file: File | undefined) => {
        if (!file) return
        if (!isOnline()) return void toast(t("needsInternet"))
        setPhase("uploading")
        setPreview(URL.createObjectURL(file))
        const small = await compressImage(file)
        const fd = new FormData()
        fd.set("kind", kind)
        fd.set("file", small)
        try {
            const res = await startScan(fd)
            if ("error" in res) {
                toast.error(t("scanFailed"))
                setPhase("failed")
                return
            }
            setScanId(res.id)
            setUrlScan(res.id)
            setPhase("reading")
        } catch {
            toast.error(t("scanFailed"))
            setPhase("failed")
        }
    }

    const pickFile = (input: HTMLInputElement) => {
        const file = input.files?.[0]
        // Cleared so picking the same photo again still fires onChange.
        input.value = ""
        void onFile(file)
    }

    const update = (key: string, patch: Partial<EditRow>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch, low: false } : r)))

    const save = async () => {
        if (!scanId) return
        setSaving(true)
        try {
            let res: { count: number; already?: boolean }
            if (kind === "customers") {
                res = await applyScan(scanId, {
                    kind,
                    rows: rows
                        .filter((r) => r.name.trim() && Number(r.amount) > 0)
                        .map((r) => ({ name: r.name, dailyAmount: Number(r.amount), phone: r.phone || null, accountNo: r.account || null })),
                })
            } else if (kind === "collections") {
                res = await applyScan(scanId, {
                    kind,
                    rows: rows
                        .filter((r) => r.customerId && Number(r.amount) > 0)
                        .map((r) => ({ customerId: r.customerId, date: r.date, amount: Number(r.amount) })),
                })
            } else {
                res = await applyScan(scanId, {
                    kind,
                    rows: rows
                        .filter((r) => r.name.trim() && Number(r.amount) > 0)
                        .map((r) => ({ name: r.name, amount: Number(r.amount), date: r.date, ratePer100: Number(r.rate) || defaultRate, phone: r.phone || null })),
                })
            }
            if (res.already) {
                toast(t("scanAlreadySaved"))
                setPhase("opening")
                return
            }
            toast.success(`${t("saved")} · ${res.count}`)
            void refreshDay()
            router.push(kind === "customers" ? "/manage" : kind === "loans" ? "/loans" : "/month")
        } catch {
            toast.error(t("somethingWrong"))
        } finally {
            setSaving(false)
        }
    }

    function reset() {
        setPhase("pick")
        setScanId(null)
        setRows([])
        setPreview(null)
        setApplied(null)
        setRawText("")
        setUrlScan(null)
        void recentScans().then(setRecent).catch(() => {})
    }

    const openScan = (id: string) => {
        if (!isOnline()) return void toast(t("needsInternet"))
        setPreview(null)
        setScanId(id)
        setUrlScan(id)
        setPhase("opening")
    }

    const removeScan = async (r: RecentScan) => {
        const ok = await ask({ title: t("deleteScanTitle"), description: t("deleteScanBody"), confirmText: t("delete"), cancelText: t("cancel"), destructive: true })
        if (!ok) return
        setRecent((xs) => xs.filter((x) => x.id !== r.id))
        await deleteScan(r.id).catch(() => toast.error(t("somethingWrong")))
    }

    return (
        <>
            <PageTop title={t("scanTitle")} backHref={kind === "customers" ? "/manage" : kind === "loans" ? "/loans" : "/more"} />
            <div className="space-y-4 px-4 pt-4">
                {phase === "pick" && (
                    <>
                        <section className="space-y-2">
                            <p className="px-1 text-[13px] font-semibold uppercase tracking-wide text-ink-3">{t("scanWhatPage")}</p>
                            <div className="grid grid-cols-3 gap-2">
                                {(Object.keys(KIND_LABEL) as ScanKind[]).map((k) => {
                                    const Icon = KIND_ICON[k]
                                    const on = kind === k
                                    return (
                                        <button
                                            key={k}
                                            type="button"
                                            onClick={() => setKind(k)}
                                            aria-pressed={on}
                                            className={cn(
                                                "flex min-h-[88px] flex-col items-center justify-center gap-1.5 rounded-2xl px-1.5 py-2.5 text-center text-[13.5px] font-semibold leading-tight transition-colors",
                                                on ? "bg-card text-ink ring-2 ring-saffron" : "bg-paper-2 text-ink-2",
                                            )}
                                        >
                                            <Icon className={cn("h-6 w-6", on ? "text-saffron" : "text-ink-3")} />
                                            {t(KIND_LABEL[k])}
                                        </button>
                                    )
                                })}
                            </div>
                        </section>

                        <div className="rounded-[24px] bg-card p-5 ring-1 ring-line">
                            <p className="text-[17px] font-semibold text-ink">{t(KIND_LABEL[kind])}</p>
                            <p className="mt-1 text-[14.5px] leading-snug text-ink-2">{t(KIND_HINT[kind])}</p>
                            <div className="mt-4 grid gap-2.5">
                                {/* Labels, not input.click() on a hidden input: iPhone home-screen apps ignore the scripted click. */}
                                <label
                                    htmlFor={cameraId}
                                    className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-ink text-[16px] font-semibold text-paper active:opacity-90"
                                >
                                    <Camera className="h-6 w-6" /> {t("takePhoto")}
                                </label>
                                <label
                                    htmlFor={galleryId}
                                    className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-paper-2 text-[15px] font-semibold text-ink active:bg-line"
                                >
                                    <Images className="h-5 w-5" /> {t("choosePhoto")}
                                </label>
                            </div>
                            <p className="mt-3 text-center text-[13px] text-ink-3">{t("scanTip")}</p>
                            <input id={cameraId} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} onChange={(e) => pickFile(e.currentTarget)} />
                            <input id={galleryId} type="file" accept="image/*,application/pdf" className="sr-only" tabIndex={-1} onChange={(e) => pickFile(e.currentTarget)} />
                        </div>

                        {recent.length > 0 && (
                            <section className="space-y-2 pb-4">
                                <p className="px-1 text-[13px] font-semibold uppercase tracking-wide text-ink-3">{t("recentScans")}</p>
                                <ul className="divide-y divide-line overflow-hidden rounded-[22px] bg-card ring-1 ring-line">
                                    {recent.map((r) => {
                                        const Icon = KIND_ICON[r.kind]
                                        const counted = r.status === "review" || r.status === "applied"
                                        return (
                                            <li key={r.id} className="flex items-center gap-1 pl-3 pr-1.5">
                                                <button type="button" onClick={() => openScan(r.id)} className="flex min-w-0 flex-1 items-center gap-3 py-3 text-left">
                                                    <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-paper-2 text-ink-3 ring-1 ring-line">
                                                        {r.hasPhoto && !r.isPdf ? (
                                                            // eslint-disable-next-line @next/next/no-img-element -- signed R2 link behind /api/scan-photo
                                                            <img src={`/api/scan-photo/${r.id}`} alt="" loading="lazy" className="h-full w-full object-cover" />
                                                        ) : r.isPdf ? (
                                                            <FileText className="h-5 w-5" />
                                                        ) : (
                                                            <Icon className="h-5 w-5" />
                                                        )}
                                                    </span>
                                                    <span className="min-w-0 flex-1">
                                                        <span className="block truncate text-[15px] font-medium text-ink">{t(KIND_LABEL[r.kind])}</span>
                                                        <span className="block text-[12.5px] text-ink-3">
                                                            {date(toNepalDateStr(new Date(r.createdAt)), true)}
                                                            {counted && ` · ${t("scanRowsCount", { count: r.count })}`}
                                                        </span>
                                                    </span>
                                                    <span
                                                        className={cn(
                                                            "shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold",
                                                            r.status === "review" && "bg-saffron-soft text-saffron",
                                                            r.status === "applied" && "bg-paid-soft text-paid",
                                                            r.status === "failed" && "bg-miss-soft text-miss",
                                                            (r.status === "reading" || r.status === "structuring") && "bg-paper-2 text-ink-2",
                                                        )}
                                                    >
                                                        {t(STATUS_LABEL[r.status])}
                                                    </span>
                                                    <ChevronRight className="h-4 w-4 shrink-0 text-ink-3" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => void removeScan(r)}
                                                    aria-label={t("delete")}
                                                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-3 active:bg-paper-2"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </li>
                                        )
                                    })}
                                </ul>
                            </section>
                        )}
                    </>
                )}

                {phase === "opening" && (
                    <div className="flex justify-center py-16">
                        <Loader size={28} dotSize={3} />
                    </div>
                )}

                {(phase === "uploading" || phase === "reading" || phase === "structuring") && (
                    <div className="overflow-hidden rounded-[22px] bg-card ring-1 ring-line">
                        {preview && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={preview} alt="" className="max-h-72 w-full object-cover opacity-60" />
                        )}
                        <div className="flex flex-col items-center gap-3 p-6">
                            <Loader size={32} dotSize={4} />
                            <p className="text-[15px] font-medium text-ink">{phase === "structuring" ? t("structuring") : t("reading")}</p>
                        </div>
                    </div>
                )}

                {phase === "failed" && (
                    <div className="rounded-[22px] bg-miss-soft p-6 text-center text-miss">
                        <p className="text-[15px] font-medium">{t("scanFailed")}</p>
                        <button type="button" onClick={reset} className="mt-4 rounded-2xl bg-ink px-6 py-3 font-semibold text-paper">
                            {t("tryAgain")}
                        </button>
                    </div>
                )}

                {phase === "applied" && (
                    <>
                        <div className="flex items-start gap-3 rounded-[22px] bg-paid-soft p-4">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-paid text-white">
                                <Check className="h-5 w-5" />
                            </span>
                            <div className="min-w-0">
                                <p className="text-[16px] font-semibold text-ink">{t("scanSavedTitle", { count: applied?.count ?? 0 })}</p>
                                {applied?.at && <p className="text-[14px] text-ink-2">{date(toNepalDateStr(new Date(applied.at)), true)} · {t(KIND_LABEL[kind])}</p>}
                            </div>
                        </div>
                        {rows.length > 0 && (
                            <ul className="divide-y divide-line overflow-hidden rounded-[22px] bg-card ring-1 ring-line">
                                {rows.map((r) => (
                                    <li key={r.key} className="flex items-center justify-between gap-3 px-4 py-3">
                                        <span className="min-w-0 truncate text-[15px] text-ink">{r.name || customers.find((c) => c.id === r.customerId)?.name || "-"}</span>
                                        {r.amount && <span className="shrink-0 text-[15px] font-medium tabular-nums text-ink-2">{money(Number(r.amount) || 0)}</span>}
                                    </li>
                                ))}
                            </ul>
                        )}
                        <button type="button" onClick={reset} className="flex h-12 w-full items-center justify-center rounded-2xl bg-ink text-[16px] font-semibold text-paper">
                            {t("scanAnother")}
                        </button>
                    </>
                )}

                {phase === "review" && (
                    <>
                        {rows.length === 0 ? (
                            <div className="rounded-[22px] bg-card p-5 text-center ring-1 ring-line">
                                <p className="text-[16px] font-semibold text-ink">{t("scanNothingTitle")}</p>
                                <p className="mt-1.5 text-[15px] text-ink-2">{t("scanNothingBody", { what: t(KIND_LABEL[kind]) })}</p>
                                <button type="button" onClick={reset} className="mt-4 h-12 w-full rounded-2xl bg-ink text-[16px] font-semibold text-paper">
                                    {t("scanAnother")}
                                </button>
                            </div>
                        ) : (
                            <p className="rounded-2xl bg-saffron-soft px-4 py-3 text-[15px] text-[#7a3d10]">{aiUsed ? t("reviewRows") : t("aiNotReady")}</p>
                        )}
                        <ul className="space-y-2.5">
                            {rows.map((r) => (
                                <li key={r.key} className={cn("space-y-2 rounded-[20px] bg-card p-3 ring-1", r.low ? "ring-2 ring-flag" : "ring-line")}>
                                    <div className="flex items-center gap-2">
                                        {kind === "collections" ? (
                                            <div className="min-w-0 flex-1">
                                                <Choice
                                                    value={r.customerId}
                                                    onChange={(v) => update(r.key, { customerId: v })}
                                                    tone={r.customerId ? undefined : "warn"}
                                                    options={[{ value: "", label: `${r.name} ?` }, ...customers.map((c) => ({ value: c.id, label: c.name }))]}
                                                />
                                            </div>
                                        ) : (
                                            <input value={r.name} onChange={(e) => update(r.key, { name: e.target.value })} placeholder={t("name")} className={cn(inputCls, "flex-1")} />
                                        )}
                                        <button
                                            type="button"
                                            aria-label={t("delete")}
                                            onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                                            className="flex h-11 w-11 items-center justify-center rounded-full text-ink-3 active:bg-miss-soft active:text-miss"
                                        >
                                            <Trash2 className="h-5 w-5" />
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <input
                                            inputMode="numeric"
                                            value={r.amount}
                                            onChange={(e) => update(r.key, { amount: toAsciiDigits(e.target.value).replace(/\D/g, "") })}
                                            placeholder={kind === "customers" ? t("dailyAmount") : t("amount")}
                                            className={inputCls}
                                        />
                                        {kind === "customers" ? (
                                            <input value={r.phone} onChange={(e) => update(r.key, { phone: e.target.value })} placeholder={t("phone")} className={inputCls} />
                                        ) : (
                                            <DateField value={r.date} onChange={(v) => update(r.key, { date: v })} max={today} className="h-11" />
                                        )}
                                    </div>
                                    {kind === "customers" && (
                                        <input value={r.account} onChange={(e) => update(r.key, { account: e.target.value })} placeholder={t("bankAccount")} className={cn(inputCls, "w-full")} />
                                    )}
                                    {kind === "loans" && (
                                        <input
                                            inputMode="decimal"
                                            value={r.rate}
                                            onChange={(e) => update(r.key, { rate: toAsciiDigits(e.target.value).replace(/[^\d.]/g, "") })}
                                            placeholder={t("rate")}
                                            className={cn(inputCls, "w-full")}
                                        />
                                    )}
                                    {r.low && <p className="text-[13px] font-medium text-[#8a5a08]">{t("unsure")}</p>}
                                </li>
                            ))}
                        </ul>
                        <button
                            type="button"
                            onClick={() =>
                                setRows((rs) => [...rs, { key: `n${Date.now()}`, name: "", amount: "", phone: "", account: "", date: today, rate: String(defaultRate), customerId: "", low: false }])
                            }
                            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-paper-2 font-semibold text-ink"
                        >
                            <Plus className="h-5 w-5" /> {t("addRow")}
                        </button>
                        {rows.length > 0 && (
                        <button
                            type="button"
                            disabled={saving}
                            onClick={save}
                            className="flex h-12 w-full items-center justify-center rounded-2xl bg-ink text-[16px] font-semibold text-paper disabled:opacity-30"
                        >
                            {t("saveAll")} · {rows.length}
                            {kind !== "customers" && ` · ${money(rows.reduce((s, r) => s + (Number(r.amount) || 0), 0))}`}
                        </button>
                        )}
                        {rawText && (
                            <Collapsible className="rounded-2xl bg-card ring-1 ring-line">
                                <CollapsibleTrigger className="group flex w-full items-center justify-between px-4 py-3 text-[15px] font-medium text-ink-2">
                                    {t("rawText")}
                                    <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                    <ScrollArea orientation="vertical" viewportClassName="max-h-64">
                                        <pre className="whitespace-pre-wrap break-words px-4 pb-4 font-sans text-[14px] text-ink-2">{rawText}</pre>
                                    </ScrollArea>
                                </CollapsibleContent>
                            </Collapsible>
                        )}
                    </>
                )}
            </div>
            {confirmDialog}
        </>
    )
}

const inputCls = "h-11 rounded-xl bg-paper px-3 text-[16px] text-ink outline-none ring-1 ring-line focus:ring-2 focus:ring-saffron"
