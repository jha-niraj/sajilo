"use client"

import Link from "@/components/app-link"
import { useLanding } from "./use-landing"

/** The last word before the footer: built for one man first, with the uncle waving. */
export function Closing() {
    const { c } = useLanding()
    return (
        <section className="mx-auto max-w-[1200px] bg-paper px-4 pb-20 sm:px-6 sm:pb-28">
            <div className="grid items-center gap-6 overflow-hidden rounded-[32px] bg-[linear-gradient(120deg,var(--color-sky-wash),var(--color-sky-soft)_55%,#fdf1e4)] px-6 pt-10 sm:px-12 lg:grid-cols-[1.2fr_0.8fr] lg:pt-0">
                <div className="lg:py-16">
                    <h2 className="text-[2rem] leading-[1.12] font-semibold tracking-[-0.035em] text-balance text-ink sm:text-5xl">{c.cta.title}</h2>
                    <p className="mt-4 max-w-lg text-lg leading-relaxed text-ink-2">{c.cta.muted}</p>
                    <div className="mt-7 flex flex-wrap gap-3">
                        <Link href="/login" className="inline-flex h-12 items-center rounded-full bg-ink px-6 font-semibold text-paper transition-opacity hover:opacity-90">
                            {c.cta.signIn}
                        </Link>
                        <Link href="/about" className="inline-flex h-12 items-center rounded-full border border-ink/15 bg-card px-6 font-semibold text-ink transition-colors hover:bg-paper">
                            {c.cta.about}
                        </Link>
                    </div>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element -- static WebP; no image optimizer on Workers */}
                <img src="/images/auth/done.webp" alt="" aria-hidden loading="lazy" className="pointer-events-none mx-auto block h-56 w-auto self-end select-none lg:h-80" />
            </div>
        </section>
    )
}
