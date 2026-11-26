import type { CSSProperties } from "react"

/*
 * Shared helpers for the landing page pixel art (ported from Boli's @repo/brand/art).
 */

/** Inline style that may also carry CSS custom properties (`--art-delay`, `--d`, ...). */
export type ArtStyle = CSSProperties & { [key: `--${string}`]: string | number | undefined }

/** A stable id usable inside `url(#...)` (React ids carry characters that are awkward in SVG references). */
export function svgId(raw: string, suffix: string): string {
    return `art-${raw.replace(/[^a-zA-Z0-9_-]/g, "")}-${suffix}`
}
