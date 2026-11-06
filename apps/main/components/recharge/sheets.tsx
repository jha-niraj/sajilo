"use client"

import { useMemo, useState } from "react"
import { ChevronLeft, Search, UserPlus, UserRound } from "lucide-react"
import { ScrollArea } from "@repo/ui/components/ui/scroll-area"
import { cn } from "@repo/ui/lib/utils"
import { toNepaliDigits } from "@repo/calendar"
import { BottomSheet } from "@/components/bottom-sheet"
import { useI18n } from "@/lib/i18n"
import { displayPhone, normalizePhone, toAsciiDigits } from "@/lib/phone"
import { newOpId } from "@/lib/offline/sync"
import type { RechargeNewPerson } from "@/lib/offline/ops"
import type { RechargeData, RechargePerson } from "@/lib/recharge/server"
import { AmountChips, BUY_CHIPS } from "./chips"
import { AmountPad } from "./amount-pad"
import { personLabel } from "./use-recharge"

const inputCls = "h-12 w-full rounded-xl bg-card px-3 text-[16px] text-ink outline-none ring-1 ring-line focus:ring-2 focus:ring-saffron"

/** Who a udharo or payment is for: an existing person, a collection customer, or someone new. */
export interface PersonPick {
    id: string
    label: string
    phone: string | null
    /** Sent with the op so the server can create the profile (always for a customer, so ids agree) */
    newPerson: RechargeNewPerson | null
}

/** Udharo in two steps, no typing for anyone he has served before: pick who, then tap the amount. */
export function UdharoSheet({
    open,
    onOpenChange,
    what,
    amounts,
    people,
    customers,
    onSell,
    short,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    what: string
    short?: (amount: number) => boolean
    amounts: number[]
    people: RechargePerson[]
    customers: RechargeData["customers"]
    onSell: (person: PersonPick, amount: number) => void
}) {
    const { t, money } = useI18n()
    const [who, setWho] = useState<PersonPick | null>(null)
    const [other, setOther] = useState(false)

    const close = (o: boolean) => {
        onOpenChange(o)
        if (!o) {
            setWho(null)
            setOther(false)
        }
    }
    const sell = (amount: number) => {
        if (!who) return
        onSell(who, amount)
        close(false)
    }

    return (
        <BottomSheet open={open} onOpenChange={close} title={who ? t("rcUdharoTo", { name: who.label }) : t("rcUdharo")} description={who ? what : undefined}>
            {!who ? (
                <PersonPicker people={people} customers={customers} onPick={setWho} />
            ) : (
                <div className="flex flex-col gap-3 pb-2">
                    <button type="button" onClick={() => (other ? setOther(false) : setWho(null))} className="-ml-1 inline-flex items-center gap-1 self-start rounded-full px-2 py-1.5 text-[15px] text-ink-2 active:bg-paper-2">
                        <ChevronLeft className="h-5 w-5" /> {who.phone ? displayPhone(who.phone) : who.label}
                    </button>
                    {other ? (
                        <AmountPad label={t("rcOtherTitle")} submitLabel={t("rcUdharo")} onSubmit={sell} />
                    ) : (
                        <>
                            {people.find((p) => p.id === who.id && p.owed > 0) && (
                                <p className="text-[14px] text-[#8a5a08]">{t("rcOwes", { amount: money(people.find((p) => p.id === who.id)!.owed) })}</p>
                            )}
                            <AmountChips amounts={amounts} tone="credit" short={short} onPick={sell} onOther={() => setOther(true)} />
                        </>
                    )}
                </div>
            )}
        </BottomSheet>
    )
}

