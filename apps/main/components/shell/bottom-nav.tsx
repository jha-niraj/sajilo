"use client"

import { useEffect, useLayoutEffect, useRef, useState } from "react"
import Link from "@/components/app-link"
import { usePathname } from "next/navigation"
import { motion } from "framer-motion"
import { CalendarCheck2, ChartColumnBig, ChevronRight, LayoutGrid, Smartphone, UserRound } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@repo/ui/components/ui/dropdown-menu"
import { cn } from "@repo/ui/lib/utils"
import { useI18n } from "@/lib/i18n"
import type { DictKey } from "@/lib/dict"
import { MORE_LINKS } from "./more-links"
import { useStaggeredPrefetch, type QueuedPrefetch } from "./use-staggered-prefetch"
import { PrefetchKind } from "@/lib/prefetch-kind"

type Item = { href: string; label: DictKey; icon: typeof CalendarCheck2; match: string[] }

const LEFT: Item[] = [
    { href: "/today", label: "navToday", icon: CalendarCheck2, match: ["/today"] },
    { href: "/month", label: "navMonth", icon: ChartColumnBig, match: ["/month"] },
]
const RIGHT: Item[] = [
    // Recharge took Loans' place (2026-11-06): he sells recharge many times a day and lends rarely.
    { href: "/recharge", label: "rcTitle", icon: Smartphone, match: ["/recharge", "/reports/recharge"] },
    { href: "/more", label: "navMore", icon: LayoutGrid, match: ["/more", "/manage", "/settings", "/scan", "/loans", "/cash", "/reports"] },
]

/**
 * Every page as a SHELL only (layout + its loading.tsx skeleton, a few kB), one at a time from idle.
 * A tap paints the skeleton at once and fetches only that page's data. Full prefetches were measured
 * on 2026-10-16: fine on wifi, but on a slow network four full pages shared the line with the page he
 * tapped (6-13 s to ready on 3G). Decided with him: skeletons only, on every network.
 */
const WARM: QueuedPrefetch[] = [
    { href: "/today", kind: PrefetchKind.AUTO },
    { href: "/munshi", kind: PrefetchKind.AUTO },
    { href: "/month", kind: PrefetchKind.AUTO },
    { href: "/recharge", kind: PrefetchKind.AUTO },
    ...MORE_LINKS.map((l) => ({ href: l.href, kind: PrefetchKind.AUTO })),
    { href: "/more", kind: PrefetchKind.AUTO },
]

/** Room above the bar for the selected tab to rise into. */
const RISE = 22
const BAR = 56
const MUNSHI = 2

/**
 * One soft arch over the selected item - a low curve for the four pages, a taller dome around the
 * Munshi orb - and no line anywhere else. Both shapes use the same commands so the arch can glide
 * from one item to the next.
 */
function archFor(w: number, index: number) {
    const yb = RISE
    const cell = w / 5
    const cx = cell * (index + 0.5)
    const munshi = index === MUNSHI
    const half = munshi ? 50 : Math.min(cell / 2 + 4, 52)
    const top = munshi ? -4 : 6
    const r = (n: number) => Math.round(n * 10) / 10
    const x1 = cx - half
    const x2 = cx + half
    // A bell: flat where it meets the bar, round over the icon.
    const hump = [
        `C ${r(cx - half * 0.5)} ${yb} ${r(cx - half * 0.55)} ${top} ${r(cx)} ${top}`,
        `C ${r(cx + half * 0.55)} ${top} ${r(cx + half * 0.5)} ${yb} ${r(x2)} ${yb}`,
    ].join(" ")
    return {
        arch: `M ${r(x1)} ${yb} ${hump}`,
        fill: `M -2 ${yb} L ${r(x1)} ${yb} ${hump} L ${w + 2} ${yb}`,
        x1,
        x2,
    }
}

