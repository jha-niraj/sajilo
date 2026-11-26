"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@repo/ui/lib/utils"
import { STORY_SCENES } from "./art/scenes"
import { PixelReveal } from "./art/story/reveal"
import { Kicker } from "./band"
import { useLanding } from "./use-landing"

/**
 * The father's day in five chapters (Gurukul's story pattern): a sticky chapter list on the left, panels that scroll
 * like a document on the right. Whichever panel crosses the middle of the screen lights up its chapter. On phones the
 * list hides and each panel carries its own number and title.
 */
export function Story() {
    const { c } = useLanding()
    const chapters = c.story.chapters
    const [active, setActive] = useState<string>(chapters[0]!.id)
    const panels = useRef<Map<string, HTMLElement>>(new Map())

    useEffect(() => {
        if (typeof IntersectionObserver === "undefined") return
        const io = new IntersectionObserver(
            (entries) => {
                for (const e of entries) if (e.isIntersecting) setActive((e.target as HTMLElement).dataset.chapter ?? "")
            },
            { rootMargin: "-45% 0px -50% 0px" },
        )
        panels.current.forEach((el) => io.observe(el))
        return () => io.disconnect()
    }, [])

    return (
        <section id="story" className="scroll-mt-16 border-b border-line bg-card">
            <div className="mx-auto grid max-w-[1200px] lg:grid-cols-[minmax(300px,0.4fr)_minmax(0,1fr)]">
                <div className="border-line px-4 pt-20 sm:px-6 lg:sticky lg:top-16 lg:max-h-[calc(100svh-4rem)] lg:self-start lg:border-r lg:py-20">
                    <Kicker>{c.story.kicker}</Kicker>
                    <h2 className="max-w-sm text-[2rem] leading-[1.12] font-semibold tracking-[-0.035em] text-balance text-ink sm:text-[2.6rem]">{c.story.title}</h2>
                    <ol className="mt-8 hidden space-y-1 lg:block">
                        {chapters.map((ch, i) => (
                            <li key={ch.id}>
                                <a
                                    href={`#ch-${ch.id}`}
                                    className={cn(
                                        "flex gap-3 rounded-2xl px-3 py-2.5 transition-all",
                                        active === ch.id ? "bg-paper shadow-[0_1px_0_var(--color-line),0_8px_24px_-12px_rgba(42,33,24,0.25)]" : "hover:bg-paper/60",
                                    )}
                                >
                                    <span
                                        className={cn(
                                            "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold tabular-nums",
                                            active === ch.id ? "bg-saffron text-white" : "bg-paper-2 text-ink-3",
                                        )}
                                    >
                                        {String(i + 1).padStart(2, "0")}
                                    </span>
                                    <span>
                                        <span className={cn("block font-semibold", active === ch.id ? "text-ink" : "text-ink-2")}>{ch.title}</span>
                                        <span className="block text-sm text-ink-3">{ch.line}</span>
                                    </span>
                                </a>
                            </li>
                        ))}
                    </ol>
                </div>
                <div className="px-4 pb-16 sm:px-6 lg:py-12">
                    {chapters.map((ch, i) => (
                        <article
                            key={ch.id}
                            id={`ch-${ch.id}`}
                            data-chapter={ch.id}
                            ref={(el) => {
                                if (el) panels.current.set(ch.id, el)
                                else panels.current.delete(ch.id)
                            }}
                            className="scroll-mt-24 border-line py-10 not-last:border-b lg:py-14 lg:pl-6"
                        >
                            <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink-3 lg:hidden">
                                <span className="flex size-6 items-center justify-center rounded-md bg-saffron text-xs text-white">{String(i + 1).padStart(2, "0")}</span>
                                {ch.title}
                            </p>
                            <h3 className="max-w-2xl text-2xl leading-tight font-semibold tracking-[-0.03em] text-balance sm:text-[2rem]">
                                <span className="text-ink">{ch.heading}</span> <span className="text-ink-3">{ch.muted}</span>
                            </h3>
                            <div className="mt-6 overflow-hidden rounded-[22px] border border-line bg-paper-2">
                                <PixelReveal scene={STORY_SCENES[ch.id]} className="block aspect-[96/60] w-full" />
                            </div>
                        </article>
                    ))}
                </div>
            </div>
        </section>
    )
}
