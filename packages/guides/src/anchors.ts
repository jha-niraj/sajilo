/**
 * ANCHORS AND THE SEARCH INDEX.
 *
 * Two apps need to agree on one thing here: the `id` that `apps/web` stamps on a step, and the
 * `#fragment` that `apps/main`'s help sheet links to. If those are computed in two places they
 * will drift, and the failure is silent - the link still opens the right guide, it just lands at
 * the top instead of the step, and nobody files that bug. So the scheme lives here and both sides
 * call the same function.
 */

import { GUIDES, type GuideSection, type GuideSlug, type GuideStep } from './guides'

/**
 * Title -> URL fragment. Deliberately NOT index-based: `#step-3` breaks the moment a step is
 * inserted above it, and an old link that silently points at the wrong step is worse than one that
 * fails. A title slug survives reordering and only breaks on a rewrite, which is a change somebody
 * is already looking at.
 */
export function slugifyAnchor(title: string): string {
    return title
        .toLowerCase()
        .replace(/['’]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60)
}

/** A section with its id, and its steps with theirs. */
export interface AnchoredSection {
    section: GuideSection
    id: string
    steps: { step: GuideStep; id: string }[]
}

/**
 * Zips sections together with the ids they render under.
 *
 * Returned zipped rather than as arrays parallel to `sections`, because the repo compiles with
 * `noUncheckedIndexedAccess`: parallel arrays would make every consumer write `ids[i] ?? ''`, and
 * an empty-string fallback is exactly the silent broken anchor this file exists to prevent. Here
 * every element carries its own id and there is nothing to index.
 *
 * Ids are unique WITHIN a guide. That dedupe matters more than it looks - several guides open a
 * walkthrough and a pitfalls section with related wording, and two elements sharing an id makes the
 * browser jump to whichever comes first. The `-2` suffix goes to the later occurrence, so the first
 * keeps the clean id and any existing link to it stays correct.
 */
export function anchoredSections(sections: GuideSection[]): AnchoredSection[] {
    const seen = new Map<string, number>()
    const unique = (raw: string, fallback: string) => {
        const base = slugifyAnchor(raw) || fallback
        const n = (seen.get(base) ?? 0) + 1
        seen.set(base, n)
        return n === 1 ? base : `${base}-${n}`
    }

    return sections.map((section, i) => ({
        section,
        id: unique(section.title, `section-${i + 1}`),
        steps: (section.steps ?? []).map((step, j) => ({
            step,
            id: unique(step.title, `step-${i + 1}-${j + 1}`),
        })),
    }))
}

/**
 * One searchable thing. A guide is one entry and each of its steps is another, because the whole
 * point of searching help from inside the product is that you are stuck on one screen: "where do I
 * set the grading scale" should land on that step, not on the front of a 20-step guide.
 */
export interface GuideSearchEntry {
    kind: 'guide' | 'step'
    guideSlug: GuideSlug
    guideTitle: string
    /** What to show as the result. For a guide, its title; for a step, the step's title. */
    title: string
    /** Sub-line: the guide's summary, or for a step the section it sits in. */
    context: string
    /** Path on the marketing origin, fragment included. Prefix with the origin to open it. */
    path: string
    /** Extra terms to match on, beyond the title. */
    keywords: string[]
}

/**
 * The slug as plain words - "daily-attendance" -> "daily attendance".
 *
 * This is not padding. SIX of the eleven guide titles do not contain their own module word, because
 * they are written editorially for the marketing page: the attendance guide is called "Getting
 * every class marked before first period ends". That reads well and is useless to somebody who
 * types "attendance", which is exactly what a person searching help from inside the attendance
 * screen types. Without this, searching a module name ranked an unrelated guide first.
 */
function moduleWords(slug: GuideSlug): string {
    return slug.replace(/-/g, ' ')
}

/**
 * The flat index, guide entry first then its steps, in reading order.
 *
 * Built once at module scope rather than per render: it is derived from static data, so rebuilding
 * it on every keystroke would be pure waste.
 */
export const GUIDE_SEARCH_INDEX: GuideSearchEntry[] = GUIDES.flatMap((guide) => {
    const entries: GuideSearchEntry[] = [
        {
            kind: 'guide',
            guideSlug: guide.slug,
            guideTitle: guide.title,
            title: guide.title,
            context: guide.summary,
            path: `/guides/${guide.slug}`,
            // The audience and the outcomes are how people actually describe what they want -
            // "fee receipt", "report card" - far more than the guide's own title does.
            keywords: [moduleWords(guide.slug), guide.audience, ...guide.after, guide.summary, guide.keywords],
        },
    ]
    for (const { section, steps } of anchoredSections(guide.sections)) {
        for (const { step, id } of steps) {
            entries.push({
                kind: 'step',
                guideSlug: guide.slug,
                guideTitle: guide.title,
                title: step.title,
                context: section.title,
                path: `/guides/${guide.slug}#${id}`,
                keywords: [moduleWords(guide.slug), section.title, step.outcome ?? '', guide.title].filter(Boolean),
            })
        }
    }
    return entries
})
