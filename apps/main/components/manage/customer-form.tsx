"use client"

import { useState } from "react"
import { DateField } from "@/components/day-picker"
import { useI18n } from "@/lib/i18n"
import { toAsciiDigits } from "@/lib/phone"
import type { CustomerInput, CustomerRow } from "@/actions/customer.action"

export function CustomerForm({
    initial,
    today,
    busy,
    onSubmit,
    onToggleActive,
}: {
    initial?: CustomerRow
    today: string
    busy: boolean
    onSubmit: (input: CustomerInput) => void
    onToggleActive?: () => void
}) {
    const { t } = useI18n()
    const [name, setName] = useState(initial?.name ?? "")
    const [amount, setAmount] = useState(initial ? String(initial.defaultAmount) : "")
    const [phone, setPhone] = useState(initial?.phone ?? "")
    const [account, setAccount] = useState(initial?.bankAccountNo ?? "")
    const [startDate, setStartDate] = useState(initial?.startDate ?? today)

    const valid = name.trim().length > 0 && Number(amount) > 0

    return (
        <form
            className="space-y-4"
            onSubmit={(e) => {
                e.preventDefault()
                if (!valid) return
                onSubmit({
                    name: name.trim(),
                    defaultAmount: Number(amount),
                    phone: phone.trim() || null,
                    bankAccountNo: account.trim() || null,
                    startDate,
                })
            }}
        >
            <Field label={t("name")}>
                <input autoFocus={!initial} value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
            </Field>
            <Field label={t("dailyAmount")}>
                <div className="flex items-center rounded-2xl bg-card ring-1 ring-line focus-within:ring-2 focus-within:ring-saffron">
                    <span className="pl-4 text-lg text-ink-3">{t("rupeePrefix")}</span>
                    <input
                        inputMode="numeric"
                        value={amount}
                        onChange={(e) => setAmount(toAsciiDigits(e.target.value).replace(/\D/g, "").slice(0, 7))}
                        className="h-14 w-full bg-transparent px-3 text-xl font-semibold text-ink outline-none"
                    />
                </div>
            </Field>
            <div className="grid grid-cols-2 gap-3">
                <Field label={`${t("phone")} (${t("optional")})`}>
                    <input inputMode="tel" value={phone} onChange={(e) => setPhone(toAsciiDigits(e.target.value))} className={inputCls} />
                </Field>
                <Field label={`${t("bankAccount")} (${t("optional")})`}>
                    <input value={account} onChange={(e) => setAccount(e.target.value)} className={inputCls} />
                </Field>
            </div>
            <Field label={t("startDate")}>
                <DateField value={startDate} onChange={setStartDate} max={today} className="h-14 rounded-2xl bg-card" />
            </Field>

            <button
                type="submit"
                disabled={!valid || busy}
                className="flex h-16 w-full items-center justify-center rounded-2xl bg-ink text-lg font-semibold text-paper disabled:opacity-30"
            >
                {t("save")}
            </button>
            {initial && onToggleActive && (
                <button
                    type="button"
                    onClick={onToggleActive}
                    disabled={busy}
                    className={
                        initial.isActive
                            ? "h-12 w-full rounded-2xl bg-miss-soft text-[16px] font-semibold text-miss"
                            : "h-12 w-full rounded-2xl bg-paid-soft text-[16px] font-semibold text-paid"
                    }
                >
                    {initial.isActive ? t("deactivate") : t("activate")}
                </button>
            )}
        </form>
    )
}

const inputCls =
    "h-14 w-full rounded-2xl bg-card px-4 text-[18px] text-ink outline-none ring-1 ring-line focus:ring-2 focus:ring-saffron"

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label className="block">
            <span className="mb-1.5 block text-[14px] font-medium text-ink-2">{label}</span>
            {children}
        </label>
    )
}
