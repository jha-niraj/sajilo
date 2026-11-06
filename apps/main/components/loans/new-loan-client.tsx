"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { cn } from "@repo/ui/lib/utils"
import { Switch } from "@repo/ui/components/ui/switch"
import { DateField } from "@/components/day-picker"
import { PageTop } from "@/components/shell/page-top"
import { useI18n } from "@/lib/i18n"
import { toAsciiDigits } from "@/lib/phone"
import { calculateLoan } from "@/lib/money/interest"
import { newOpId, queueOp } from "@/lib/offline/sync"
import { StatementTotals } from "./breakdown"
import { Choice } from "@/components/choice"

interface Props {
    borrowers: { id: string; name: string; phone: string | null }[]
    today: string
    defaultRate: number
    defaultCompounding: boolean
    basis: "balance" | "principal"
    suggestedDue: string
}

export function NewLoanClient({ borrowers, today, defaultRate, defaultCompounding, basis, suggestedDue }: Props) {
    const { t, date } = useI18n()
    const router = useRouter()
    const [borrowerId, setBorrowerId] = useState<string>(borrowers.length ? "" : "new")
    const [name, setName] = useState("")
    const [phone, setPhone] = useState("")
    const [amount, setAmount] = useState("")
    const [rate, setRate] = useState(String(defaultRate))
    const [startDate, setStartDate] = useState(today)
    const [dueDate, setDueDate] = useState<string>(suggestedDue)
    const [compounding, setCompounding] = useState(defaultCompounding)
    const [busy, setBusy] = useState(false)

    const principal = Number(amount) || 0
    const valid = principal > 0 && (borrowerId === "new" ? name.trim().length > 0 : borrowerId !== "")

    const preview = useMemo(() => {
        if (!principal || !dueDate || dueDate <= startDate) return null
        return calculateLoan({ principal, ratePer100: Number(rate) || 0, startDate, compounding, basis }, [], dueDate)
    }, [principal, rate, startDate, dueDate, compounding, basis])

    const save = async () => {
        setBusy(true)
        try {
            const loanId = newOpId()
            const isNew = borrowerId === "new"
            const { synced } = await queueOp(
                {
                    kind: "newLoan",
                    loanId,
                    borrowerId: isNew ? newOpId() : borrowerId,
                    borrowerName: isNew ? name.trim() : (borrowers.find((b) => b.id === borrowerId)?.name ?? ""),
                    newBorrower: isNew ? { name: name.trim(), phone: phone.trim() || null } : null,
                    principal,
                    ratePer100: Number(rate) || 0,
                    startDate,
                    dueDate: dueDate || null,
                    compounding: compounding === defaultCompounding ? null : compounding,
                    note: null,
                },
                { wait: 6000 },
            )
            if (synced) {
                toast.success(t("saved"))
                router.replace(`/loans/${loanId}`)
            } else {
                toast.success(t("savedOffline"))
                router.replace("/loans")
            }
        } catch {
            toast.error(t("somethingWrong"))
            setBusy(false)
        }
    }

    return (
        <>
            <PageTop title={t("newLoan")} backHref="/loans" />
            <div className="space-y-4 px-4 pt-4">
                <section className="space-y-3 rounded-[24px] bg-card p-4 ring-1 ring-line">
                    <Label text={t("borrower")}>
                        <Choice
                            value={borrowerId}
                            onChange={setBorrowerId}
                            placeholder={t("chooseBorrower")}
                            options={[
                                ...(borrowers.length > 0 ? [{ value: "", label: t("chooseBorrower") }] : []),
                                ...borrowers.map((b) => ({ value: b.id, label: b.name })),
                                { value: "new", label: `+ ${t("newBorrower")}` },
                            ]}
                        />
                    </Label>
                    {borrowerId === "new" && (
                        <div className="grid grid-cols-2 gap-2">
                            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={t("name")} className={inputCls} />
                            <input inputMode="tel" value={phone} onChange={(e) => setPhone(toAsciiDigits(e.target.value))} placeholder={t("phone")} className={inputCls} />
                        </div>
                    )}
                </section>

                <section className="space-y-3 rounded-[24px] bg-card p-4 ring-1 ring-line">
                    <Label text={t("loanAmount")}>
                        <div className="flex items-center rounded-xl bg-paper ring-1 ring-line focus-within:ring-2 focus-within:ring-saffron">
                            <span className="pl-3 text-[16px] text-ink-3">{t("rupeePrefix")}</span>
                            <input
                                inputMode="numeric"
                                value={amount}
                                onChange={(e) => setAmount(toAsciiDigits(e.target.value).replace(/\D/g, "").slice(0, 9))}
                                placeholder="20,000"
                                className="h-12 w-full bg-transparent px-2 text-[21px] font-semibold text-ink outline-none"
                            />
                        </div>
                    </Label>
                    <Label text={t("rate")}>
                        <input
                            inputMode="decimal"
                            value={rate}
                            onChange={(e) => setRate(toAsciiDigits(e.target.value).replace(/[^\d.]/g, ""))}
                            placeholder="2"
                            className={cn(inputCls, "text-[16px] font-semibold")}
                        />
                    </Label>
                    <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2 min-[400px]:gap-2">
                        <Label text={t("givenOn")}>
                            <DateField value={startDate} onChange={setStartDate} max={today} />
                        </Label>
                        <Label text={`${t("returnBy")} (${t("optional")})`}>
                            <DateField value={dueDate} onChange={setDueDate} min={startDate} />
                        </Label>
                    </div>
                    <label className="flex items-center justify-between gap-4 pt-1">
                        <span className="text-[15px] text-ink">{t("compounding")}</span>
                        <Switch checked={compounding} onCheckedChange={setCompounding} />
                    </label>
                </section>

                {preview && (
                    <section className="rounded-[24px] bg-saffron-soft p-4">
                        <p className="mb-2 text-[15px] font-medium text-[#7a3d10]">
                            {t("calcOn")} {date(dueDate, true)}
                        </p>
                        <StatementTotals statement={preview} />
                    </section>
                )}

                <button
                    type="button"
                    disabled={!valid || busy}
                    onClick={save}
                    className="flex h-12 w-full items-center justify-center rounded-2xl bg-ink text-[16px] font-semibold text-paper disabled:opacity-30"
                >
                    {t("save")}
                </button>
            </div>
        </>
    )
}

const inputCls = "h-12 w-full rounded-xl bg-paper px-3 text-[15px] text-ink outline-none ring-1 ring-line focus:ring-2 focus:ring-saffron"

function Label({ text, children }: { text: string; children: React.ReactNode }) {
    return (
        <div>
            <p className="mb-1.5 text-[14px] font-medium text-ink-2">{text}</p>
            {children}
        </div>
    )
}
