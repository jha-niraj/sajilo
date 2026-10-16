"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { CheckCircle2, Phone, RotateCcw, Trash2, Undo2 } from "lucide-react"
import { cn } from "@repo/ui/lib/utils"
import { DateField } from "@/components/day-picker"
import { useConfirm } from "@repo/ui/components/ui/use-confirm"
import { PageTop } from "@/components/shell/page-top"
import { BottomSheet } from "@/components/bottom-sheet"
import { useI18n } from "@/lib/i18n"
import { toAsciiDigits } from "@/lib/phone"
import { calculateLoan } from "@/lib/money/interest"
import { deleteLoan, deleteRepayment, setLoanStatus } from "@/actions/loan.action"
import { useOnline } from "@/lib/offline/network"
import { usePendingLoanOps, withPendingRepayments } from "@/lib/offline/pending-loans"
import { idb } from "@/lib/offline/store"
import { newOpId, queueOp } from "@/lib/offline/sync"
import { PendingBadge } from "@/components/shell/pending-badge"
import type { LoanView } from "@/lib/lending/server"
import { Breakdown, StatementTotals } from "./breakdown"

export function LoanDetailClient({ loan: serverLoan, today, basis }: { loan: LoanView; today: string; basis: "balance" | "principal" }) {
    const { t, money, date } = useI18n()
    const online = useOnline()
    const ops = usePendingLoanOps()
    const loan = useMemo(() => withPendingRepayments(serverLoan, ops, today, basis), [serverLoan, ops, today, basis])
    const pendingReps = new Set(loan.pendingRepaymentIds ?? [])
    const router = useRouter()
    const { confirm, confirmDialog } = useConfirm()
    const [repayOpen, setRepayOpen] = useState(false)
    const [repayAmount, setRepayAmount] = useState("")
    const [repayDate, setRepayDate] = useState(today)
    const [quoteDate, setQuoteDate] = useState(loan.dueDate && loan.dueDate > today ? loan.dueDate : today)
    const [busy, setBusy] = useState(false)

    const { input, reps } = useMemo(
        () => ({
            input: { principal: loan.principal, ratePer100: loan.ratePer100, startDate: loan.startDate, compounding: loan.compounding, basis },
            reps: loan.repayments.map((r) => ({ date: r.date, amount: r.amount })),
        }),
        [loan, basis],
    )

    const quote = useMemo(() => calculateLoan(input, reps, quoteDate), [input, reps, quoteDate])
    const repayPreview = useMemo(() => {
        const amt = Number(repayAmount) || 0
        if (!amt) return null
        const s = calculateLoan(input, [...reps, { date: repayDate, amount: amt }], repayDate)
        const row = [...s.rows].reverse().find((r) => r.kind === "repayment")
        return { s, row: row?.kind === "repayment" ? row : null }
    }, [input, reps, repayAmount, repayDate])

    const overdue = loan.status === "active" && loan.dueInDays !== null && loan.dueInDays < 0

    const run = async (fn: () => Promise<unknown>, msg = t("saved")) => {
        if (!online) return void toast(t("needsInternet"))
        setBusy(true)
        try {
            await fn()
            toast.success(msg)
            router.refresh()
        } catch {
            toast.error(t("somethingWrong"))
        } finally {
            setBusy(false)
        }
    }

    return (
        <>
            <PageTop
                title={loan.borrowerName}
                subtitle={`${money(loan.principal)} · ${date(loan.startDate, true)} · ${t("rateShort", { rate: loan.ratePer100 })}`}
                backHref="/loans"
                right={
                    loan.borrowerPhone ? (
                        <a href={`tel:${loan.borrowerPhone}`} aria-label={t("phone")} className="flex h-10 w-10 items-center justify-center rounded-full bg-paper-2 text-ink-2">
                            <Phone className="h-5 w-5" />
                        </a>
                    ) : undefined
                }
            />

            <div className="space-y-4 px-4 pt-4">
                <section className={cn("rounded-[22px] bg-card p-4 ring-1", overdue ? "ring-2 ring-miss/40" : "ring-line")}>
                    <p className="text-[15px] text-ink-2">
                        {t("owedToday")} · {t("running", { months: loan.statement.elapsed.months, days: loan.statement.elapsed.days })}
                    </p>
                    <p className="mt-1 text-[30px] font-semibold leading-none text-ink tabular">{money(loan.statement.total)}</p>
                    <div className="mt-4">
                        <StatementTotals statement={loan.statement} />
                    </div>
                    {loan.dueDate && (
                        <p className={cn("mt-3 text-[14px]", overdue ? "font-semibold text-miss" : "text-ink-3")}>
                            {t("returnBy")}: {date(loan.dueDate, true)} {overdue && `· ${t("overdue")}`}
                        </p>
                    )}
                    {loan.status === "active" ? (
                        <button
                            type="button"
                            onClick={() => {
                                setRepayAmount("")
                                setRepayDate(today)
                                setRepayOpen(true)
                            }}
                            className="mt-4 flex h-12 w-full items-center justify-center rounded-2xl bg-paid text-[15px] font-semibold text-white"
                        >
                            {t("addRepayment")}
                        </button>
                    ) : (
                        <p className="mt-4 flex items-center justify-center gap-2 rounded-2xl bg-paid-soft py-3 font-semibold text-paid">
                            <CheckCircle2 className="h-5 w-5" /> {t("closed")} {loan.closedAt && `· ${date(loan.closedAt, true)}`}
                        </p>
                    )}
                </section>

                <section className="rounded-[24px] bg-saffron-soft p-4">
                    <p className="text-[16px] font-semibold text-[#7a3d10]">{t("calculator")}</p>
                    <div className="mt-2">
                        <p className="mb-1 text-[14px] text-[#7a3d10]">{t("calcOn")}</p>
                        <DateField value={quoteDate} onChange={setQuoteDate} min={loan.startDate} className="bg-card" />
                    </div>
                    <div className="mt-3 rounded-2xl bg-card p-3">
                        <StatementTotals statement={quote} big />
                    </div>
                </section>

                <section className="rounded-[24px] bg-card p-4 ring-1 ring-line">
                    <p className="text-[16px] font-semibold text-ink">{t("breakdown")}</p>
                    <Breakdown statement={loan.statement} className="mt-1" />
                </section>

                {loan.repayments.length > 0 && (
                    <section className="rounded-[24px] bg-card p-4 ring-1 ring-line">
                        <p className="text-[16px] font-semibold text-ink">{t("addRepayment")}</p>
                        <ul className="mt-1 divide-y divide-line">
                            {loan.repayments.map((r) => (
                                <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                                    <span className="min-w-0 text-[15px] text-ink">{date(r.date, true)}</span>
                                    <span className="flex shrink-0 items-center gap-2">
                                        {pendingReps.has(r.id) && <PendingBadge />}
                                        <span className="font-semibold text-paid tabular">{money(r.amount)}</span>
                                        <button
                                            type="button"
                                            aria-label={t("delete")}
                                            onClick={async () => {
                                                if (!(await confirm({ title: `${t("delete")}: ${money(r.amount)}?`, destructive: true, confirmText: t("yes"), cancelText: t("no") }))) return
                                                if (pendingReps.has(r.id)) {
                                                    const op = ops.find((o) => o.kind === "repayment" && o.repaymentId === r.id)
                                                    if (op) await idb().outbox.delete(op.opId)
                                                    return
                                                }
                                                void run(() => deleteRepayment(r.id))
                                            }}
                                            className="rounded-full p-2 text-ink-3 active:text-miss"
                                        >
                                            <Undo2 className="h-4 w-4" />
                                        </button>
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}

                <div className="grid grid-cols-2 gap-2.5">
                    <button
                        type="button"
                        disabled={busy}
                        onClick={() => void run(() => setLoanStatus(loan.id, loan.status === "active" ? "closed" : "active"))}
                        className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-paper-2 font-semibold text-ink"
                    >
                        {loan.status === "active" ? <CheckCircle2 className="h-5 w-5" /> : <RotateCcw className="h-5 w-5" />}
                        {loan.status === "active" ? t("closeLoan") : t("active")}
                    </button>
                    <button
                        type="button"
                        disabled={busy}
                        onClick={async () => {
                            if (!online) return void toast(t("needsInternet"))
                            if (!(await confirm({ title: `${t("delete")}: ${loan.borrowerName}?`, destructive: true, confirmText: t("yes"), cancelText: t("no") }))) return
                            await deleteLoan(loan.id)
                            router.replace("/loans")
                        }}
                        className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-miss-soft font-semibold text-miss"
                    >
                        <Trash2 className="h-5 w-5" /> {t("delete")}
                    </button>
                </div>
            </div>

            <BottomSheet open={repayOpen} onOpenChange={setRepayOpen} title={t("addRepayment")} description={loan.borrowerName}>
                <div className="space-y-3">
                    <div className="flex items-center rounded-2xl bg-card ring-1 ring-line focus-within:ring-2 focus-within:ring-saffron">
                        <span className="pl-4 text-xl text-ink-3">{t("rupeePrefix")}</span>
                        <input
                            autoFocus
                            inputMode="numeric"
                            value={repayAmount}
                            onChange={(e) => setRepayAmount(toAsciiDigits(e.target.value).replace(/\D/g, "").slice(0, 9))}
                            className="h-12 w-full bg-transparent px-3 text-[24px] font-semibold text-ink outline-none"
                        />
                    </div>
                    <DateField value={repayDate} onChange={setRepayDate} min={loan.startDate} max={today} />
                    {repayPreview?.row && (
                        <div className="rounded-2xl bg-card p-4 text-[15px] ring-1 ring-line">
                            <p className="text-paid">{t("toInterest", { amount: money(repayPreview.row.toInterest) })}</p>
                            <p className="text-paid">{t("toPrincipal", { amount: money(repayPreview.row.toPrincipal) })}</p>
                            <p className="mt-2 border-t border-line pt-2 font-semibold text-ink">
                                {t("totalOwed")}: {money(repayPreview.s.total)}
                            </p>
                        </div>
                    )}
                    <button
                        type="button"
                        disabled={busy || !(Number(repayAmount) > 0)}
                        onClick={async () => {
                            setRepayOpen(false)
                            setBusy(true)
                            try {
                                const { synced } = await queueOp(
                                    { kind: "repayment", repaymentId: newOpId(), loanId: loan.id, date: repayDate, amount: Number(repayAmount), note: null },
                                    { wait: 5000 },
                                )
                                toast.success(synced ? t("saved") : t("savedOffline"))
                                if (synced) router.refresh()
                            } catch {
                                toast.error(t("somethingWrong"))
                            } finally {
                                setBusy(false)
                            }
                        }}
                        className="flex h-12 w-full items-center justify-center rounded-2xl bg-ink text-[16px] font-semibold text-paper disabled:opacity-30"
                    >
                        {t("save")}
                    </button>
                </div>
            </BottomSheet>
            {confirmDialog}
        </>
    )
}
