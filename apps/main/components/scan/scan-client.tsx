"use client"

import { useEffect, useId, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Camera, ChevronDown, Images, Plus, Sparkles, Trash2 } from "lucide-react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@repo/ui/components/ui/collapsible"
import { ScrollArea } from "@repo/ui/components/ui/scroll-area"
import { cn } from "@repo/ui/lib/utils"
import { Loader } from "@repo/ui/components/ui/loader"
import { DateField } from "@/components/day-picker"
import { bsToAd } from "@repo/calendar"
import { PageTop } from "@/components/shell/page-top"
import { useI18n } from "@/lib/i18n"
import { toAsciiDigits } from "@/lib/phone"
import { refreshDay } from "@/lib/offline/sync"
import { applyScan, pollScan, startScan, type ScanState } from "@/actions/scan.action"
import type { CustomerRow } from "@/actions/customer.action"
import type { DictKey } from "@/lib/dict"
import type { ScanKind } from "@/lib/scan/structure"
import { compressImage } from "./compress"
import { Choice } from "@/components/choice"
import { isOnline } from "@/lib/offline/network"

type Phase = "pick" | "uploading" | "reading" | "structuring" | "review" | "failed"

interface EditRow {
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

const KIND_LABEL: Record<ScanKind, DictKey> = { customers: "scanCustomers", collections: "scanCollections", loans: "scanLoans" }

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
    customers,
    today,
    defaultRate,
}: {
    initialKind: ScanKind
    customers: CustomerRow[]
    today: string
    defaultRate: number
}) {
    const { t, money } = useI18n()
    const router = useRouter()
    const [kind, setKind] = useState<ScanKind>(initialKind)
    const [phase, setPhase] = useState<Phase>("pick")
    const [scanId, setScanId] = useState<string | null>(null)
    const [rows, setRows] = useState<EditRow[]>([])
    const [rawText, setRawText] = useState("")
    const [aiUsed, setAiUsed] = useState(true)
    const [preview, setPreview] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)
    const cameraId = useId()
    const galleryId = useId()

    useEffect(() => {
        if (!scanId || (phase !== "reading" && phase !== "structuring")) return
        let stop = false
        const tick = async () => {
            if (stop) return
            const s: ScanState = await pollScan(scanId).catch(() => ({ id: scanId, status: "reading" as const }))
            if (stop) return
            if (s.status === "review") {
                setRawText(s.rawText)
                setAiUsed(s.result.ai)
                setRows(toEditRows(s))
                setPhase("review")
            } else if (s.status === "failed") {
                setPhase("failed")
            } else {
                setPhase(s.status === "structuring" ? "structuring" : "reading")
                setTimeout(tick, 3000)
            }
        }
        const id = setTimeout(tick, 2500)
        return () => {
            stop = true
            clearTimeout(id)
        }
    }, [scanId, phase]) // eslint-disable-line react-hooks/exhaustive-deps

    const toEditRows = (s: Extract<ScanState, { status: "review" }>): EditRow[] => {
        const r = s.result
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
            let res: { count: number }
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
            toast.success(`${t("saved")} · ${res.count}`)
            void refreshDay()
            router.push(kind === "customers" ? "/manage" : kind === "loans" ? "/loans" : "/month")
        } catch {
            toast.error(t("somethingWrong"))
        } finally {
            setSaving(false)
        }
    }

    const reset = () => {
        setPhase("pick")
        setScanId(null)
        setRows([])
        setPreview(null)
    }

    return (
        <>
            <PageTop title={t("scanTitle")} backHref={kind === "customers" ? "/manage" : kind === "loans" ? "/loans" : "/more"} />
            <div className="space-y-4 px-4 pt-4">
                {phase === "pick" && (
                    <>
                        <div className="grid grid-cols-3 gap-1 rounded-2xl bg-paper-2 p-1 text-[14px] font-semibold">
                            {(Object.keys(KIND_LABEL) as ScanKind[]).map((k) => (
                                <button
                                    key={k}
                                    type="button"
                                    onClick={() => setKind(k)}
                                    className={cn("min-h-11 rounded-xl px-1 leading-tight transition-colors", kind === k ? "bg-card text-ink shadow-sm" : "text-ink-3")}
                                >
                                    {t(KIND_LABEL[k])}
                                </button>
                            ))}
                        </div>
                        <div className="rounded-[22px] bg-card p-6 text-center ring-1 ring-line">
                            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-saffron-soft text-saffron">
                                <Sparkles className="h-8 w-8" />
                            </span>
                            <p className="mt-3 text-[15px] text-ink-2">{t(KIND_LABEL[kind])}</p>
                            <div className="mt-5 grid gap-2.5">
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
                            <input id={cameraId} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} onChange={(e) => pickFile(e.currentTarget)} />
                            <input id={galleryId} type="file" accept="image/*,application/pdf" className="sr-only" tabIndex={-1} onChange={(e) => pickFile(e.currentTarget)} />
                        </div>
                    </>
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

                {phase === "review" && (
                    <>
                        <p className="rounded-2xl bg-saffron-soft px-4 py-3 text-[15px] text-[#7a3d10]">{aiUsed ? t("reviewRows") : t("aiNotReady")}</p>
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
                        <button
                            type="button"
                            disabled={saving || rows.length === 0}
                            onClick={save}
                            className="flex h-12 w-full items-center justify-center rounded-2xl bg-ink text-[16px] font-semibold text-paper disabled:opacity-30"
                        >
                            {t("saveAll")} · {rows.length}
                            {kind !== "customers" && rows.length > 0 && ` · ${money(rows.reduce((s, r) => s + (Number(r.amount) || 0), 0))}`}
                        </button>
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
        </>
    )
}

const inputCls = "h-11 rounded-xl bg-paper px-3 text-[16px] text-ink outline-none ring-1 ring-line focus:ring-2 focus:ring-saffron"
