import * as React from 'react';
import { MOTIFS, type ArtKey } from './motifs';
import { PALETTES, type PaletteName } from './palette';
import { resolveSubjectArt, fallbackPalette } from './registry';

/**
 * A generated cover for a subject - the artwork band at the top of a subject card.
 *
 * ## Why SVG and not images
 *
 * A school types its own subject list, so the set is open: there is no point at which someone can
 * finish drawing every cover. Artwork resolved from the NAME means a school that adds "Hotel
 * Management" next year gets a real cover the same day, and nothing in the product ever renders a
 * broken image or a grey box. It also weighs nothing - no request, no layout shift, no `next/image`
 * config, and it inherits the theme instead of being baked at one brightness.
 *
 * ## Everything is namespaced by `uid`
 *
 * Gradients, filters and clip paths live in a global id space. Two covers on one page with the same
 * gradient id and the second silently paints with the first one's colours - which on a subject grid
 * means every card comes out the same shade. `uid` is derived from the subject name, so it is stable
 * between the server render and hydration.
 *
 * ## Motion
 *
 * Slow and small - a card grid with eight things spinning is a fairground. Every animation is
 * defined inside this component's own `<style>` and every one of them is switched off under
 * `prefers-reduced-motion: reduce`, which is a rule and not a nicety.
 */

export interface SubjectArtProps {
    /** The subject's name. Drives both the drawing and the colour unless overridden. */
    name: string;
    /** Force a specific drawing. Use for the everyday tools, where the name is not a subject. */
    artKey?: ArtKey;
    /** Force a palette. */
    palette?: PaletteName;
    className?: string;
    /** Turn motion off regardless of the user's setting - for a dense grid, or a print view. */
    still?: boolean;
}

/** FNV-1a, so an id is stable across server and client. A random id would break hydration. */
function uidFor(seed: string): string {
    let h = 0x811c9dc5;
    for (let i = 0; i < seed.length; i += 1) {
        h ^= seed.charCodeAt(i);
        h = Math.imul(h, 0x01000193) >>> 0;
    }
    return `sa${h.toString(36)}`;
}

