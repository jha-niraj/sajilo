"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, ArrowRight } from "lucide-react"
import { signIn } from "@repo/auth/client"
import { AuthFrame } from "@/components/auth/auth-frame"
import { PinInput } from "@/components/pin-input"
import { useI18n } from "@/lib/i18n"
import { normalizePhone, toAsciiDigits } from "@/lib/phone"
import { signUpCollector } from "@/actions/auth.action"
import { Loader } from "@repo/ui/components/ui/loader"

type Step = "details" | "pin" | "confirm"

export function SignupClient() {
    const { t, lang } = useI18n()
    const [step, setStep] = useState<Step>("details")
    const [name, setName] = useState("")
    const [phone, setPhone] = useState("")
    const [pin, setPin] = useState("")
    const [confirm, setConfirm] = useState("")
    const [error, setError] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)

    const e164 = normalizePhone(phone)

    const finish = async (confirmPin: string) => {
        if (confirmPin !== pin) {
            setError(t("pinMismatch"))
            setConfirm("")
            setPin("")
            setStep("pin")
            return
        }
        setBusy(true)
        const res = await signUpCollector({ name, phone, pin, language: lang })
        if (!res.ok) {
            setBusy(false)
            setConfirm("")
            setPin("")
            setStep("details")
            setError(res.error === "phone_taken" ? t("phoneTaken") : t("invalidPhone"))
            return
        }
        const login = await signIn.phoneNumber({ phoneNumber: res.phone, password: pin, rememberMe: true })
        if (login.error) {
            window.location.replace("/login")
            return
        }
        localStorage.setItem("sajilo.lastPhone", res.phone)
        window.location.replace("/manage")
    }

    const onPinChange = (v: string) => {
        setError(null)
        if (step === "pin") setPin(v)
        else setConfirm(v)
    }

    const onPinComplete = (v: string) => {
        if (step === "pin") setTimeout(() => setStep("confirm"), 150)
        else void finish(v)
    }

    if (step === "details") {
        return (
            <AuthFrame>
                <form
                    className="flex flex-1 flex-col"
                    onSubmit={(e) => {
                        e.preventDefault()
                        if (!name.trim()) return
                        if (!e164) return setError(t("invalidPhone"))
                        setStep("pin")
                    }}
                >
                    <h1 className="mt-12 text-[30px] font-semibold leading-tight text-ink">{t("signupTitle")}</h1>
                    <label className="mt-8 block">
                        <span className="text-[15px] font-medium text-ink-2">{t("yourName")}</span>
                        <input
                            autoFocus
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            autoComplete="name"
                            className="mt-2 h-16 w-full rounded-2xl bg-card px-4 text-xl text-ink outline-none ring-1 ring-line focus:ring-2 focus:ring-saffron"
                        />
                    </label>
                    <label className="mt-5 block">
                        <span className="text-[15px] font-medium text-ink-2">{t("phone")}</span>
                        <div className="mt-2 flex h-16 items-center rounded-2xl bg-card px-4 ring-1 ring-line focus-within:ring-2 focus-within:ring-saffron">
                            <span className="mr-3 text-lg text-ink-3">+977</span>
                            <input
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
                            disabled={!name.trim() || phone.length < 10}
                            className="flex h-16 w-full items-center justify-center gap-2 rounded-2xl bg-ink text-lg font-semibold text-paper disabled:opacity-30"
                        >
                            {t("next")} <ArrowRight className="h-5 w-5" />
                        </button>
                        <p className="mt-5 text-center text-[15px] text-ink-2">
                            {t("haveAccount")}{" "}
                            <Link href="/login" className="font-semibold text-saffron">
                                {t("signIn")}
                            </Link>
                        </p>
                    </div>
                </form>
            </AuthFrame>
        )
    }

    const value = step === "pin" ? pin : confirm
    return (
        <AuthFrame>
            <div className="flex flex-1 flex-col">
                <button
                    type="button"
                    onClick={() => {
                        setPin("")
                        setConfirm("")
                        setStep("details")
                    }}
                    className="mt-6 inline-flex w-fit items-center gap-1.5 rounded-full bg-paper-2 px-3 py-1.5 text-[15px] text-ink-2"
                >
                    <ArrowLeft className="h-4 w-4" /> {t("back")}
                </button>
                <h1 className="mt-8 text-center text-[26px] font-semibold text-ink">
                    {step === "pin" ? t("choosePin") : t("confirmPin")}
                </h1>
                <div className="mt-8">
                    <PinInput key={`${step}-${error ?? ""}`} value={value} onChange={onPinChange} onComplete={onPinComplete} disabled={busy} error={!!error} />
                </div>
                <div className="mt-4 flex h-8 items-center justify-center">
                    {busy ? <Loader size={24} dotSize={3} /> : <p className="text-center text-[15px] text-miss">{error}</p>}
                </div>
            </div>
        </AuthFrame>
    )
}
