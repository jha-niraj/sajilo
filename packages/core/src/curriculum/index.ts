// @repo/core/curriculum - shared, framework-agnostic curriculum TOC logic used by
// the admin app (authoring), the main app (school authoring + adoption) and the
// worker (chunk mapping). No DB, no network, no framework imports.

export type { ParsedTocLesson, ParsedTocUnit } from './types';
export {
    isValidTocPageRange,
    validateTocPageRange,
    normalizeLessonPages,
    toPageInt,
} from './pages';
export { parseTocText, normalizeAiToc } from './parse';
export {
    TOC_AI_SYSTEM_PROMPT,
    TOC_AI_GENERATE_SYSTEM_PROMPT,
    MAX_TOC_IMAGE_CHARS,
} from './prompts';
export type { MappableLesson, MappableUnit, PageAssignment, PageMatchSource } from './mapping';
export { mapPagesToUnits } from './mapping';
