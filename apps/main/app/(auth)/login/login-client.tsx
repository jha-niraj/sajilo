"use client"

import { useEffect, useState } from "react"
import Link from "@/components/app-link"
import { useRouter } from "next/navigation"
import { RotateCcw } from "lucide-react"
import { signIn } from "@repo/auth/client"
import { Loader } from "@repo/ui/components/ui/loader"
import { AuthBody, AuthFrame, AuthHeading } from "@/components/auth/auth-frame"
import { PhoneInput } from "@/components/auth/phone-input"
import { PinInput } from "@/components/pin-input"
import { useI18n } from "@/lib/i18n"
import { displayPhone, normalizePhone } from "@/lib/phone"
import { readDeviceAccount, saveDeviceAccount, type DeviceAccount } from "@/lib/device-account"
import { signInDestination } from "@/lib/sign-in-destination"
import { LandingShell } from "@/components/shell/landing-shell"
import { LANG_SYNC_KEY } from "@/components/shell/lang-sync"

type Mode = "loading" | "phone" | "pin"

export function LoginClient() {
    const { t, ready } = useI18n()
    const router = useRouter()
    const [mode, setMode] = useState<Mode>("loading")
    const [landing, setLanding] = useState<string | null>(null)
    const [account, setAccount] = useState<DeviceAccount | null>(null)
    const [phone, setPhone] = useState("")
    const [pin, setPin] = useState("")
    const [error, setError] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)
    const [attempt, setAttempt] = useState(0)
    const [direction, setDirection] = useState<1 | -1>(1)

    useEffect(() => {
        const saved = readDeviceAccount()
        setAccount(saved)
        setMode(saved ? "pin" : "phone")
    }, [])

    const confirmPhone = (digits: string) => {
        const e164 = normalizePhone(digits)
        if (!e164) {
            setError(t("invalidPhone"))
            return
        }
        setError(null)
        setAccount({ phone: e164 })
        setDirection(1)
        setMode("pin")
    }

    const submit = async (fullPin: string) => {
        if (!account) return
        setBusy(true)
        setError(null)
        const res = await signIn.phoneNumber({ phoneNumber: account.phone, password: fullPin, rememberMe: true })
        if (res.error) {
            setBusy(false)
            setPin("")
            setAttempt((a) => a + 1)
            setError(res.error.status === 429 ? t("tooManyTries") : t("wrongPin"))
            return
        }
        saveDeviceAccount({ phone: account.phone, name: res.data?.user?.name ?? account.name })
        try {
            sessionStorage.setItem(LANG_SYNC_KEY, "1")
        } catch {
            // the language still applies on this phone through its cookie
        }
        // The screen moves now: the app's frame and the destination's skeleton, then one RSC fetch.
        const to = signInDestination(window.location.search)
        setLanding(to)
        router.push(to)
    }

    if (landing) return <LandingShell path={landing} />

    if (mode === "loading" || !ready) {
        return (
            <AuthFrame>
                <div className="flex flex-1 items-center justify-center">
                    <Loader size={28} dotSize={3} />
                </div>
            </AuthFrame>
        )
    }

    if (mode === "phone") {
        return (
            <AuthFrame stepKey="phone" direction={direction}>
                <AuthBody>
                    <AuthHeading art="phone" title={t("phoneOnceTitle")} sub={t("phoneOnceSub")} />
                    <div className="mt-9">
                        <PhoneInput
                            value={phone}
                            onChange={(v) => {
                                setError(null)
                                setPhone(v)
                            }}
                            onComplete={confirmPhone}
                            error={!!error}
                            onClear={() => {
                                setError(null)
                                setPhone("")
                            }}
                        />
                        <p className="mt-3 min-h-6 text-center text-[15px] text-miss">{error}</p>
                    </div>
                </AuthBody>
                <Footer />
            </AuthFrame>
        )
    }

    const firstName = account?.name?.split(" ")[0]
    return (
        <AuthFrame stepKey="pin" direction={direction}>
            <AuthBody>
                <AuthHeading art="welcome" title={firstName ? t("welcomeBackName", { name: firstName }) : t("welcomeBack")} sub={t("pinSub")} />
                <div className="mt-9">
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
                    <div className="mt-4 flex min-h-8 items-center justify-center">
                        {busy ? <Loader size={24} dotSize={3} /> : <p className="text-center text-[15px] text-miss">{error}</p>}
                    </div>
                </div>
                <div className="mt-2 flex flex-col items-center gap-1.5 text-[15px] text-ink-2">
                    <span className="tabular">+977 {displayPhone(account?.phone)}</span>
                    <button
                        type="button"
                        onClick={() => {
                            setPin("")
                            setError(null)
                            setPhone("")
                            setDirection(-1)
                            setMode("phone")
                        }}
                        className="inline-flex items-center gap-1 font-semibold text-saffron"
                    >
                        <RotateCcw className="h-4 w-4" /> {t("useAnotherNumber")}
                    </button>
                </div>
            </AuthBody>
            <Footer />
        </AuthFrame>
    )
}

function Footer() {
    const { t } = useI18n()
    return (
        <div className="pb-8 pt-6">
            <Link
                href="/signup"
                className="flex h-12 w-full items-center justify-center rounded-2xl bg-card text-[16px] font-semibold text-ink ring-1 ring-line transition-colors active:bg-paper-2"
            >
                {t("noAccount")} <span className="ml-1.5 text-saffron">{t("createAccount")}</span>
            </Link>
        </div>
    )
}
