/**
 * The school's name for a subject, and the CDC's name for the same book.
 *
 * ## Why this exists
 *
 * Curriculum retrieval filters Vectorize on `subject` by EXACT string equality
 * (`apps/main/actions/ai/curriculum.action.ts`). The subject in the query is whatever the SCHOOL
 * called it when it set up its timetable; the subject on the document is whatever the CDC called
 * the book. Those are different strings almost every time:
 *
 *   school "Science"                     CDC "Science and Technology"
 *   school "Compulsory Mathematics"      CDC "Mathematics"
 *   school "Social Studies & Population" CDC "Social Studies"
 *
 * Uploaded the Class 10 Science and Technology textbook against a school that calls the subject
 * "Science" and NOTHING matches: the plan generator asks for `subject: "Science"`, Vectorize holds
 * `subject: "Science and Technology"`, zero chunks come back, and every plan is labelled "Not from
 * your book" while the book sits in the library. The failure is silent, which is the worst part -
 * a school would conclude the feature does not work.
 *
 * A school will not rename its subjects to match a government catalogue, and the catalogue will not
 * rename its books. So the join is a small explicit table of the names the same subject is known by
 * in Nepal, and retrieval asks for ALL of them.
 *
 * ## Why a table and not fuzzy matching
 *
 * "Optional Mathematics" and "Mathematics" share a word and are DIFFERENT subjects with different
 * books; a substring or similarity match would ground an Opt Maths plan in the compulsory book and
 * never say so. Each group below is a deliberate statement that these names mean one subject.
 * Anything not in the table falls through as itself, so an unknown subject behaves exactly as it
 * does today rather than matching something at random.
 */

const norm = (s: string): string => s.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[.]/g, '');

/** Each group is one subject, under every name a Nepali school or the CDC uses for it. */
const GROUPS: readonly (readonly string[])[] = [
    ['science', 'science and technology', 'science & technology', 'science and environment', 'science & environment', 'compulsory science'],
    ['mathematics', 'maths', 'math', 'compulsory mathematics', 'compulsory maths'],
    // Deliberately its OWN group: Optional Maths is a different subject with a different book.
    ['optional mathematics', 'optional maths', 'opt. mathematics', 'opt maths', 'additional mathematics'],
    ['english', 'compulsory english'],
    ['nepali', 'compulsory nepali'],
    ['social studies', 'social studies & population', 'social studies and population', 'social studies and population education', 'social'],
    ['computer science', 'computer', 'computer studies', 'information technology'],
    ['health, population and environment', 'health population and environment', 'hpe', 'health and physical education'],
    ['account', 'accountancy', 'accounting'],
    ['economics'],
];

// Keyed on the NORMALISED name, because that is what every lookup passes. Keying on the raw
// string meant "opt. mathematics" in the table never matched the "opt mathematics" a lookup
// produced after stripping the full stop - the entry was there and unreachable.
const BY_NAME = new Map<string, readonly string[]>();
for (const group of GROUPS) for (const name of group) BY_NAME.set(norm(name), group);

/**
 * Every name this subject is known by, the given one first.
 *
 * The caller hands the result to a Vectorize `$in` filter, so the ORDER is cosmetic and the
 * membership is what matters. An unknown subject returns just itself - never a guess.
 */
export function subjectAliases(subject: string): string[] {
    const key = norm(subject);
    const group = BY_NAME.get(key);
    if (!group) return [subject];

    // The stored metadata is the name as it was typed at upload, in its original casing, so the
    // filter needs the natural-case forms rather than the lowercase keys. Title-casing each alias
    // covers "Science and Technology"; the caller's own string is kept verbatim as well because it
    // is the one spelling we know exists.
    const titled = group.map(titleCase);
    return [subject, ...titled.filter((t) => t !== subject)];
}

/** True when two subject names mean the same subject. */
export function isSameSubject(a: string, b: string): boolean {
    const ka = norm(a), kb = norm(b);
    if (ka === kb) return true;
    const ga = BY_NAME.get(ka);
    return !!ga && ga === BY_NAME.get(kb);
}

/** "science and technology" -> "Science and Technology". Small words stay lower, as titles do. */
function titleCase(s: string): string {
    const small = new Set(['and', 'of', 'the', '&']);
    return s.split(' ').map((w, i) => (i > 0 && small.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1))).join(' ');
}