function PersonPicker({ people, customers, onPick }: { people: RechargePerson[]; customers: RechargeData["customers"]; onPick: (p: PersonPick) => void }) {
    const { t, money } = useI18n()
    const [q, setQ] = useState("")
    const [adding, setAdding] = useState(false)
    const [phone, setPhone] = useState("")
    const [name, setName] = useState("")

    const list = useMemo(() => {
        const linked = new Set(people.map((p) => p.customerId).filter(Boolean))
        const rows = [
            ...[...people]
                .sort((a, b) => b.owed - a.owed)
                .map((p) => ({ key: p.id, label: personLabel(p, customers), phone: p.phone, owed: p.owed, customer: !!p.customerId, pick: { id: p.id, label: personLabel(p, customers), phone: p.phone, newPerson: null } as PersonPick })),
            ...customers
                .filter((c) => !linked.has(c.id))
                .map((c) => ({
                    key: `c-${c.id}`,
                    label: c.name,
                    phone: c.phone,
                    owed: 0,
                    customer: true,
                    pick: { id: `cust:${c.id}`, label: c.name, phone: c.phone, newPerson: { id: `cust:${c.id}`, name: c.name, phone: c.phone, customerId: c.id } } as PersonPick,
                })),
        ]
        const needle = toAsciiDigits(q.trim().toLowerCase())
        const digits = needle.replace(/\D/g, "")
        if (!needle) return rows
        return rows.filter((r) => r.label.toLowerCase().includes(needle) || (digits.length >= 3 && (r.phone ?? "").replace(/\D/g, "").includes(digits)))
    }, [people, customers, q])

    const e164 = normalizePhone(phone)
    const addNew = () => {
        if (!e164) return
        const same = people.find((p) => p.phone === e164)
        if (same) return onPick({ id: same.id, label: personLabel(same, customers), phone: same.phone, newPerson: null })
        const id = newOpId()
        onPick({ id, label: name.trim() || displayPhone(e164), phone: e164, newPerson: { id, name: name.trim() || null, phone: e164, customerId: null } })
    }

    if (adding) {
        return (
            <div className="flex flex-col gap-3 pb-2">
                <button type="button" onClick={() => setAdding(false)} className="-ml-1 inline-flex items-center gap-1 self-start rounded-full px-2 py-1.5 text-[15px] text-ink-2 active:bg-paper-2">
                    <ChevronLeft className="h-5 w-5" /> {t("rcNewPerson")}
                </button>
                <label className="flex flex-col gap-1.5">
                    <span className="text-[14px] text-ink-2">{t("phone")}</span>
                    <input autoFocus inputMode="tel" value={phone} onChange={(e) => setPhone(toAsciiDigits(e.target.value).replace(/[^\d+]/g, "").slice(0, 14))} placeholder="98XXXXXXXX" className={cn(inputCls, "text-[18px] tabular")} />
                    {phone.length >= 10 && !e164 && <span className="text-[13px] text-miss">{t("rcPhoneNeeded")}</span>}
                </label>
                <label className="flex flex-col gap-1.5">
                    <span className="text-[14px] text-ink-2">{t("name")}</span>
                    <input value={name} onChange={(e) => setName(e.target.value.slice(0, 80))} className={inputCls} />
                </label>
                <button type="button" disabled={!e164} onClick={addNew} className="mt-1 h-14 rounded-2xl bg-ink text-[17px] font-semibold text-paper disabled:bg-ink-3/40">
                    {t("rcContinue")}
                </button>
            </div>
        )
    }

    return (
        <div className="flex min-h-0 flex-col gap-3 pb-2">
            <label className="flex h-12 shrink-0 items-center gap-2 rounded-2xl bg-card px-4 ring-1 ring-line focus-within:ring-2 focus-within:ring-saffron">
                <Search className="h-5 w-5 text-ink-3" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("rcSearchPerson")} className="h-full w-full bg-transparent text-[16px] outline-none placeholder:text-ink-3" />
            </label>
            <button type="button" onClick={() => setAdding(true)} className="flex h-12 shrink-0 items-center gap-2 rounded-2xl bg-saffron-soft px-4 text-[16px] font-semibold text-saffron active:bg-saffron/20">
                <UserPlus className="h-5 w-5" /> {t("rcNewPerson")}
            </button>
            <ScrollArea orientation="vertical" viewportClassName="max-h-[38dvh]">
                <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-card ring-1 ring-line">
                    {list.slice(0, 60).map((r) => (
                        <li key={r.key}>
                            <button type="button" onClick={() => onPick(r.pick)} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-paper-2">
                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-paper-2 text-ink-2">
                                    <UserRound className="h-5 w-5" />
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-[16px] font-medium text-ink">{r.label}</span>
                                    <span className="block truncate text-[13px] text-ink-3">
                                        {[r.phone ? displayPhone(r.phone) : null, r.customer ? t("rcCustomerTag") : null].filter(Boolean).join(" · ")}
                                    </span>
                                </span>
                                {r.owed > 0 && <span className="shrink-0 text-[14px] font-semibold text-[#8a5a08] tabular">{money(r.owed)}</span>}
                            </button>
                        </li>
                    ))}
                </ul>
            </ScrollArea>
        </div>
    )
}

