'use client';

import { useId } from 'react';

/**
 * The Saathi mark, in the two sizes the product actually uses.
 *
 * Shared here rather than duplicated per app: the staff app and the student portal both render
 * Saathi, and the mark is brand identity - two copies drift, and a mark that differs by one pixel
 * between two surfaces of the same assistant reads as two different assistants.
 *
 * Palette is the brand gold gradient (#c9a961 -> #a87f1f) only.
 */

/**
 * The animated mark, for a launcher screen.
 *
 * Ambient, not attention-seeking: two rings turning very slowly in opposite directions, a gold arc
 * tracing the middle ring, and a soft breathing core. Everything is slow enough to read as "idle,
 * listening" rather than "loading". Motion is defined in one scoped <style> block so
 * `prefers-reduced-motion: reduce` switches ALL of it off in one place - a user who has asked for no
 * motion gets the identical static mark.
 *
 * Use at 60px and up. Below that the rings collapse into a gold blob - use SaathiGlyph.
 */
export function SaathiMark({ size }: { size: number }) {
    // Scoped ids so two marks on one screen cannot share (and fight over) a gradient or keyframe.
    const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
    const gold = `saathiGold-${uid}`;
    const spin = `saathiSpin-${uid}`;
    const spinRev = `saathiSpinRev-${uid}`;
    const trace = `saathiTrace-${uid}`;
    const breathe = `saathiBreathe-${uid}`;

    // r=38 ring circumference, used for the tracing dash.
    const midCircumference = 2 * Math.PI * 38;

    return (
        <div className="shrink-0 text-neutral-400 dark:text-neutral-500" style={{ width: size, height: size }}>
            <style>{`
                @keyframes ${spin} { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                @keyframes ${spinRev} { from { transform: rotate(0deg); } to { transform: rotate(-360deg); } }
                @keyframes ${trace} { to { stroke-dashoffset: ${-midCircumference}; } }
                @keyframes ${breathe} {
                    0%, 100% { opacity: .10; transform: scale(1); }
                    50% { opacity: .22; transform: scale(1.08); }
                }
                .${spin} { animation: ${spin} 54s linear infinite; transform-origin: 60px 60px; }
                .${spinRev} { animation: ${spinRev} 38s linear infinite; transform-origin: 60px 60px; }
                .${trace} { animation: ${trace} 26s linear infinite; }
                .${breathe} { animation: ${breathe} 7s ease-in-out infinite; transform-origin: 60px 60px; }
                @media (prefers-reduced-motion: reduce) {
                    .${spin}, .${spinRev}, .${trace}, .${breathe} { animation: none; }
                }
            `}</style>
            <svg viewBox="0 0 120 120" width={size} height={size} role="presentation" aria-hidden="true">
                <defs>
                    <linearGradient id={gold} x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#c9a961" />
                        <stop offset="100%" stopColor="#a87f1f" />
                    </linearGradient>
                </defs>

                {/* Outer dashed ring - the slowest element, reads as ambient not active. */}
                <circle
                    className={spin}
                    cx="60" cy="60" r="52" fill="none"
                    stroke="currentColor" strokeOpacity="0.28" strokeWidth="1" strokeDasharray="2 8"
                />

                {/* Middle ring, plus the gold arc tracing it. */}
                <circle cx="60" cy="60" r="38" fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="1" />
                <circle
                    className={trace}
                    cx="60" cy="60" r="38" fill="none"
                    stroke={`url(#${gold})`} strokeWidth="1.75" strokeLinecap="round"
                    strokeDasharray={`${midCircumference * 0.22} ${midCircumference * 0.78}`}
                />

                {/* Counter-rotating nodes - the only thing that suggests "thinking". */}
                <g className={spinRev}>
                    <circle cx="60" cy="22" r="2.4" fill={`url(#${gold})`} />
                    <circle cx="92.9" cy="79" r="1.7" fill="currentColor" opacity="0.45" />
                    <circle cx="27.1" cy="79" r="1.7" fill="currentColor" opacity="0.45" />
                </g>

                {/* Breathing halo + solid core. */}
                <circle className={breathe} cx="60" cy="60" r="15" fill={`url(#${gold})`} />
                <circle cx="60" cy="60" r="7.5" fill={`url(#${gold})`} />
            </svg>
        </div>
    );
}

/**
 * The mark at small sizes, STATIC.
 *
 * Two things make the animated version wrong below about 60px. Visually, its three concentric rings
 * and orbiting nodes collapse into an indistinct gold blob. Practically, the small mark renders in
 * the panel header on every screen and once per assistant reply, so animating it would leave a dozen
 * SVGs turning forever behind a conversation someone is trying to read. The ring-and-core reduction
 * is still recognisably the same mark.
 */
/**
 * The small mark, for a chat header or a message avatar.
 *
 * TWO SPARKS, not concentric rings. The rings were the big animated mark shrunk down, and at
 * 22px three circles inside each other resolve to a smudge - it read as a loading spinner that
 * had stopped. A four-point spark is the one shape that still reads as "assistant" at this size,
 * and the second, smaller one is the point: Saathi means companion, so the mark is a pair rather
 * than a lone star.
 *
 * Concave sides come from quadratic curves pulled to the centre, which is what makes a spark
 * rather than a diamond. Brand gold gradient only.
 */
export function SaathiGlyph({ size = 22 }: { size?: number }) {
    const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
    const gold = `saathiGlyphGold-${uid}`;
    /** Four-point spark centred at (cx,cy). Control points at the centre pull each side in. */
    const spark = (cx: number, cy: number, r: number) =>
        `M ${cx} ${cy - r} Q ${cx} ${cy} ${cx + r} ${cy} Q ${cx} ${cy} ${cx} ${cy + r} ` +
        `Q ${cx} ${cy} ${cx - r} ${cy} Q ${cx} ${cy} ${cx} ${cy - r} Z`;

    return (
        <span className="shrink-0" style={{ width: size, height: size }} aria-hidden>
            <svg viewBox="0 0 24 24" width={size} height={size} role="presentation">
                <defs>
                    <linearGradient id={gold} x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#c9a961" />
                        <stop offset="100%" stopColor="#a87f1f" />
                    </linearGradient>
                </defs>
                <path d={spark(10, 13.5, 8.5)} fill={`url(#${gold})`} />
                <path d={spark(18.5, 5.5, 4.2)} fill={`url(#${gold})`} fillOpacity="0.75" />
            </svg>
        </span>
    );
}