export function SubjectArt({ name, artKey, palette, className, still = false }: SubjectArtProps) {
    const resolved = resolveSubjectArt(name);
    const key: ArtKey = artKey ?? resolved.key;
    // An unmatched subject takes a hashed palette rather than always gold, so two unknown subjects
    // in one grid do not come out identical.
    const paletteName: PaletteName =
        palette ?? (resolved.key === 'generic' ? fallbackPalette(name) : resolved.palette);
    const { deep, mid, glow } = PALETTES[paletteName];
    const uid = uidFor(`${name}|${key}|${paletteName}`);
    const Motif = MOTIFS[key];

    return (
        <svg
            viewBox="0 0 320 180"
            role="img"
            aria-label={`${name} artwork`}
            preserveAspectRatio="xMidYMid slice"
            className={className}
        >
            <defs>
                <linearGradient id={`${uid}-wash`} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor={glow} stopOpacity={0.28} />
                    <stop offset="55%" stopColor={mid} stopOpacity={0.10} />
                    <stop offset="100%" stopColor={deep} stopOpacity={0.16} />
                </linearGradient>
                <radialGradient id={`${uid}-halo`} cx="0.5" cy="0.46" r="0.62">
                    <stop offset="0%" stopColor={glow} stopOpacity={0.34} />
                    <stop offset="100%" stopColor={glow} stopOpacity={0} />
                </radialGradient>
                <pattern id={`${uid}-grid`} width="16" height="16" patternUnits="userSpaceOnUse">
                    <path d="M16 0 H0 V16" fill="none" stroke={mid} strokeOpacity={0.16} strokeWidth={0.75} />
                </pattern>
            </defs>

            {/* The ground. Deliberately NOT a solid colour: the card behind it is white on light and
                near-black on dark, and a wash lets both read through so one drawing works on both. */}
            <rect width="320" height="180" fill={`url(#${uid}-wash)`} />
            <rect width="320" height="180" fill={`url(#${uid}-grid)`} />
            <rect width="320" height="180" fill={`url(#${uid}-halo)`} />

            <g className={still ? undefined : 'sa-anim'}>
                <Motif uid={uid} deep={deep} mid={mid} glow={glow} />
            </g>

            <style>{`
                /* Motion is opt-in per motif and off for everyone who asked for less of it. */
                .sa-anim .sa-spin-slow { animation: sa-spin 34s linear infinite; transform-box: fill-box; transform-origin: center; }
                .sa-anim .sa-orbit { animation: sa-orbit 9s linear infinite; transform-box: fill-box; transform-origin: center; }
                .sa-anim .sa-pulse { animation: sa-pulse 2.8s ease-in-out infinite; }
                .sa-anim .sa-blink { animation: sa-blink 1.6s steps(1, end) infinite; }
                .sa-anim .sa-swing { animation: sa-swing 4.2s ease-in-out infinite; }
                .sa-anim .sa-bob { animation: sa-bob 3.4s ease-in-out infinite; transform-box: fill-box; }
                .sa-anim .sa-rise { animation: sa-rise 3.6s ease-in-out infinite; }
                .sa-anim .sa-flicker { animation: sa-flicker 2.4s ease-in-out infinite; transform-box: fill-box; transform-origin: center bottom; }
                .sa-anim .sa-draw { stroke-dasharray: 420; stroke-dashoffset: 420; animation: sa-draw 2.4s ease-out forwards; }
                .sa-anim .sa-delay { animation-delay: -1.4s; }

                @keyframes sa-spin   { to { transform: rotate(360deg); } }
                @keyframes sa-orbit  { to { transform: rotate(-360deg); } }
                @keyframes sa-pulse  { 0%, 100% { opacity: .45; } 50% { opacity: 1; } }
                @keyframes sa-blink  { 0%, 49% { opacity: 1; } 50%, 100% { opacity: .15; } }
                @keyframes sa-swing  { 0%, 100% { transform: rotate(13deg); } 50% { transform: rotate(-13deg); } }
                @keyframes sa-bob    { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
                @keyframes sa-rise   { 0% { opacity: 0; transform: translateY(0); } 30% { opacity: .9; } 100% { opacity: 0; transform: translateY(-16px); } }
                @keyframes sa-flicker{ 0%, 100% { transform: scaleY(1); opacity: .95; } 45% { transform: scaleY(1.12); opacity: 1; } 70% { transform: scaleY(.94); opacity: .85; } }
                @keyframes sa-draw   { to { stroke-dashoffset: 0; } }

                @media (prefers-reduced-motion: reduce) {
                    .sa-anim * { animation: none !important; }
                    /* A draw-on path animates FROM invisible, so switching the animation off has to
                       also put the stroke back - otherwise reduced motion means a missing line. */
                    .sa-anim .sa-draw { stroke-dasharray: none; stroke-dashoffset: 0; }
                }
            `}</style>
        </svg>
    );
}

/**
 * The same artwork as a small square mark - for a sidebar row, a list item, or an avatar-sized
 * chip. It crops the centre of the cover rather than being a second drawing, so a subject looks
 * like itself everywhere it appears.
 */
export function SubjectMark({ name, artKey, palette, className, still = true }: SubjectArtProps) {
    return (
        <span className={className} aria-hidden>
            <svg viewBox="40 20 240 140" preserveAspectRatio="xMidYMid slice" className="h-full w-full">
                <SubjectArtInner name={name} artKey={artKey} palette={palette} still={still} />
            </svg>
        </span>
    );
}

/** The drawing without its own `<svg>`, so `SubjectMark` can re-crop it. */
function SubjectArtInner({ name, artKey, palette, still }: Omit<SubjectArtProps, 'className'>) {
    const resolved = resolveSubjectArt(name);
    const key: ArtKey = artKey ?? resolved.key;
    const paletteName: PaletteName =
        palette ?? (resolved.key === 'generic' ? fallbackPalette(name) : resolved.palette);
    const { deep, mid, glow } = PALETTES[paletteName];
    const uid = uidFor(`mark|${name}|${key}|${paletteName}`);
    const Motif = MOTIFS[key];
    return (
        <g className={still ? undefined : 'sa-anim'}>
            <Motif uid={uid} deep={deep} mid={mid} glow={glow} />
        </g>
    );
}