/** Bought stock: tap the amount he got; what he paid is filled in from his last rate (one tap to change). */
export function BuySheet({
    open,
    onOpenChange,
    what,
    suggest,
    onSave,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    what: string
    suggest: (face: number) => number | null
    onSave: (face: number, paid: number) => void
}) {
    const { t, money } = useI18n()
    const [face, setFace] = useState<number | null>(null)
    const [step, setStep] = useState<"face" | "otherFace" | "paid">("face")

    const close = (o: boolean) => {
        onOpenChange(o)
        if (!o) {
            setFace(null)
            setStep("face")
        }
    }
    const pickFace = (f: number) => {
        setFace(f)
        setStep("paid")
    }
    const save = (paid: number) => {
        if (!face) return
        onSave(face, paid)
        close(false)
    }
    const suggested = face ? suggest(face) : null

    return (
        <BottomSheet open={open} onOpenChange={close} title={t("rcBoughtTitle")} description={what}>
            <div className="flex flex-col gap-3 pb-2">
                {step === "face" && (
                    <>
                        <p className="text-[15px] text-ink-2">{t("rcReceived")}</p>
                        <div className="grid grid-cols-2 gap-2">
                            {BUY_CHIPS.map((f) => (
                                <button key={f} type="button" onClick={() => pickFace(f)} className="flex h-14 items-center justify-center rounded-2xl bg-card text-[19px] font-semibold text-ink ring-1 ring-line tabular active:bg-saffron-soft">
                                    {money(f)}
                                </button>
                            ))}
                            <button type="button" onClick={() => setStep("otherFace")} className="flex h-14 items-center justify-center rounded-2xl bg-card text-[16px] font-semibold text-ink ring-1 ring-line active:bg-saffron-soft">
                                {t("rcOther")}
                            </button>
                        </div>
                    </>
                )}
                {step === "otherFace" && <AmountPad label={t("rcReceived")} submitLabel={t("rcContinue")} onSubmit={pickFace} />}
                {step === "paid" && face && (
                    <>
                        <button type="button" onClick={() => setStep("face")} className="-ml-1 inline-flex items-center gap-1 self-start rounded-full px-2 py-1.5 text-[15px] text-ink-2 active:bg-paper-2">
                            <ChevronLeft className="h-5 w-5" /> {t("rcReceived")}: <b className="text-ink">{money(face)}</b>
                        </button>
                        <AmountPad
                            key={face}
                            initial={suggested}
                            label={t("rcYouPaid")}
                            hint={(paid) => <PaidHint face={face} paid={paid} />}
                            submitLabel={t("save")}
                            onSubmit={save}
                        />
                    </>
                )}
            </div>
        </BottomSheet>
    )
}

