"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { CalendarCheck2, ChartColumnBig, HandCoins, LayoutGrid } from "lucide-react"
import { cn } from "@repo/ui/lib/utils"
import { useI18n } from "@/lib/i18n"
import type { DictKey } from "@/lib/dict"

const ITEMS: { href: string; label: DictKey; icon: typeof CalendarCheck2; match: string[] }[] = [
    { href: "/today", label: "navToday", icon: CalendarCheck2, match: ["/today", "/customers"] },
    { href: "/month", label: "navMonth", icon: ChartColumnBig, match: ["/month"] },
    { href: "/loans", label: "navLoans", icon: HandCoins, match: ["/loans", "/cash"] },
    { href: "/more", label: "navMore", icon: LayoutGrid, match: ["/more", "/manage", "/settings", "/scan"] },
]

export function BottomNav() {
    const pathname = usePathname()
    const { t } = useI18n()
    return (
        <nav className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/95 backdrop-blur pb-safe">
            <ul className="mx-auto grid max-w-lg grid-cols-4">
                {ITEMS.map(({ href, label, icon: Icon, match }) => {
                    const active = match.some((m) => pathname === m || pathname.startsWith(m + "/"))
                    return (
                        <li key={href}>
                            <Link
                                href={href}
                                prefetch
                                className={cn(
                                    "flex h-16 flex-col items-center justify-center gap-0.5 text-[13px] font-medium transition-colors",
                                    active ? "text-saffron" : "text-ink-3",
                                )}
                            >
                                <span className={cn("rounded-full px-4 py-1 transition-colors", active && "bg-saffron-soft")}>
                                    <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.4 : 2} />
                                </span>
                                {t(label)}
                            </Link>
                        </li>
                    )
                })}
            </ul>
        </nav>
    )
}
