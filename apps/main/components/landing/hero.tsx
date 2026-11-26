"use client"

import Link from "@/components/app-link"
import { ArrowDown } from "lucide-react"
import { DhakaStrip } from "./art/dhaka-strip"
import { ValleyHero } from "./art/valley/valley"
import { useLanding } from "./use-landing"

/**
 * Light sky over the pixel town. The copy and the collector (the uncle from sign-in) sit above the valley; the valley's
 * own sky fades into the page's lighter wash so there is no seam.
 */
export function Hero() {
    const { c } = useLanding()
    return (
        <section className="relative -mt-16 overflow-hidden bg-[linear-gradient(180deg,var(--color-sky-wash)_0%,var(--color-sky-soft)_45%,#eef5fb_100%)] pt-16">
            <div className="relative z-10 mx-auto grid max-w-[1200px] items-center gap-6 px-4 pt-10 sm:px-6 sm:pt-16 lg:grid-cols-[1.1fr_0.9fr] lg:pt-20">
                <div className="text-center lg:text-left">
                    <p className="inline-flex items-center gap-2 rounded-full border border-sky/25 bg-card/80 px-3 py-1 text-sm font-semibold text-sky-ink">
                        <span className="size-2 rounded-full bg-saffron" aria-hidden />
                        {c.hero.kicker}
                    </p>
                    <h1 className="mt-5 text-[2.6rem] leading-[1.08] font-semibold tracking-[-0.045em] text-balance text-ink sm:text-6xl lg:text-7xl">
                        {c.hero.title}
                        <span className="block text-saffron">{c.hero.accent}</span>
                    </h1>
                    <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-ink-2 lg:mx-0">{c.hero.lead}</p>
                    <div className="mt-7 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
                        <Link href="/#story" className="inline-flex h-12 items-center gap-2 rounded-full bg-ink px-6 font-semibold text-paper transition-opacity hover:opacity-90">
                            {c.hero.watch}
                            <ArrowDown className="size-4" />
                        </Link>
                        <Link href="/login" className="inline-flex h-12 items-center rounded-full border border-ink/15 bg-card px-6 font-semibold text-ink transition-colors hover:bg-paper">
                            {c.hero.signIn}
                        </Link>
                    </div>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element -- static WebP; no image optimizer on Workers */}
                <img
                    src="/images/auth/welcome.webp"
                    alt=""
                    aria-hidden
                    fetchPriority="high"
                    className="pointer-events-none mx-auto block h-[min(34vh,300px)] w-auto select-none drop-shadow-[0_18px_30px_rgba(29,100,163,0.18)] lg:h-[420px]"
                />
            </div>
            <div className="relative -mt-6 [mask-image:linear-gradient(to_bottom,transparent,black_28%)] sm:-mt-16 lg:-mt-28">
                <ValleyHero crop="banner" preserve="xMidYMax slice" className="hidden aspect-[240/78] w-full sm:block" />
                <ValleyHero crop="portrait" preserve="xMidYMax slice" className="block aspect-[96/84] w-full sm:hidden" />
            </div>
            <DhakaStrip tone="sky" scale={2} />
        </section>
    )
}