/** The margin as he types what he paid: a typo (more than he got, or a 30% margin) shows at once. */
function PaidHint({ face, paid }: { face: number; paid: number }) {
    const { t, lang } = useI18n()
    if (!paid) return null
    const pct = Math.round(((face - paid) / face) * 1000) / 10
    const odd = pct < 0 || pct > 15
    return <span className={odd ? "font-medium text-miss" : "text-paid"}>{t("rcMargin", { pct: lang === "ne" ? toNepaliDigits(String(pct)) : String(pct) })}</span>
}

/** Optional count: what is really left. Shows the difference from what Sajilo expects. */
export function CountSheet({
    open,
    onOpenChange,
    what,
    expected,
    onSave,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    what: string
    expected: number
    onSave: (counted: number) => void
}) {
    const { t, money } = useI18n()
    return (
        <BottomSheet open={open} onOpenChange={onOpenChange} title={t("rcCountTitle", { what })} description={t("rcCountHint")}>
            <div className="pb-2">
                {open && (
                    <AmountPad
                        allowZero
                        label={t("rcExpected", { amount: money(expected) })}
                        submitLabel={t("save")}
                        onSubmit={(n) => {
                            onSave(n)
                            onOpenChange(false)
                        }}
                    />
                )}
            </div>
        </BottomSheet>
    )
}

/** One person's udharo: what they owe, and "paid back" in one tap. */
export function PersonSheet({
    person,
    label,
    history,
    onOpenChange,
    onPaid,
}: {
    person: RechargePerson | null
    label: string
    history: { id: string; date: string; amount: number; kind: "sell" | "payback" }[]
    onOpenChange: (open: boolean) => void
    onPaid: (amount: number) => void
}) {
    const { t, money, date } = useI18n()
    const [part, setPart] = useState(false)
    const close = (o: boolean) => {
        onOpenChange(o)
        if (!o) setPart(false)
    }
    const paid = (n: number) => {
        onPaid(n)
        close(false)
    }
    return (
        <BottomSheet open={!!person} onOpenChange={close} title={label} description={person?.phone ? displayPhone(person.phone) : undefined}>
            {person && (
                <div className="flex flex-col gap-3 pb-2">
                    {part ? (
                        <AmountPad label={t("rcPaidBack")} submitLabel={t("save")} onSubmit={paid} />
                    ) : (
                        <>
                            <div className="rounded-[22px] bg-flag-soft px-4 py-3 text-[#8a5a08]">
                                <p className="text-[14px]">{t("rcOwes", { amount: "" }).trim()}</p>
                                <p className="text-[30px] font-semibold leading-tight tabular">{money(person.owed)}</p>
                            </div>
                            {person.owed > 0 && (
                                <div className="grid grid-cols-2 gap-2">
                                    <button type="button" onClick={() => paid(person.owed)} className="h-14 rounded-2xl bg-paid text-[16px] font-semibold text-white active:opacity-90">
                                        {t("rcPaidAll", { amount: money(person.owed) })}
                                    </button>
                                    <button type="button" onClick={() => setPart(true)} className="h-14 rounded-2xl bg-card text-[16px] font-semibold text-ink ring-1 ring-line active:bg-paper-2">
                                        {t("rcPaidSome")}
                                    </button>
                                </div>
                            )}
                            {history.length > 0 && (
                                <ScrollArea orientation="vertical" viewportClassName="max-h-[30dvh]">
                                    <ul className="divide-y divide-line rounded-2xl bg-card ring-1 ring-line">
                                        {history.map((h) => (
                                            <li key={h.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-[15px]">
                                                <span className="text-ink-2">
                                                    {date(h.date, true)} · {h.kind === "sell" ? t("rcUdharo") : t("rcPaidBack")}
                                                </span>
                                                <span className={cn("shrink-0 font-semibold tabular", h.kind === "sell" ? "text-[#8a5a08]" : "text-paid")}>
                                                    {h.kind === "sell" ? "+" : "-"} {money(h.amount)}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                </ScrollArea>
                            )}
                        </>
                    )}
                </div>
            )}
        </BottomSheet>
    )
}
