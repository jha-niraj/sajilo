"use client"

import Link from "next/link"
import { Calculator, Camera, ChevronRight, LogOut, Settings, Users, Wallet } from "lucide-react"
import { signOut } from "@repo/auth/client"
import { PageTop } from "@/components/shell/page-top"
import { InstallCard } from "@/components/shell/install-card"
import { ProfilePhoto } from "@/components/settings/profile-photo"
import { useI18n } from "@/lib/i18n"
import { displayPhone } from "@/lib/phone"
import { clearLocalData } from "@/lib/offline/store"
import type { DictKey } from "@/lib/dict"

const LINKS: { href: string; label: DictKey; icon: typeof Users }[] = [
    { href: "/manage", label: "manageTitle", icon: Users },
    { href: "/scan", label: "scanTitle", icon: Camera },
    { href: "/cash", label: "cashOnHand", icon: Wallet },
    { href: "/loans/calculator", label: "calculator", icon: Calculator },
    { href: "/settings", label: "settingsTitle", icon: Settings },
]

export function MoreClient({ name, phone, photo }: { name: string; phone: string | null; photo: string | null }) {
    const { t } = useI18n()
    const logout = async () => {
        await signOut()
        await clearLocalData()
        window.location.replace("/")
    }

    return (
        <>
            <PageTop title={t("navMore")} />
            <div className="space-y-4 px-4 pt-4">
                <div className="flex items-center gap-3 rounded-[24px] bg-card p-4 ring-1 ring-line">
                    <ProfilePhoto name={name} initialUrl={photo} />
                    <div className="min-w-0">
                        <p className="truncate text-[16px] font-semibold text-ink">{name}</p>
                        {phone && <p className="text-[15px] text-ink-3">+977 {displayPhone(phone)}</p>}
                    </div>
                </div>

                <InstallCard />

                <ul className="divide-y divide-line overflow-hidden rounded-[24px] bg-card ring-1 ring-line">
                    {LINKS.map(({ href, label, icon: Icon }) => (
                        <li key={href}>
                            <Link href={href} className="flex items-center gap-3 px-4 py-4 active:bg-paper-2">
                                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-paper-2 text-ink-2">
                                    <Icon className="h-5 w-5" />
                                </span>
                                <span className="flex-1 text-[15px] font-medium text-ink">{t(label)}</span>
                                <ChevronRight className="h-5 w-5 text-ink-3" />
                            </Link>
                        </li>
                    ))}
                </ul>

                <button
                    type="button"
                    onClick={logout}
                    className="flex w-full items-center justify-center gap-2 rounded-[24px] bg-paper-2 py-4 text-[16px] font-semibold text-miss"
                >
                    <LogOut className="h-5 w-5" /> {t("signOut")}
                </button>
            </div>
        </>
    )
}