/** `activePath` lets the sign-in landing screen highlight where he is going rather than `/`. */
export function BottomNav({ activePath }: { activePath?: string } = {}) {
    const currentPath = usePathname()
    const pathname = (activePath ?? currentPath).split("?")[0]!
    const { t } = useI18n()
    const ref = useRef<HTMLElement>(null)
    const [size, setSize] = useState({ w: 0, h: 0 })
    // Not on the sign-in landing screen: that one is gone the moment the real page arrives.
    useStaggeredPrefetch(WARM, pathname, activePath === undefined)

    useLayoutEffect(() => {
        const el = ref.current
        if (!el) return
        const ro = new ResizeObserver(() => setSize({ w: el.offsetWidth, h: el.offsetHeight }))
        ro.observe(el)
        return () => ro.disconnect()
    }, [])

    // A customer's page belongs to the tab it was opened from, like its back link (customers/[id]/page.tsx).
    const [from, setFrom] = useState<string | null>(null)
    useEffect(() => setFrom(new URLSearchParams(window.location.search).get("from")), [pathname])
    const navPath = !pathname.startsWith("/customers/") ? pathname : from === "today" ? "/today" : from === "month" ? "/month" : "/manage"
    const isActive = (match: string[]) => match.some((m) => navPath === m || navPath.startsWith(m + "/"))
    const munshiActive = pathname.startsWith("/munshi")
    const items = [...LEFT, null, ...RIGHT]
    const activeIndex = munshiActive ? MUNSHI : items.findIndex((it) => it && isActive(it.match))

    const shape = size.w ? archFor(size.w, activeIndex >= 0 ? activeIndex : MUNSHI) : null
    const fill = shape ? `${shape.fill} L ${size.w + 2} ${size.h + 2} L -2 ${size.h + 2} Z` : ""
    const morph = { type: "spring" as const, stiffness: 380, damping: 34 }

    const tab = (item: Item, index: number) => {
        const active = index === activeIndex
        const Icon = item.icon
        if (item.href === "/more") return <MoreMenu key={item.href} item={item} active={active} />
        return (
            <li key={item.href}>
                <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                        "flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
                        active ? "text-saffron" : "text-ink-3",
                    )}
                    style={{ height: BAR + (active ? 8 : 0), marginTop: active ? -8 : 0 }}
                >
                    <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 2} />
                    <span className={cn(active && "font-semibold")}>{t(item.label)}</span>
                </Link>
            </li>
        )
    }

    return (
        <nav ref={ref} className="no-print sticky bottom-0 z-40 pb-safe" style={{ paddingTop: RISE }}>
            {size.w > 0 && (
                <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" viewBox={`0 0 ${size.w} ${size.h}`} preserveAspectRatio="none">
                    <defs>
                        <filter id="nav-lift" x="-10%" y="-60%" width="120%" height="220%">
                            <feDropShadow dx="0" dy="-3" stdDeviation="6" floodColor="#7a4a1e" floodOpacity="0.08" />
                        </filter>
                        {/* The arch fades out where it meets the bar, so it reads as one curve, not a tab. */}
                        <motion.linearGradient id="nav-arch" gradientUnits="userSpaceOnUse" y1="0" y2="0" initial={false} animate={{ x1: shape!.x1, x2: shape!.x2 }} transition={morph}>
                            <stop offset="0" stopColor="var(--color-saffron)" stopOpacity="0" />
                            <stop offset="0.3" stopColor="var(--color-saffron)" stopOpacity="0.55" />
                            <stop offset="0.7" stopColor="var(--color-saffron)" stopOpacity="0.55" />
                            <stop offset="1" stopColor="var(--color-saffron)" stopOpacity="0" />
                        </motion.linearGradient>
                    </defs>
                    <motion.path initial={false} animate={{ d: fill }} transition={morph} className="fill-paper" filter="url(#nav-lift)" />
                    {activeIndex >= 0 && (
                        <motion.path initial={false} animate={{ d: shape!.arch }} transition={morph} fill="none" stroke="url(#nav-arch)" strokeWidth={1.5} strokeLinecap="round" />
                    )}
                </svg>
            )}
            <ul className="relative grid grid-cols-5">
                {LEFT.map((it, i) => tab(it, i))}
                <li className="flex justify-center">
                    <Link
                        href="/munshi"
                            aria-label={t("navMunshi")}
                        aria-current={munshiActive ? "page" : undefined}
                        className="group -mt-4 flex flex-col items-center gap-1"
                    >
                        <span
                            className={cn(
                                "relative flex h-12 w-12 items-center justify-center rounded-full shadow-[0_8px_20px_-8px_rgb(200_97_31/0.65)] transition-transform group-active:scale-95",
                                "bg-[radial-gradient(circle_at_32%_26%,#fff2e2_0%,#ffb36b_28%,#e3611c_62%,#7b61ff_120%)]",
                            )}
                        >
                            <span className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_22%,rgb(255_255_255/0.7),transparent_38%)]" />
                        </span>
                        <span className={cn("text-[11px] leading-none", munshiActive ? "font-semibold text-saffron" : "font-medium text-ink-2")}>{t("navMunshi")}</span>
                    </Link>
                </li>
                {RIGHT.map((it, i) => tab(it, i + 3))}
            </ul>
        </nav>
    )
}

