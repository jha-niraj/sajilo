"use client"

import { DhakaStrip } from "./art/dhaka-strip"
import { WHO_SCENES, type WhoSceneId } from "./art/scenes"
import { PixelReveal } from "./art/story/reveal"
import { Band, BandTitle, Kicker } from "./band"
import { useLanding } from "./use-landing"

const ORDER: WhoSceneId[] = ["collector", "recharge", "milk", "lender"]

/** Four pixel portraits, each framed by Dhaka strips like the border of a topi, with what they would say. */
export function Who() {
    const { c } = useLanding()
    return (
        <Band id="who" tone="paper">
            <Kicker>{c.who.kicker}</Kicker>
            <BandTitle title={c.who.title} muted={c.who.muted} />
            <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {c.who.items.map((w, i) => {
                    const id = ORDER[i] ?? "collector"
                    return (
                        <li key={w.title} className="overflow-hidden rounded-[22px] border border-line bg-card">
                            <DhakaStrip tone="sajilo" scale={1.5} />
                            <PixelReveal scene={WHO_SCENES[id]} className="block aspect-[64/48] w-full" />
                            <DhakaStrip tone="sajilo" scale={1.5} />
                            <div className="p-5">
                                <div className="flex items-center justify-between gap-2">
                                    <h3 className="font-semibold tracking-tight text-ink">{w.title}</h3>
                                    {w.soon && <span className="rounded-full bg-sky-soft px-2 py-0.5 text-xs font-semibold text-sky-ink">{c.who.soon}</span>}
                                </div>
                                <p className="mt-2 text-ink-2">&ldquo;{w.say}&rdquo;</p>
                            </div>
                        </li>
                    )
                })}
            </ul>
        </Band>
    )
}
