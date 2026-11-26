"use client"

import { useState } from "react"
import { Mic } from "lucide-react"
import { cn } from "@repo/ui/lib/utils"
import { BrandMark } from "@/components/brand"
import { Band, BandTitle, Kicker } from "./band"
import { useLanding } from "./use-landing"

const WASH = [
    "from-[#fde7d3] to-[#fbf1e4]",
    "from-sky-wash to-sky-soft",
    "from-[#e9e3fb] to-[#f3f0fd]",
    "from-[#dff1e6] to-[#eef8f1]",
    "from-[#fbe3c4] to-[#e4f0fb]",
]

/** What he says (saffron, right) and what Sajilo says back (white, left): a tiny phone screen. */
function Talk({ say, reply }: { say: string; reply: string }) {
    return (
        <div className="w-full max-w-[290px] rounded-[26px] border border-ink/10 bg-card p-3 shadow-[0_18px_40px_-20px_rgba(42,33,24,0.35)]">
            <div className="flex justify-end">
                <p className="flex max-w-[85%] items-center gap-1.5 rounded-2xl rounded-br-md bg-saffron px-3 py-2 text-[15px] font-medium text-white">
                    <Mic className="size-3.5 shrink-0 opacity-80" />
                    {say}
                </p>
            </div>
            <div className="mt-2 flex items-end gap-2">
                <BrandMark size={22} className="mb-0.5" />
                <p className="max-w-[85%] rounded-2xl rounded-bl-md bg-sky-soft px-3 py-2 text-[15px] font-medium text-sky-ink">{reply}</p>
            </div>
        </div>
    )
}

/**
 * Five moments of one day as expanding panels (Gurukul's first-week pattern). From lg they sit side by side and the
 * open one grows (only flex-grow animates; its text is absolutely placed at a fixed width so nothing reflows). Below
 * lg they are a plain open stack.
 */
export function DayPanels() {
    const { c } = useLanding()
    const [open, setOpen] = useState(1)
    return (
        <Band id="day" tone="white">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <Kicker>{c.day.kicker}</Kicker>
                    <BandTitle title={c.day.title} muted={c.day.muted} />
                </div>
                <p className="hidden text-sm font-medium text-ink-3 lg:block">{c.day.hint}</p>
            </div>
            <div className="mt-12 flex flex-col gap-3 lg:h-[27rem] lg:flex-row">
                {c.day.steps.map((s, i) => {
                    const isOpen = open === i
                    return (
                        <button
                            key={s.title}
                            type="button"
                            onMouseEnter={() => setOpen(i)}
                            onFocus={() => setOpen(i)}
                            onClick={() => setOpen(i)}
                            aria-expanded={isOpen}
                            className={cn(
                                "relative overflow-hidden rounded-[24px] bg-gradient-to-br text-left transition-[flex-grow] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] lg:min-w-0 lg:basis-0",
                                WASH[i],
                                isOpen ? "lg:grow-[4]" : "lg:grow",
                            )}
                        >
                            <div className="flex h-full flex-col p-5 lg:p-6">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold text-ink-3 tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                                    <span className="rounded-full bg-card/80 px-2.5 py-0.5 text-xs font-semibold text-ink-2 tabular-nums">{s.moment}</span>
                                </div>
                                <h3 className="mt-3 text-xl font-semibold tracking-tight text-ink lg:whitespace-nowrap">{s.title}</h3>
                                <div
                                    className={cn(
                                        "mt-2 flex flex-col gap-5 transition-opacity duration-500 lg:absolute lg:top-[5.75rem] lg:left-6 lg:w-[min(30rem,calc(100%-3rem))]",
                                        isOpen ? "opacity-100 lg:delay-200" : "lg:pointer-events-none lg:opacity-0",
                                    )}
                                >
                                    <p className="max-w-md leading-relaxed text-ink-2">{s.text}</p>
                                    <Talk say={s.say} reply={s.reply} />
                                </div>
                            </div>
                        </button>
                    )
                })}
            </div>
        </Band>
    )
}
