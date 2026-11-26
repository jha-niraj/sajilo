"use client"

import Link from "@/components/app-link"
import { BrandMark } from "@/components/brand"
import { DhakaStrip } from "./art/dhaka-strip"
import { ValleyWordmark } from "./art/wordmark"
import { useLanding } from "./use-landing"

export function SiteFooter() {
    const { c } = useLanding()
    const links = [
        { href: "/#story", label: c.nav.story },
        { href: "/about", label: c.nav.about },
        { href: "/about#contact", label: c.footer.contact },
        { href: "/login", label: c.nav.signIn },
    ]
    return (
        <footer className="overflow-hidden bg-card">
            <DhakaStrip tone="sajilo" scale={2} />
            <div className="mx-auto flex max-w-[1200px] flex-col gap-6 px-4 pt-12 sm:flex-row sm:items-start sm:justify-between sm:px-6">
                <div>
                    <Link href="/" className="flex items-center gap-2 font-semibold text-ink">
                        <BrandMark size={32} />
                        <span className="text-xl tracking-tight">Sajilo</span>
                    </Link>
                    <p className="mt-2 max-w-xs text-ink-2">{c.footer.tagline}</p>
                </div>
                <ul className="flex flex-wrap gap-x-6 gap-y-2">
                    {links.map((l) => (
                        <li key={l.href}>
                            <Link href={l.href} className="font-medium text-ink-2 hover:text-ink">
                                {l.label}
                            </Link>
                        </li>
                    ))}
                </ul>
            </div>
            <div className="mx-auto max-w-[1200px] px-4 pt-6 text-sm text-ink-3 sm:px-6">
                © {new Date().getFullYear()} Sajilo · {c.footer.made}
            </div>
            <div className="mx-auto -mb-[3%] max-w-[1200px] px-2 pt-8 sm:px-6">
                <ValleyWordmark />
            </div>
        </footer>
    )
}
