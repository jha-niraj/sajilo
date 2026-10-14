"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Minus, Plus, Trash2 } from "lucide-react"
import { cn } from "@repo/ui/lib/utils"
import { Switch } from "@repo/ui/components/ui/switch"
import { DateField } from "@/components/day-picker"
import { WEEKDAYS_EN, WEEKDAYS_NE, toNepaliDigits } from "@repo/calendar"
import { authClient } from "@repo/auth/client"
import { PageTop } from "@/components/shell/page-top"
import { InstallCard } from "@/components/shell/install-card"
import { LangToggle } from "@/components/lang-toggle"
import { PinInput } from "@/components/pin-input"
import { useI18n } from "@/lib/i18n"
import { toAsciiDigits } from "@/lib/phone"
import { refreshDay } from "@/lib/offline/sync"
import { addHoliday, removeHoliday, updateSettings, type SettingsView } from "@/actions/settings.action"
import { Choice } from "@/components/choice"
import { isOnline } from "@/lib/offline/network"

export function SettingsClient({ initial, today }: { initial: SettingsView; today: string }) {
    const { t, lang, num, date } = useI18n()
    const router = useRouter()
    const [s, setS] = useState(initial)
    const [, startTransition] = useTransition()
    const [holidayDate, setHolidayDate] = useState(today)
    const [holidayLabel, setHolidayLabel] = useState("")
    const [rate, setRate] = useState(String(initial.defaultRatePer100))
    const [pins, setPins] = useState({ current: "", next: "" })
    const [pinBusy, setPinBusy] = useState(false)

    const patch = (p: Partial<SettingsView>) => {
        if (!isOnline()) return void toast(t("needsInternet"))
        setS((prev) => ({ ...prev, ...p }))
        startTransition(async () => {
            try {
                await updateSettings(p)
                toast.success(t("saved"), { duration: 1200 })
                if (p.workingDays) void refreshDay()
            } catch {
                toast.error(t("somethingWrong"))
            }
        })
    }

    const toggleDay = (d: number) => {
        const next = s.workingDays.includes(d) ? s.workingDays.filter((x) => x !== d) : [...s.workingDays, d].sort()
        patch({ workingDays: next })
    }

    const addH = () =>
        isOnline() ? startTransition(async () => {
            await addHoliday(holidayDate, holidayLabel)
            setHolidayLabel("")
            void refreshDay()
            router.refresh()
            toast.success(t("saved"))
        }) : toast(t("needsInternet"))

    const removeH = (id: string) =>
        isOnline() ? startTransition(async () => {
            setS((prev) => ({ ...prev, holidays: prev.holidays.filter((h) => h.id !== id) }))
            await removeHoliday(id)
            void refreshDay()
            router.refresh()
        }) : toast(t("needsInternet"))

    const changePin = async () => {
        setPinBusy(true)
        const res = await authClient.changePassword({ currentPassword: pins.current, newPassword: pins.next, revokeOtherSessions: false })
        setPinBusy(false)
        if (res.error) return toast.error(t("wrongPin"))
        setPins({ current: "", next: "" })
        toast.success(t("pinChanged"))
    }

    const weekdays = lang === "ne" ? WEEKDAYS_NE : WEEKDAYS_EN
    const deadlineOptions = [null, ...Array.from({ length: 32 }, (_, i) => i + 1)]

    return (
        <>
            <PageTop title={t("settingsTitle")} backHref="/more" />
            <div className="space-y-4 px-4 pt-4">
                <InstallCard />

                <Card title={t("language")}>
                    <LangToggle onChange={(l) => patch({ language: l })} className="text-[16px]" />
                </Card>

                <Card title={t("workingDays")}>
                    <div className="grid grid-cols-7 gap-1.5">
                        {weekdays.map((w, d) => (
                            <button
                                key={d}
                                type="button"
                                onClick={() => toggleDay(d)}
                                aria-pressed={s.workingDays.includes(d)}
                                className={cn(
                                    "h-12 rounded-xl text-[14px] font-semibold transition-colors",
                                    s.workingDays.includes(d) ? "bg-ink text-paper" : "bg-paper-2 text-ink-3",
                                )}
                            >
                                {w}
                            </button>
                        ))}
                    </div>
                </Card>

                <Card title={t("holidays")}>
                    {s.holidays.length > 0 && (
                        <ul className="mb-3 divide-y divide-line">
                            {s.holidays.map((h) => (
                                <li key={h.id} className="flex items-center justify-between py-2">
                                    <span className="text-[16px] text-ink">
                                        {date(h.date, true)}
                                        {h.label && <span className="text-ink-3"> · {h.label}</span>}
                                    </span>
                                    <button type="button" aria-label={t("delete")} onClick={() => removeH(h.id)} className="rounded-full p-2 text-ink-3 active:text-miss">
                                        <Trash2 className="h-5 w-5" />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                    <div className="space-y-2">
                        <DateField value={holidayDate} onChange={setHolidayDate} />
                        <div className="flex gap-2">
                            <input
                                value={holidayLabel}
                                onChange={(e) => setHolidayLabel(e.target.value)}
                                placeholder={`${t("noteOptional")}`}
                                className="h-12 min-w-0 flex-1 rounded-xl bg-paper px-3 text-[16px] outline-none ring-1 ring-line focus:ring-2 focus:ring-saffron"
                            />
                            <button type="button" onClick={addH} className="flex h-12 shrink-0 items-center gap-1 whitespace-nowrap rounded-xl bg-ink px-3.5 text-[14px] font-semibold text-paper">
                                <Plus className="h-4 w-4" />
                                {t("addHoliday")}
                            </button>
                        </div>
                    </div>
                </Card>

                <Card title={t("bankDeadline")}>
                    <Choice
                        value={s.bankDeadlineDay ? String(s.bankDeadlineDay) : ""}
                        onChange={(v) => patch({ bankDeadlineDay: v ? Number(v) : null })}
                        options={deadlineOptions.map((d) => ({
                            value: d === null ? "" : String(d),
                            label: d === null ? t("monthEnd") : lang === "ne" ? `${toNepaliDigits(d)} गते` : `Day ${d}`,
                        }))}
                    />
                    <div className="mt-4 flex items-center justify-between">
                        <span className="text-[16px] text-ink-2">{t("remindBefore")}</span>
                        <Stepper value={s.reminderDaysBefore} min={0} max={15} onChange={(v) => patch({ reminderDaysBefore: v })} label={num(s.reminderDaysBefore)} />
                    </div>
                </Card>

                <Card title={t("lendingSettings")}>
                    <label className="block">
                        <span className="text-[15px] text-ink-2">{t("defaultRate")}</span>
                        <div className="mt-1.5 flex gap-2">
                            <input
                                inputMode="decimal"
                                value={rate}
                                onChange={(e) => setRate(toAsciiDigits(e.target.value).replace(/[^\d.]/g, ""))}
                                className="h-12 flex-1 rounded-xl bg-paper px-3 text-[16px] font-semibold outline-none ring-1 ring-line focus:ring-2 focus:ring-saffron"
                            />
                            <button
                                type="button"
                                disabled={!rate || Number(rate) === s.defaultRatePer100}
                                onClick={() => patch({ defaultRatePer100: Number(rate) })}
                                className="h-12 rounded-xl bg-ink px-4 font-semibold text-paper disabled:opacity-30"
                            >
                                {t("save")}
                            </button>
                        </div>
                    </label>
                    <label className="mt-4 flex items-center justify-between gap-4">
                        <span className="text-[16px] text-ink">{t("compounding")}</span>
                        <Switch checked={s.compoundingEnabled} onCheckedChange={(v) => patch({ compoundingEnabled: v })} />
                    </label>
                    <div className="mt-4">
                        <p className="text-[15px] text-ink-2">{t("interestBasis")}</p>
                        <div className="mt-1.5 grid grid-cols-2 gap-1 rounded-xl bg-paper-2 p-1 text-[14px] font-semibold">
                            {(["balance", "principal"] as const).map((b) => (
                                <button
                                    key={b}
                                    type="button"
                                    onClick={() => patch({ interestBasis: b })}
                                    className={cn("min-h-11 rounded-lg px-2 transition-colors", s.interestBasis === b ? "bg-card text-ink shadow-sm" : "text-ink-3")}
                                >
                                    {b === "balance" ? t("basisBalance") : t("basisPrincipal")}
                                </button>
                            ))}
                        </div>
                    </div>
                </Card>

                <Card title={t("changePin")}>
                    <p className="mb-2 text-[14px] text-ink-2">{t("currentPin")}</p>
                    <PinInput autoFocus={false} value={pins.current} onChange={(v) => setPins((p) => ({ ...p, current: v }))} />
                    <p className="mb-2 mt-4 text-[14px] text-ink-2">{t("newPin")}</p>
                    <PinInput autoFocus={false} value={pins.next} onChange={(v) => setPins((p) => ({ ...p, next: v }))} />
                    <button
                        type="button"
                        disabled={pins.current.length !== 4 || pins.next.length !== 4 || pinBusy}
                        onClick={changePin}
                        className="mt-4 h-12 w-full rounded-xl bg-ink font-semibold text-paper disabled:opacity-30"
                    >
                        {t("changePin")}
                    </button>
                </Card>
            </div>
        </>
    )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="rounded-[24px] bg-card p-4 ring-1 ring-line">
            <h2 className="mb-3 text-[15px] font-semibold text-ink">{title}</h2>
            {children}
        </section>
    )
}

function Stepper({ value, min, max, onChange, label }: { value: number; min: number; max: number; onChange: (v: number) => void; label: string }) {
    return (
        <div className="flex items-center gap-2">
            <button
                type="button"
                disabled={value <= min}
                onClick={() => onChange(value - 1)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-paper-2 disabled:opacity-30"
                aria-label="-"
            >
                <Minus className="h-4 w-4" />
            </button>
            <span className="w-8 text-center text-[16px] font-semibold tabular">{label}</span>
            <button
                type="button"
                disabled={value >= max}
                onClick={() => onChange(value + 1)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-paper-2 disabled:opacity-30"
                aria-label="+"
            >
                <Plus className="h-4 w-4" />
            </button>
        </div>
    )
}
