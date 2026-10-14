"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, ArrowRight } from "lucide-react"
import { signIn } from "@repo/auth/client"
import { AuthFrame } from "@/components/auth/auth-frame"
import { PinInput } from "@/components/pin-input"
import { useI18n } from "@/lib/i18n"
import { displayPhone, normalizePhone, toAsciiDigits } from "@/lib/phone"
import { Loader } from "@repo/ui/components/ui/loader"

const LAST_PHONE_KEY = "sajilo.lastPhone"

export function LoginClient() {
    const { t } = useI18n()
    const [step, setStep] = useState<"phone" | "pin">("phone")
    const [phone, setPhone] = useState("")
    const [pin, setPin] = useState("")
    const [error, setError] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)
    const [attempt, setAttempt] = useState(0)

    useEffect(() => {
        const last = localStorage.getItem(LAST_PHONE_KEY)
        if (last) {
            setPhone(displayPhone(last))
            setStep("pin")
        }
    }, [])

    const e164 = normalizePhone(phone)

    const submit = async (fullPin: string) => {
        if (!e164) return
        setBusy(true)
        setError(null)
        const res = await signIn.phoneNumber({ phoneNumber: e164, password: fullPin, rememberMe: true })
        if (res.error) {
            setBusy(false)
            setPin("")
            setAttempt((a) => a + 1)
            setError(res.error.status === 429 ? t("tooManyTries") : t("wrongPin"))
            return
        }
        localStorage.setItem(LAST_PHONE_KEY, e164)
        window.location.replace("/today")
    }

    return (
        <AuthFrame>
            {step === "phone" ? (
                <form
                    className="flex flex-1 flex-col"
                    onSubmit={(e) => {
                        e.preventDefault()
                        if (e164) setStep("pin")
                        else setError(t("invalidPhone"))
                    }}
                >
                    <div className="mt-14">
                        <h1 className="text-[30px] font-semibold leading-tight text-ink">{t("loginTitle")}</h1>
                        <p className="mt-1.5 text-[17px] text-ink-2">{t("loginSub")}</p>
                    </div>
                    <label className="mt-10 block">
                        <span className="text-[15px] font-medium text-ink-2">{t("phone")}</span>
                        <div className="mt-2 flex h-16 items-center rounded-2xl bg-card px-4 ring-1 ring-line focus-within:ring-2 focus-within:ring-saffron">
                            <span className="mr-3 text-lg text-ink-3">+977</span>
                            <input
                                autoFocus
                                inputMode="numeric"
                                autoComplete="tel-national"
                                value={phone}
                                onChange={(e) => {
                                    setError(null)
                                    setPhone(toAsciiDigits(e.target.value).replace(/\D/g, "").slice(0, 10))
                                }}
                                placeholder={t("phonePlaceholder")}
                                className="h-full w-full bg-transparent text-2xl tracking-wider text-ink outline-none placeholder:text-ink-3/50"
                            />
                        </div>
                    </label>
                    {error && <p className="mt-3 text-[15px] text-miss">{error}</p>}
                    <div className="mt-auto pb-6">
                        <button
                            type="submit"
                            disabled={phone.length < 10}
                            className="flex h-16 w-full items-center justify-center gap-2 rounded-2xl bg-ink text-lg font-semibold text-paper transition-opacity disabled:opacity-30"
                        >
                            {t("next")} <ArrowRight className="h-5 w-5" />
                        </button>
                        <p className="mt-5 text-center text-[15px] text-ink-2">
                            {t("noAccount")}{" "}
                            <Link href="/signup" className="font-semibold text-saffron">
                                {t("createAccount")}
                            </Link>
                        </p>
                    </div>
                </form>
            ) : (
                <div className="flex flex-1 flex-col">
                    <button
                        type="button"
                        onClick={() => {
                            setPin("")
                            setError(null)
                            setStep("phone")
                        }}
                        className="mt-6 inline-flex w-fit items-center gap-1.5 rounded-full bg-paper-2 px-3 py-1.5 text-[15px] text-ink-2"
                    >
                        <ArrowLeft className="h-4 w-4" /> +977 {phone}
                    </button>
                    <div className="mt-8 text-center">
                        <h1 className="text-[26px] font-semibold text-ink">{t("enterPin")}</h1>
                    </div>
                    <div className="mt-8">
                        <PinInput
                            key={attempt}
                            value={pin}
                            onChange={(v) => {
                                setError(null)
                                setPin(v)
                            }}
                            onComplete={(v) => void submit(v)}
                            disabled={busy}
                            error={!!error}
                        />
                    </div>
                    <div className="mt-4 flex h-8 items-center justify-center">
                        {busy ? <Loader size={24} dotSize={3} /> : <p className="text-center text-[15px] text-miss">{error}</p>}
                    </div>
                </div>
            )}
        </AuthFrame>
    )
}
