"use client"

import Link from "next/link"
import { ChevronRight, LogOut } from "lucide-react"
import { toast } from "sonner"
import { signOut } from "@repo/auth/client"
import { useConfirm } from "@repo/ui/components/ui/use-confirm"
import { PageTop } from "@/components/shell/page-top"
import { InstallCard } from "@/components/shell/install-card"
import { MORE_LINKS } from "@/components/shell/more-links"
import { ProfilePhoto } from "@/components/settings/profile-photo"
import { useI18n } from "@/lib/i18n"
import { displayPhone } from "@/lib/phone"
import { clearLocalData, idb } from "@/lib/offline/store"
import { flush } from "@/lib/offline/sync"

export function MoreClient({ name, phone, photo }: { name: string; phone: string | null; photo: string | null }) {
    const { t } = useI18n()
    const { confirm, confirmDialog } = useConfirm()
    const logout = async () => {
        const ok = await confirm({ title: t("signOutTitle"), description: t("signOutBody"), confirmText: t("signOut"), cancelText: t("cancel") })
        if (!ok) return
        // Signing out wipes this phone's copy, so anything still waiting to sync would be lost.
        await flush().catch(() => {})
        if ((await idb().outbox.count().catch(() => 0)) > 0) {
            toast.error(t("signOutUnsynced"))
            return
        }
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
                    <div className="min-w-0 flex-1">
                        <p className="truncate text-[16px] font-semibold text-ink">{name}</p>
                        {phone && <p className="text-[15px] text-ink-3">+977 {displayPhone(phone)}</p>}
                    </div>
                    <button
                        type="button"
                        onClick={() => void logout()}
                        className="flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-paper-2 px-3.5 text-[14px] font-semibold text-miss active:bg-line"
                    >
                        <LogOut className="h-4 w-4" /> {t("signOut")}
                    </button>
                </div>

                <InstallCard />

                <ul className="divide-y divide-line overflow-hidden rounded-[24px] bg-card ring-1 ring-line">
                    {MORE_LINKS.map(({ href, label, icon: Icon }) => (
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
            </div>
            {confirmDialog}
        </>
    )
}
