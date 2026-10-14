"use client"

import { useMemo, useState } from "react"
import { Switch } from "@repo/ui/components/ui/switch"
import { DateField } from "@/components/day-picker"
import { PageTop } from "@/components/shell/page-top"
import { useI18n } from "@/lib/i18n"
import { toAsciiDigits } from "@/lib/phone"
import { calculateLoan } from "@/lib/money/interest"
import type { LoanView } from "@/lib/lending/server"
import { Breakdown, StatementTotals } from "./breakdown"
import { Choice } from "@/components/choice"

/** Works fully on the phone (no internet needed): pick a loan or type numbers, pick a day. */
export function CalculatorClient({
    loans,
    today,
    defaultRate,
    defaultCompounding,
    basis,
}: {
    loans: LoanView[]
    today: string
    defaultRate: number
    defaultCompounding: boolean
    basis: "balance" | "principal"
}) {
    const { t, money } = useI18n()
    const [loanId, setLoanId] = useState("")
    const [amount, setAmount] = useState("")
    const [rate, setRate] = useState(String(defaultRate))
    const [start, setStart] = useState(today)
    const [compounding, setCompounding] = useState(defaultCompounding)
    const [asOf, setAsOf] = useState(today)

    const picked = loans.find((l) => l.id === loanId)

    const statement = useMemo(() => {
        if (picked) {
            return calculateLoan(
                { principal: picked.principal, ratePer100: picked.ratePer100, startDate: picked.startDate, compounding: picked.compounding, basis },
                picked.repayments.map((r) => ({ date: r.date, amount: r.amount })),
                asOf < picked.startDate ? picked.startDate : asOf,
            )
        }
        const principal = Number(amount) || 0
        if (!principal) return null
        return calculateLoan({ principal, ratePer100: Number(rate) || 0, startDate: start, compounding, basis }, [], asOf < start ? start : asOf)
    }, [picked, amount, rate, start, compounding, asOf, basis])

    return (
        <>
            <PageTop title={t("calculator")} backHref="/loans" />
            <div className="space-y-4 px-4 pt-4">
                <section className="space-y-3 rounded-[24px] bg-card p-4 ring-1 ring-line">
                    {loans.length > 0 && (
                        <Choice
                            value={loanId}
                            onChange={setLoanId}
                            options={[
                                { value: "", label: t("calcOwnNumbers") },
                                ...loans.map((l) => ({ value: l.id, label: `${l.borrowerName} · ${money(l.principal)}` })),
                            ]}
                        />
                    )}
                    {!picked && (
                        <>
                            <div className="grid grid-cols-2 items-end gap-2">
                                <Field label={t("loanAmount")}>
                                    <input
                                        inputMode="numeric"
                                        value={amount}
                                        onChange={(e) => setAmount(toAsciiDigits(e.target.value).replace(/\D/g, "").slice(0, 9))}
                                        placeholder={t("amountPlaceholder")}
                                        className={`${inputCls} text-[16px] font-semibold`}
                                    />
                                </Field>
                                <Field label={t("rate")}>
                                    <input
                                        inputMode="decimal"
                                        value={rate}
                                        onChange={(e) => setRate(toAsciiDigits(e.target.value).replace(/[^\d.]/g, ""))}
                                        placeholder="2"
                                        className={`${inputCls} text-[16px] font-semibold`}
                                    />
                                </Field>
                            </div>
                            <Field label={t("givenOn")}>
                                <DateField value={start} onChange={setStart} />
                            </Field>
                            <label className="flex items-center justify-between gap-4">
                                <span className="text-[15px] text-ink">{t("compounding")}</span>
                                <Switch checked={compounding} onCheckedChange={setCompounding} />
                            </label>
                        </>
                    )}
                    <Field label={t("calcOn")}>
                        <DateField value={asOf} onChange={setAsOf} />
                    </Field>
                </section>

                {statement && (
                    <>
                        <section className="rounded-[22px] bg-ink p-4 text-paper">
                            <p className="text-[15px] text-paper/70">
                                {t("totalOwed")} · {t("running", { months: statement.elapsed.months, days: statement.elapsed.days })}
                            </p>
                            <p className="mt-1 text-[30px] font-semibold leading-none tabular">{money(statement.total)}</p>
                        </section>
                        <section className="rounded-[24px] bg-card p-4 ring-1 ring-line">
                            <StatementTotals statement={statement} />
                        </section>
                        <section className="rounded-[24px] bg-card p-4 ring-1 ring-line">
                            <p className="text-[16px] font-semibold text-ink">{t("breakdown")}</p>
                            <Breakdown statement={statement} className="mt-1" />
                        </section>
                    </>
                )}
            </div>
        </>
    )
}

const inputCls = "h-12 w-full rounded-xl bg-paper px-3 text-[15px] text-ink outline-none ring-1 ring-line focus:ring-2 focus:ring-saffron"

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <p className="mb-1.5 text-[14px] font-medium text-ink-2">{label}</p>
            {children}
        </div>
    )
}