/** "More" opens a menu of the places behind it instead of a page; the More page stays for the profile and sign out. */
function MoreMenu({ item, active }: { item: Item; active: boolean }) {
    const { t } = useI18n()
    const pathname = usePathname()
    const Icon = item.icon
    return (
        <li>
            <DropdownMenu modal={false}>
                <DropdownMenuTrigger
                    aria-current={active ? "page" : undefined}
                    className={cn(
                        "flex w-full flex-col items-center justify-center gap-1 text-[11px] font-medium outline-none transition-colors data-[state=open]:text-saffron",
                        active ? "text-saffron" : "text-ink-3",
                    )}
                    style={{ height: BAR + (active ? 8 : 0), marginTop: active ? -8 : 0 }}
                >
                    <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 2} />
                    <span className={cn(active && "font-semibold")}>{t(item.label)}</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                    side="top"
                    align="end"
                    sideOffset={10}
                    collisionPadding={12}
                    className="w-64 rounded-[22px] border-line bg-card p-1.5 shadow-[0_18px_40px_-16px_rgb(42_33_24/0.45)]"
                >
                    {MORE_LINKS.map(({ href, label, icon: LinkIcon }) => {
                        const here = pathname === href || pathname.startsWith(href + "/")
                        return (
                            <DropdownMenuItem key={href} asChild className="cursor-pointer rounded-2xl px-3 py-2.5 focus:bg-paper-2">
                                <Link href={href} className={cn("flex items-center gap-3 text-[15px] font-medium", here ? "text-saffron" : "text-ink")}>
                                    <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", here ? "bg-saffron-soft text-saffron" : "bg-paper-2 text-ink-2")}>
                                        <LinkIcon className="h-[18px] w-[18px]" />
                                    </span>
                                    <span className="min-w-0 flex-1 truncate">{t(label)}</span>
                                </Link>
                            </DropdownMenuItem>
                        )
                    })}
                    <DropdownMenuSeparator className="mx-2 my-1 bg-line" />
                    <DropdownMenuItem asChild className="cursor-pointer rounded-2xl px-3 py-2.5 focus:bg-paper-2">
                        <Link href="/more" className={cn("flex items-center gap-3 text-[15px] font-medium", pathname === "/more" ? "text-saffron" : "text-ink")}>
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-paper-2 text-ink-2">
                                <UserRound className="h-[18px] w-[18px]" />
                            </span>
                            <span className="min-w-0 flex-1 truncate">{t("profileAndAccount")}</span>
                            <ChevronRight className="h-4 w-4 shrink-0 text-ink-3" />
                        </Link>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </li>
    )
}
