"use client"

import { ArrowUpRight, Github, Linkedin, Mail } from "lucide-react"
import { cn } from "@repo/ui/lib/utils"
import { CONTACT } from "@/lib/landing/copy"
import { DhakaStrip } from "./art/dhaka-strip"
import { ABOUT_SCENES, STORY_SCENES, WHO_SCENES, type Scene } from "./art/scenes"
import { PixelReveal } from "./art/story/reveal"
import { Band, BandTitle, Kicker } from "./band"
import { useLanding } from "./use-landing"

/** One scene per chapter: the son building, the father's round, the counter, the voice, the road ahead. */
const CHAPTER_SCENES: Scene[] = [ABOUT_SCENES.build, STORY_SCENES.walk, STORY_SCENES.counter, STORY_SCENES.says, WHO_SCENES.collector]

export function About() {
    const { c } = useLanding()
    const a = c.about
    const contacts = [
        { href: `mailto:${CONTACT.email}`, label: a.email, value: CONTACT.email, icon: Mail, tone: "bg-saffron-soft text-saffron" },
        { href: CONTACT.linkedin, label: "LinkedIn", value: "linkedin.com/in/nirajjha31", icon: Linkedin, tone: "bg-sky-soft text-sky-ink" },
        { href: CONTACT.github, label: "GitHub", value: "github.com/jha-niraj", icon: Github, tone: "bg-paper-2 text-ink" },
    ]
    return (
        <>
            <section className="relative -mt-16 overflow-hidden bg-[linear-gradient(180deg,var(--color-sky-wash)_0%,var(--color-sky-soft)_60%,var(--color-paper)_100%)] pt-16">
                <div className="mx-auto grid max-w-[1200px] items-end gap-8 px-4 pt-14 sm:px-6 lg:grid-cols-[1.2fr_0.8fr] lg:pt-20">
                    <div className="pb-6 lg:pb-16">
                        <Kicker>{a.kicker}</Kicker>
                        <BandTitle as="h1" title={a.title} className="sm:text-6xl" />
                        <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-2">{a.lead}</p>
                    </div>
                    {/* eslint-disable-next-line @next/next/no-img-element -- static WebP; no image optimizer on Workers */}
                    <img src="/images/auth/phone.webp" alt="" aria-hidden fetchPriority="high" className="pointer-events-none mx-auto block h-64 w-auto select-none lg:h-96" />
                </div>
                <DhakaStrip tone="sky" scale={2} />
            </section>

            <section className="bg-paper">
                <div className="mx-auto max-w-[1200px] px-4 py-16 sm:px-6 sm:py-24">
                    <ol className="space-y-16 sm:space-y-24">
                        {a.chapters.map((ch, i) => (
                            <li key={ch.title} className="grid items-center gap-8 lg:grid-cols-2 lg:gap-14">
                                <div className={cn(i % 2 === 1 && "lg:order-2")}>
                                    <p className="flex items-center gap-2 text-sm font-semibold text-saffron">
                                        <span className="flex size-7 items-center justify-center rounded-lg bg-saffron text-xs font-bold text-white tabular-nums">
                                            {String(i + 1).padStart(2, "0")}
                                        </span>
                                        {ch.title}
                                    </p>
                                    <div className="mt-4 space-y-4 text-lg leading-relaxed text-ink-2">
                                        {ch.paras.map((p) => (
                                            <p key={p.slice(0, 24)}>{p}</p>
                                        ))}
                                    </div>
                                </div>
                                <div className="overflow-hidden rounded-[22px] border border-line bg-paper-2">
                                    <PixelReveal scene={CHAPTER_SCENES[i] ?? STORY_SCENES.closes} className="block aspect-[96/60] w-full" />
                                </div>
                            </li>
                        ))}
                    </ol>
                </div>
            </section>

            <Band id="contact" tone="white">
                <Kicker>{a.contactKicker}</Kicker>
                <BandTitle title={a.contactTitle} muted={a.contactMuted} />
                <ul className="mt-10 grid gap-3 sm:grid-cols-3">
                    {contacts.map((ct) => (
                        <li key={ct.label}>
                            <a
                                href={ct.href}
                                target={ct.href.startsWith("http") ? "_blank" : undefined}
                                rel={ct.href.startsWith("http") ? "noreferrer" : undefined}
                                className="group flex h-full items-center gap-4 rounded-[22px] border border-line bg-paper p-5 transition-colors hover:bg-card"
                            >
                                <span className={cn("flex size-12 shrink-0 items-center justify-center rounded-2xl", ct.tone)}>
                                    <ct.icon className="size-5" />
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block font-semibold text-ink">{ct.label}</span>
                                    <span className="block truncate text-sm text-ink-2">{ct.value}</span>
                                </span>
                                <ArrowUpRight className="size-5 shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                            </a>
                        </li>
                    ))}
                </ul>
            </Band>
        </>
    )
}
