/**
 * Generated subject artwork, shared across every app.
 *
 * ```tsx
 * import { SubjectArt } from '@repo/ui/subject-art';
 * <SubjectArt name="Optional Mathematics" className="h-full w-full" />
 * ```
 *
 * The drawing and the colour are resolved from the subject NAME (see `registry.ts`), so a school
 * that invents a subject next year still gets a real cover rather than a grey box. Pass `artKey` to
 * force one - that is how the everyday tools (typing, reading, doubt, words) use the same system
 * without pretending to be subjects.
 */
export { SubjectArt, SubjectMark, type SubjectArtProps } from './subject-art';
export { MOTIFS, type ArtKey } from './motifs';
export { PALETTES, CREAM, type ArtPalette, type PaletteName } from './palette';
export {
    resolveSubjectArt, normaliseSubject, fallbackPalette, type SubjectArt as SubjectArtSpec,
} from './registry';
