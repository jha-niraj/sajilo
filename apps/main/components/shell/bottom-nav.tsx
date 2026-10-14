"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { CalendarCheck2, ChartColumnBig, HandCoins, LayoutGrid } from "lucide-react"
import { cn } from "@repo/ui/lib/utils"
import { useI18n } from "@/lib/i18n"
import type { DictKey } from "@/lib/dict"

type Item = { href: string; label: DictKey; icon: typeof CalendarCheck2; match: string[] }

const LEFT: Item[] = [
    { href: "/today", label: "navToday", icon: CalendarCheck2, match: ["/today", "/customers"] },
    { href: "/month", label: "navMonth", icon: ChartColumnBig, match: ["/month"] },
]
const RIGHT: Item[] = [
    { href: "/loans", label: "navLoans", icon: HandCoins, match: ["/loans", "/cash"] },
    { href: "/more", label: "navMore", icon: LayoutGrid, match: ["/more", "/manage", "/settings", "/scan"] },
]

export function BottomNav() {
    const pathname = usePathname()
    const { t } = useI18n()
    const isActive = (match: string[]) => match.some((m) => pathname === m || pathname.startsWith(m + "/"))
    const munshiActive = pathname.startsWith("/munshi")

    const tab = ({ href, label, icon: Icon, match }: Item) => {
        const active = isActive(match)
        return (
            <li key={href}>
                <Link
                    href={href}
                    prefetch
                    className={cn("flex h-16 flex-col items-center justify-center gap-0.5 text-[12px] font-medium transition-colors", active ? "text-saffron" : "text-ink-3")}
                >
                    <span className={cn("rounded-full px-3.5 py-1 transition-colors", active && "bg-saffron-soft")}>
                        <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.4 : 2} />
                    </span>
                    {t(label)}
                </Link>
            </li>
        )
    }

    return (
        <nav className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/95 backdrop-blur pb-safe">
            <ul className="mx-auto grid max-w-lg grid-cols-5">
                {LEFT.map(tab)}
                <li className="flex justify-center">
                    <Link href="/munshi" prefetch aria-label={t("navMunshi")} className="group -mt-6 flex flex-col items-center gap-1">
                        <span
                            className={cn(
                                "relative flex h-14 w-14 items-center justify-center rounded-full shadow-[0_10px_24px_-8px_rgb(200_97_31/0.7)] ring-4 ring-paper transition-transform group-active:scale-95",
                                "bg-[radial-gradient(circle_at_32%_26%,#fff2e2_0%,#ffb36b_28%,#e3611c_62%,#7b61ff_120%)]",
                            )}
                        >
                            <span className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_22%,rgb(255_255_255/0.7),transparent_38%)]" />
                            {munshiActive && <span className="absolute -inset-1 rounded-full ring-2 ring-saffron/50" />}
                        </span>
                        <span className={cn("text-[12px] font-semibold", munshiActive ? "text-saffron" : "text-ink-2")}>{t("navMunshi")}</span>
                    </Link>
                </li>
                {RIGHT.map(tab)}
            </ul>
        </nav>
    )
}
