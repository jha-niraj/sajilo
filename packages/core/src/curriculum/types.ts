// Shared curriculum TOC types used by the admin app (authoring), the main app
// (school authoring + adoption) and the worker (chunk mapping). Keep this module
// framework-agnostic and dependency-free so it bundles cleanly into a Cloudflare
// Worker as well as Next.js server actions.

/** A lesson (sub-topic) parsed from a pasted / AI / photo table of contents. */
export type ParsedTocLesson = {
    lessonNumber: string;
    title: string;
    /** Optional 1-based page. Lessons usually print only a start page. */
    startPage?: number | null;
    endPage?: number | null;
};

/** A unit (chapter) parsed from a table of contents, with its lessons. */
export type ParsedTocUnit = {
    unitNumber: string;
    title: string;
    /** Optional 1-based inclusive page range. Both set, or both null. */
    startPage?: number | null;
    endPage?: number | null;
    lessons: ParsedTocLesson[];
};
