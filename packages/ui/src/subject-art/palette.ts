/**
 * The colour families the artwork is allowed to use.
 *
 * The repo palette rule is absolute: **never blue, sky, cyan, indigo, violet, purple, fuchsia or
 * brown.** What is left is the brand gold, the cream, and `emerald / teal / amber / orange / rose /
 * lime`. That is enough to give twenty subjects distinct identities as long as the assignment is
 * deliberate rather than a rotation - Science reads as teal because life and water do, Nepali reads
 * as the deep orange of a Nepali flag, Mathematics keeps the brand gold because it is the spine
 * subject.
 *
 * Every family is a THREE stop set - `deep` for line work that must hold on a light ground, `mid`
 * for fills, `glow` for the wash behind them. Two stops was not enough: a wash light enough to sit
 * under white text was too light to be seen on the cream ground, so covers looked empty in light
 * mode and lurid in dark.
 */

export interface ArtPalette {
    /** Line work. Must stay legible on both grounds, so nothing lighter than a 500. */
    deep: string;
    /** Fills and accents. */
    mid: string;
    /** The wash behind everything. Used at low alpha. */
    glow: string;
}

export const PALETTES = {
    /** The brand gold. Reserved for the spine subjects and the neutral fallback. */
    gold: { deep: '#8a6720', mid: '#a87f1f', glow: '#c9a961' },
    amber: { deep: '#b45309', mid: '#d97706', glow: '#fbbf24' },
    orange: { deep: '#c2410c', mid: '#ea580c', glow: '#fb923c' },
    rose: { deep: '#be123c', mid: '#e11d48', glow: '#fb7185' },
    emerald: { deep: '#047857', mid: '#059669', glow: '#34d399' },
    teal: { deep: '#0f766e', mid: '#0d9488', glow: '#2dd4bf' },
    lime: { deep: '#4d7c0f', mid: '#65a30d', glow: '#a3e635' },
    /** Ink. For subjects whose material really is black on paper - language, literature. */
    ink: { deep: '#404040', mid: '#525252', glow: '#a3a3a3' },
} as const satisfies Record<string, ArtPalette>;

export type PaletteName = keyof typeof PALETTES;

export const CREAM = '#EDE8D0';
