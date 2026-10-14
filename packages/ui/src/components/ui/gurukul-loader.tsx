"use client"

import { Logo } from "../logo"
import { SchoolScreen } from "./school-scene"

/*
 * The Gurukul full-page loader: the school at dusk with a paper plane coming in, then the mark
 * beside the "Gurukul" wordmark with a slow sweep across it, a small track, and an optional
 * caption. Same world as the 404, signing in and signing out (`school-scene.tsx`).
 *
 * ## FULL PAGE ONLY. This is the top tier and nothing else.
 *
 * The root CLAUDE.md sets three tiers and this is the third: a spinner or a dot pulse for a
 * control's own action, a SKELETON shaped like the thing arriving for a region inside a page, and
 * this for a whole page or a heavy route transition. It is a 600x320 illustration; dropped inside
 * an already-rendered panel it dwarfs the thing it is waiting for, and a skeleton that shows the
 * shape of the content is strictly better there anyway.
 *
 * `components/inline-loader.tsx` and `payment-verifying.tsx` in the student app already say this
 * in their own headers and deliberately do not call this. Keep it that way.
 *
 * Light and dark aware; still under `prefers-reduced-motion`. Warm throughout (Niraj, 2026-10-13):
 * a terracotta tile, a peach-to-ember sweep on the wordmark and track - no grey, black or white, and
 * not the brand gold either.
 */

const FONT_STACK =
    "var(--font-space-grotesk, 'Space Grotesk'), ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"

export type GurukulLoaderProps = {
    /** Cover the viewport (default). Set false to fill a parent instead. */
    fullScreen?: boolean
    /** Optional caption under the wordmark, e.g. "Preparing your workspace". */
    label?: string
    /**
     * Render this raster instead of the inline mark.
     *
     * Kept for back-compat and currently unused by every call site. The default is the inline
     * `Logo`, which follows `currentColor` and so reads correctly on the loader's own surface in
     * either theme; a raster cannot, which is why it is no longer the default.
     */
    logoSrc?: string
    className?: string
}

const STYLES = `
.gkl-root { --gkl-dim: #F2D2BC; --gkl-mid: #8A4A2E; --gkl-hot: #C2410C; }
.dark .gkl-root { --gkl-dim: #5A2E1E; --gkl-mid: #E8B898; --gkl-hot: #FB923C; }
.gkl-brand { display: flex; align-items: center; gap: .85rem; margin-top: 2rem; }
.gkl-logo { width: 48px; height: 48px; border-radius: 14px; box-shadow: 0 8px 28px -8px rgba(194,65,12,0.45);
    animation: gkl-logo 2.4s cubic-bezier(.5,0,.2,1) infinite; }
@keyframes gkl-logo { 0%, 100% { transform: scale(.94); opacity: .6 } 45% { transform: scale(1); opacity: 1 } }
.gkl-word {
    font-family: ${FONT_STACK}; font-weight: 600; letter-spacing: -0.03em; line-height: 1;
    font-size: clamp(1.75rem, 4vw, 2.4rem); white-space: nowrap; user-select: none;
    -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; color: transparent;
    background-image: linear-gradient(115deg, var(--gkl-dim) 0%, var(--gkl-dim) 36%, var(--gkl-hot) 47%, var(--gkl-hot) 53%, var(--gkl-dim) 64%, var(--gkl-dim) 100%);
    background-size: 220% 100%; animation: gkl-sweep 2.4s cubic-bezier(.45,0,.15,1) infinite;
}
@keyframes gkl-sweep { 0% { background-position: 130% 0; } 100% { background-position: -130% 0; } }
.gkl-track { position: relative; width: 96px; height: 3px; margin-top: 1.25rem; border-radius: 999px; background: var(--gkl-dim); overflow: hidden; }
.gkl-track-fill { position: absolute; inset: 0; width: 34%; border-radius: 999px; background: var(--gkl-hot); animation: gkl-track 1.7s cubic-bezier(.5,0,.2,1) infinite; }
@keyframes gkl-track { 0% { transform: translateX(-100%); } 100% { transform: translateX(294%); } }
.gkl-cap { margin-top: 1rem; font-family: ${FONT_STACK}; font-size: 12px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--gkl-mid); }
@media (prefers-reduced-motion: reduce) {
    .gkl-logo, .gkl-word, .gkl-track-fill { animation: none !important; }
    .gkl-logo { transform: none !important; opacity: 1 !important; }
    .gkl-word { background-position: 50% 0 !important; }
}
`

export function GurukulLoader({ fullScreen = true, label, logoSrc, className = "" }: GurukulLoaderProps) {
    return (
        <SchoolScreen mode="arriving" fullScreen={fullScreen} className={`gkl-root ${className}`}>
            <style>{STYLES}</style>
            <div className="gkl-brand">
                {/* Inline SVG, not an <img src="...">: the mark takes `currentColor`, so it reads
                    on the tile in either theme. A raster brings its own colour and cannot. */}
                <span aria-hidden className="gkl-logo flex items-center justify-center bg-[linear-gradient(145deg,#E0682E_0%,#B5401A_100%)]">
                    {logoSrc
                        ? <img src={logoSrc} alt="" className="h-7 w-7 object-contain" />
                        : <Logo className="h-7 w-7 text-[#FFF1E4]" />}
                </span>
                <span className="gkl-word">Gurukul</span>
            </div>
            <div className="gkl-track"><div className="gkl-track-fill" /></div>
            {label ? <p className="gkl-cap">{label}</p> : null}
        </SchoolScreen>
    )
}

export default GurukulLoader
