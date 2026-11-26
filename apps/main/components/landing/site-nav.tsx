"use client"

import Link from "@/components/app-link"
import { Menu } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@repo/ui/components/ui/dropdown-menu"
import { BrandMark } from "@/components/brand"
import { LangSwitch } from "./lang-switch"
import { useLanding } from "./use-landing"

/** Sticky, blurred bar. The four story links are anchors on the home page; About is its own page. */
export function SiteNav() {
    const { c } = useLanding()
    const links = [
        { href: "/#story", label: c.nav.story },
        { href: "/#features", label: c.nav.features },
        { href: "/#day", label: c.nav.day },
        { href: "/#who", label: c.nav.who },
        { href: "/about", label: c.nav.about },
    ]
    return (
        <header className="sticky top-0 z-40 h-16 border-b border-line/70 bg-paper/75 backdrop-blur-md">
            <nav className="mx-auto flex h-full max-w-[1200px] items-center gap-3 px-4 sm:px-6">
                <Link href="/" className="flex items-center gap-2 rounded-lg font-semibold tracking-tight text-ink" aria-label={c.nav.home}>
                    <BrandMark size={30} />
                    <span className="text-lg">Sajilo</span>
                </Link>
                <ul className="ml-6 hidden items-center gap-1 lg:flex">
                    {links.map((l) => (
                        <li key={l.href}>
                            <Link href={l.href} className="rounded-full px-3 py-2 text-[15px] font-medium text-ink-2 transition-colors hover:bg-paper-2 hover:text-ink">
                                {l.label}
                            </Link>
                        </li>
                    ))}
                </ul>
                <div className="ml-auto flex items-center gap-2">
                    <LangSwitch className="hidden sm:inline-flex" />
                    <Link href="/login" className="inline-flex h-10 items-center rounded-full bg-ink px-4 text-sm font-semibold text-paper transition-opacity hover:opacity-90">
                        {c.nav.signIn}
                    </Link>
                    <DropdownMenu modal={false}>
                        <DropdownMenuTrigger
                            aria-label={c.nav.menu}
                            className="inline-flex size-10 items-center justify-center rounded-full border border-line bg-card text-ink lg:hidden"
                        >
                            <Menu className="size-5" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" sideOffset={8} className="w-60 rounded-2xl border-line bg-card p-2">
                            {links.map((l) => (
                                <DropdownMenuItem key={l.href} asChild className="rounded-xl px-3 py-2.5 text-[15px] font-medium">
                                    <Link href={l.href}>{l.label}</Link>
                                </DropdownMenuItem>
                            ))}
                            <DropdownMenuSeparator className="sm:hidden" />
                            <div className="p-1 sm:hidden">
                                <LangSwitch />
                            </div>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </nav>
        </header>
    )
}
