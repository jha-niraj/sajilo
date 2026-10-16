"use client"

import { PageTop } from "@/components/shell/page-top"
import { useI18n } from "@/lib/i18n"
import type { CashOnHand } from "@/lib/lending/server"

export function CashClient({ cash }: { cash: CashOnHand }) {
    const { t, money, month } = useI18n()
    return (
        <>
            <PageTop title={t("cashOnHand")} subtitle={month(cash.year, cash.month)} backHref="/loans" />
            <div className="space-y-4 px-4 pt-4">
                <section className="rounded-[22px] bg-ink p-4 text-paper">
                    <p className="text-[15px] text-paper/70">{t("shouldHave")}</p>
                    <p className={`mt-1 text-[28px] font-semibold leading-none tabular ${cash.shouldHave < 0 ? "text-[#ffb4a8]" : ""}`}>{money(cash.shouldHave)}</p>
                    {cash.shouldHave < 0 && <p className="mt-2 text-[13px] text-paper/80">{t("cashNegative", { amount: money(-cash.shouldHave) })}</p>}
                </section>
                <section className="space-y-3 rounded-[24px] bg-card p-4 ring-1 ring-line text-[15px]">
                    <Line label={t("collectedThisMonth")} value={`+ ${money(cash.collected)}`} className="text-ink" />
                    <Line label={t("lentOut")} value={`- ${money(cash.lentThisMonth)}`} className="text-miss" />
                    <Line label={t("returnedThisMonth")} value={`+ ${money(cash.returnedThisMonth)}`} className="text-paid" />
                    <div className="border-t border-line pt-3">
                        <Line label={t("shouldHave")} value={money(cash.shouldHave)} className="font-semibold text-ink" />
                    </div>
                </section>
                <section className="rounded-[24px] bg-saffron-soft p-4 text-[16px] text-[#7a3d10]">
                    <Line label={t("principalLeft")} value={money(cash.stillOut)} />
                    <div className="mt-2">
                        <Line label={t("interestDue")} value={money(cash.stillOutInterest)} />
                    </div>
                </section>
            </div>
        </>
    )
}

function Line({ label, value, className }: { label: string; value: string; className?: string }) {
    return (
        <div className={`flex items-baseline justify-between gap-3 ${className ?? ""}`}>
            <span className="min-w-0 text-ink-2">{label}</span>
            <span className="shrink-0 font-semibold tabular">{value}</span>
        </div>
    )
}
