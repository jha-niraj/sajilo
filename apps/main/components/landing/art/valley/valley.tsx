import type { ArtStyle } from "../frame"
import { Drift, Frames, Pixels, PixelSvg } from "../pixel/pixels"
import { BIRD, CLOUDS, PUFF } from "./kit"
import { VALLEY, type ValleyVariant } from "./palette"
import { BANNER_VALLEY, HERO_VALLEY, PORTRAIT_VALLEY, SPEAKERS, type Valley } from "./scene"

/*
 * P1 v3 rendered. The speakers take turns: a bubble opens with typing dots, the words land, it closes, the next person
 * speaks (16s for all four). Under prefers-reduced-motion every bubble shows its words at once (`art.css`).
 */

const TURN = 4

export const VALLEYS = { wide: HERO_VALLEY, banner: BANNER_VALLEY, portrait: PORTRAIT_VALLEY } as const
export type ValleyCrop = keyof typeof VALLEYS

/** The scene as a `<g>`, so it can also be clipped inside a wordmark (pass `bubbles={false}` there). */
export function ValleyLayers({ valley, variant, bubbles = true }: { valley: Valley; variant: ValleyVariant; bubbles?: boolean }) {
    const palette = VALLEY[variant]
    const L = valley.layout
    const low = variant === "gold"
    const birds = [
        [L.birds.x, L.birds.y],
        [L.birds.x + 7, L.birds.y - 4],
        [L.birds.x + 14, L.birds.y + 1],
    ] as const
    return (
        <g>
            <Pixels grid={valley.sky} palette={palette} />
            <Pixels grid={low ? valley.glowLow : valley.glow} palette={palette} className="art-glow" />
            <Pixels grid={low ? valley.sunLow : valley.sun} palette={palette} />
            {L.clouds.map((c, i) => (
                <Drift key={i} width={L.w} grid={CLOUDS[c.kind]} palette={palette} x={c.x} y={c.y} dur={c.dur} delay={c.delay} />
            ))}
            <g className="art-drift" style={{ "--art-dx": `${L.w}px`, "--art-dur": "60s", animationTimingFunction: `steps(${L.w})` } as ArtStyle}>
                {[0, -L.w].flatMap((off) =>
                    birds.map(([x, y], i) => <Frames key={`${off}-${i}`} a={BIRD.a} b={BIRD.b} palette={palette} x={x + off} y={y} dur={0.7} delay={i * 0.23} />),
                )}
            </g>
            <Pixels grid={valley.land} palette={palette} />
            {[0, 1, 2].map((i) => (
                <Pixels
                    key={i}
                    grid={PUFF}
                    palette={palette}
                    x={valley.chimney.x}
                    y={valley.chimney.y - 1}
                    className="art-smoke"
                    style={{ "--art-dur": "3.6s", "--art-delay": `${-i * 1.2}s` }}
                />
            ))}
            {valley.flags.map((f, i) => (
                <Frames key={i} a={f.pair.a} b={f.pair.b} palette={palette} x={f.x} y={f.y} dur={1.1 + (i % 3) * 0.15} delay={i * 0.17} />
            ))}
            {valley.pigeons.map((p, i) => (
                <Frames key={i} a={p.pair.a} b={p.pair.b} palette={palette} x={p.x} y={p.y} dur={1.4 + i * 0.3} delay={i * 0.5} />
            ))}
            <Pixels grid={valley.stallBack.grid} palette={palette} x={valley.stallBack.x} y={valley.stallBack.y} />
            {SPEAKERS.map((s, i) => {
                const p = valley.people[s]
                return <Frames key={s} a={p.pair.a} b={p.pair.b} palette={palette} x={p.x} y={p.y} dur={p.dur} delay={i * 0.9} kind={p.kind} />
            })}
            <Pixels grid={valley.counter.grid} palette={palette} x={valley.counter.x} y={valley.counter.y} />
            {bubbles && <ValleyBubbles valley={valley} variant={variant} />}
        </g>
    )
}

function ValleyBubbles({ valley, variant }: { valley: Valley; variant: ValleyVariant }) {
    const palette = VALLEY[variant]
    return (
        <>
            {SPEAKERS.map((s, turn) => {
                const { b, x, y } = valley.bubbles[s]
                const timing: ArtStyle = { "--art-dur": `${TURN * SPEAKERS.length}s`, "--art-delay": `${turn * TURN}s` }
                return (
                    <g key={s} transform={`translate(${x} ${y}) scale(0.5)`}>
                        <g className={valley.layout.oneBubble && turn > 0 ? "art-say2 art-say2-rest" : "art-say2"} style={timing}>
                            <g className="art-say2-text" style={timing}>
                                <Pixels grid={b.text} palette={palette} />
                            </g>
                            <g className="art-say2-dots" style={timing}>
                                <Pixels grid={b.frame} palette={palette} />
                                {[-5, 0, 5].map((dx, i) => (
                                    <rect
                                        key={dx}
                                        x={b.dots.x + dx}
                                        y={b.dots.y}
                                        width={3}
                                        height={3}
                                        fill={palette.bubbleInk}
                                        className="art-dot"
                                        style={{ "--art-delay": `${i * 0.3}s` } as ArtStyle}
                                    />
                                ))}
                            </g>
                        </g>
                    </g>
                )
            })}
        </>
    )
}

/** P1 v3: the valley, wide (landing hero) or portrait (phone crop, auth panel). */
export function ValleyHero({
    variant = "day",
    crop = "wide",
    className,
    preserve,
}: {
    variant?: ValleyVariant
    crop?: ValleyCrop
    className?: string
    preserve?: string
}) {
    const valley = VALLEYS[crop]
    return (
        <PixelSvg
            w={valley.layout.w}
            h={valley.layout.h}
            className={className}
            preserve={preserve}
            label={`Pixel illustration of a Nepali town ${variant === "gold" ? "at golden hour" : "by day"}: Himalaya, a stupa with prayer flags, a pagoda, houses, a pasal, the collector in his Dhaka topi, the shopkeeper, a student buying recharge`}
        >
            <ValleyLayers valley={valley} variant={variant} />
        </PixelSvg>
    )
}
