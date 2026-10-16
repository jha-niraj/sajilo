"use client"

import { useEffect, useRef, useState } from "react"
import Link from "@/components/app-link"
import { useRouter } from "next/navigation"
import { PrefetchKind } from "@/lib/prefetch-kind"
import { motion } from "framer-motion"
import { ArrowLeft, ArrowRight } from "lucide-react"
import { Loader } from "@repo/ui/components/ui/loader"
import { AuthArt, AuthBody, AuthFrame, AuthHeading } from "@/components/auth/auth-frame"
import { PhoneInput } from "@/components/auth/phone-input"
import { PinInput } from "@/components/pin-input"
import { useI18n } from "@/lib/i18n"
import { normalizePhone } from "@/lib/phone"
import { saveDeviceAccount } from "@/lib/device-account"
import { phoneHasAccount, signUpCollector } from "@/actions/auth.action"

type Step = "name" | "phone" | "pin" | "confirm" | "done"
const ORDER: Step[] = ["name", "phone", "pin", "confirm"]

export function SignupClient() {
    const { t, lang, ready } = useI18n()
    const router = useRouter()
    const [step, setStep] = useState<Step>("name")
    const [direction, setDirection] = useState<1 | -1>(1)
    const [name, setName] = useState("")
    const [phone, setPhone] = useState("")
    const [pin, setPin] = useState("")
    const [confirm, setConfirm] = useState("")
    const [error, setError] = useState<string | null>(null)
    const [taken, setTaken] = useState(false)
    const [busy, setBusy] = useState(false)
    const nameRef = useRef<HTMLInputElement>(null)

    // Keep anything typed before the page finished loading (React would otherwise reset it to "").
    useEffect(() => {
        const typed = nameRef.current?.value
        if (typed) setName(typed)
    }, [])

    const go = (next: Step, dir: 1 | -1 = 1) => {
        setError(null)
        setDirection(dir)
        setStep(next)
    }

    const back = () => {
        const i = ORDER.indexOf(step)
        if (i <= 0) return
        if (step === "confirm") {
            setPin("")
            setConfirm("")
            return go("pin", -1)
        }
        go(ORDER[i - 1]!, -1)
    }

    const checkPhone = async (digits: string) => {
        if (!normalizePhone(digits)) return setError(t("invalidPhone"))
        setBusy(true)
        const exists = await phoneHasAccount(digits).catch(() => false)
        setBusy(false)
        if (exists) {
            setTaken(true)
            return
        }
        go("pin")
    }

    const finish = async (confirmPin: string) => {
        if (confirmPin !== pin) {
            setConfirm("")
            setPin("")
            setDirection(-1)
            setStep("pin")
            setError(t("pinMismatch"))
            return
        }
        setBusy(true)
        const res = await signUpCollector({ name, phone, pin, language: lang })
        if (!res.ok) {
            setBusy(false)
            setConfirm("")
            setPin("")
            if (res.error === "phone_taken") {
                setTaken(true)
                go("phone", -1)
            } else {
                go("phone", -1)
                setError(t("invalidPhone"))
            }
            return
        }
        // signUpCollector already signed him in (better-auth's nextCookies set the session cookie on
        // that same reply), so there is no second sign-in request here.
        saveDeviceAccount({ phone: res.phone, name: name.trim() })
        setDirection(1)
        setStep("done")
        // Munshi's skeleton loads while the welcome plays, so the move after it paints at once.
        router.prefetch("/munshi?welcome=1", { kind: PrefetchKind.AUTO })
        setTimeout(() => router.push("/munshi?welcome=1"), 900)
    }

    if (!ready) {
        return (
            <AuthFrame>
                <div className="flex flex-1 items-center justify-center">
                    <Loader size={28} dotSize={3} />
                </div>
            </AuthFrame>
        )
    }

    if (step === "done") {
        return (
            <AuthFrame stepKey="done">
                <div className="flex flex-1 flex-col items-center justify-center text-center">
                    <motion.div
                        initial={{ scale: 0.6, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: "spring", stiffness: 260, damping: 18 }}
                    >
                        <AuthArt name="done" className="h-[min(34dvh,280px)]" />
                    </motion.div>
                    <h1 className="mt-7 text-[24px] font-semibold text-ink">{t("allSet", { name: name.trim().split(" ")[0] ?? "" })}</h1>
                    <p className="mt-2 text-[15px] text-ink-2">{t("meetMunshi")}</p>
                </div>
            </AuthFrame>
        )
    }

    const index = ORDER.indexOf(step)
    return (
        <AuthFrame stepKey={step} step={index} steps={ORDER.length} direction={direction}>
            {index > 0 && (
                <button
                    type="button"
                    onClick={back}
                    disabled={busy}
                    className="mt-6 inline-flex w-fit items-center gap-1.5 rounded-full bg-paper-2 px-3 py-1.5 text-[15px] text-ink-2"
                >
                    <ArrowLeft className="h-4 w-4" /> {t("back")}
                </button>
            )}

            {step === "name" && (
                <form
                    className="flex flex-1 flex-col"
                    onSubmit={(e) => {
                        e.preventDefault()
                        if (name.trim()) go("phone")
                    }}
                >
                    <AuthBody>
                        <AuthHeading art="name" title={t("nameTitle")} sub={t("nameSub")} />
                        <input
                            ref={nameRef}
                            autoFocus
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            autoComplete="name"
                            placeholder={t("namePlaceholder")}
                            className="mt-9 h-12 w-full rounded-2xl border border-line bg-card px-5 text-[19px] font-medium text-ink outline-none transition-shadow placeholder:text-ink-3/50 focus:ring-2 focus:ring-saffron"
                        />
                    </AuthBody>
                    <PrimaryButton disabled={!name.trim()} label={t("continue")} />
                </form>
            )}

            {step === "phone" && (
                <AuthBody>
                    <AuthHeading art="phone" title={t("phoneOnceTitle")} sub={t("phoneSignupSub")} />
                    <div className="mt-9">
                        <PhoneInput
                            value={phone}
                            onChange={(v) => {
                                setError(null)
                                setTaken(false)
                                setPhone(v)
                            }}
                            onComplete={(v) => void checkPhone(v)}
                            disabled={busy}
                            error={!!error || taken}
                            onClear={() => {
                                setError(null)
                                setTaken(false)
                                setPhone("")
                            }}
                        />
                        <div className="mt-3 min-h-6">
                            {busy ? (
                                <Loader size={22} dotSize={3} />
                            ) : taken ? (
                                <div className="rounded-2xl bg-card p-4 ring-1 ring-line">
                                    <p className="text-[15px] font-medium text-ink">{t("alreadyHasAccount")}</p>
                                    <Link
                                        href="/"
                                        onClick={() => {
                                            const e164 = normalizePhone(phone)
                                            if (e164) saveDeviceAccount({ phone: e164 })
                                        }}
                                        className="mt-3 flex h-12 items-center justify-center rounded-xl bg-ink font-semibold text-paper"
                                    >
                                        {t("loginWithNumber")}
                                    </Link>
                                </div>
                            ) : (
                                <p className="text-center text-[15px] text-miss">{error}</p>
                            )}
                        </div>
                    </div>
                </AuthBody>
            )}

            {(step === "pin" || step === "confirm") && (
                <AuthBody>
                    <AuthHeading
                        art={step === "pin" ? "pin" : "confirm"}
                        title={step === "pin" ? t("choosePin") : t("confirmPin")}
                        sub={step === "pin" ? t("pinCreateSub") : t("pinConfirmSub")}
                    />
                    <div className="mt-9">
                        <PinInput
                            key={`${step}-${error ?? ""}`}
                            value={step === "pin" ? pin : confirm}
                            onChange={(v) => {
                                setError(null)
                                if (step === "pin") setPin(v)
                                else setConfirm(v)
                            }}
                            onComplete={(v) => {
                                if (step === "pin") setTimeout(() => go("confirm"), 120)
                                else void finish(v)
                            }}
                            disabled={busy}
                            error={!!error}
                        />
                        <div className="mt-4 flex min-h-8 items-center justify-center">
                            {busy ? (
                                <span className="flex items-center gap-2 text-[15px] text-ink-2">
                                    <Loader size={20} dotSize={2} /> {t("settingUp")}
                                </span>
                            ) : (
                                <p className="text-center text-[15px] text-miss">{error}</p>
                            )}
                        </div>
                    </div>
                </AuthBody>
            )}

            {step === "name" && (
                <p className="pb-8 text-center text-[15px] text-ink-2">
                    {t("haveAccount")}{" "}
                    <Link href="/" className="font-semibold text-saffron">
                        {t("signIn")}
                    </Link>
                </p>
            )}
        </AuthFrame>
    )
}

function PrimaryButton({ disabled, label }: { disabled?: boolean; label: string }) {
    return (
        <div className="pb-5 pt-6">
            <button
                type="submit"
                disabled={disabled}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-ink text-[16px] font-semibold text-paper shadow-[0_12px_30px_-14px_rgb(42_33_24/0.6)] transition-opacity disabled:opacity-25 disabled:shadow-none"
            >
                {label} <ArrowRight className="h-5 w-5" />
            </button>
        </div>
    )
}
