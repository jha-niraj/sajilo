"use client"

import { BadgeCheck, Languages, Smartphone, Undo2, Volume2, WifiOff, type LucideIcon } from "lucide-react"
import { cn } from "@repo/ui/lib/utils"
import { Band, BandTitle, Kicker } from "./band"
import { useLanding } from "./use-landing"

const ICONS: LucideIcon[] = [Languages, WifiOff, BadgeCheck, Undo2, Smartphone, Volume2]
/** Each cell's tile and chip colour: saffron, sky, green (got it), amber (check this), violet, sky. */
const TONES = [
    "bg-saffron-soft text-saffron",
    "bg-sky-soft text-sky-ink",
    "bg-paid-soft text-paid",
    "bg-flag-soft text-[#9a5f08]",
    "bg-late-soft text-late",
    "bg-sky-soft text-sky-ink",
]

/** Six things it does, in one hairline grid (Gurukul's trust grid). Each cell ends on a small coloured chip. */
export function Features() {
    const { c } = useLanding()
    return (
        <Band id="features" tone="paper">
            <Kicker>{c.features.kicker}</Kicker>
            <BandTitle title={c.features.title} muted={c.features.muted} />
            <ul className="mt-12 grid gap-px overflow-hidden rounded-[24px] border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
                {c.features.items.map((f, i) => {
                    const Icon = ICONS[i] ?? Languages
                    const tone = TONES[i] ?? TONES[0]
                    return (
                        <li key={f.title} className="flex flex-col bg-card">
                            <div className="flex-1 p-6 sm:p-7">
                                <span className={cn("flex size-11 items-center justify-center rounded-xl", tone)}>
                                    <Icon className="size-5" strokeWidth={2.2} />
                                </span>
                                <h3 className="mt-5 text-lg font-semibold tracking-tight text-ink">{f.title}</h3>
                                <p className="mt-1.5 leading-relaxed text-ink-2">{f.line}</p>
                            </div>
                            <div className="border-t border-line bg-paper/60 px-6 py-4 sm:px-7">
                                <span className={cn("inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold", tone)}>{f.chip}</span>
                            </div>
                        </li>
                    )
                })}
            </ul>
        </Band>
    )
}
