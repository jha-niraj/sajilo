/**
 * Checks for the subject-art registry. Run: `pnpm --filter @repo/ui check:art`
 *
 * The thing that breaks here is ORDER. "Optional Mathematics" contains "math", "Computer Science"
 * contains "science", and "Social Studies" contains nothing else - so a rule moved a few lines down
 * silently starts matching the wrong drawing, and nothing fails except that a school's Optional
 * Maths cover quietly becomes the Maths one. Every swallowing pair is asserted below.
 */
import { resolveSubjectArt, normaliseSubject, fallbackPalette } from './registry';
import { MOTIFS } from './motifs';
import { PALETTES } from './palette';

let pass = 0;
let fail = 0;
function eq(name: string, got: unknown, want: unknown): void {
    const g = JSON.stringify(got); const w = JSON.stringify(want);
    if (g === w) { pass += 1; console.log(`  ok   ${name}`); }
    else { fail += 1; console.log(`  FAIL ${name}\n         got  ${g}\n         want ${w}`); }
}
const keyOf = (n: string) => resolveSubjectArt(n).key;

console.log('\n1. Specific beats general - the order that keeps breaking');
{
    eq('Optional Mathematics is not Mathematics', keyOf('Optional Mathematics'), 'optionalMathematics');
    eq('Additional Mathematics too', keyOf('Additional Mathematics'), 'optionalMathematics');
    eq('but plain Mathematics is', keyOf('Mathematics'), 'mathematics');
    eq('Computer Science is not Science', keyOf('Computer Science'), 'computerScience');
    eq('but plain Science is', keyOf('Science'), 'science');
    eq('Social Studies is not Science', keyOf('Social Studies'), 'socialStudies');
    eq('Social Science is not Science either', keyOf('Social Science'), 'socialStudies');
    eq('Environmental Science is Environment', keyOf('Environmental Science'), 'environment');
    eq('Health and Physical Education', keyOf('Health & Physical Education'), 'health');
    eq('Business Studies is not Social Studies', keyOf('Business Studies'), 'business');
}

console.log('\n2. The names a school actually types');
{
    eq('Maths', keyOf('Maths'), 'mathematics');
    eq('Math', keyOf('Math'), 'mathematics');
    eq('Compulsory Mathematics', keyOf('Compulsory Mathematics'), 'mathematics');
    eq('Mathematics (Compulsory)', keyOf('Mathematics (Compulsory)'), 'mathematics');
    eq('Opt. Maths', keyOf('Opt. Maths'), 'optionalMathematics');
    eq('C.Maths trailing spaces', keyOf('  Mathematics  '), 'mathematics');
    eq('ALL CAPS', keyOf('ENGLISH'), 'english');
    eq('Nepali', keyOf('Nepali'), 'nepali');
    eq('ICT', keyOf('ICT'), 'computerScience');
    eq('Accountancy', keyOf('Accountancy'), 'accounts');
    eq('Economics', keyOf('Economics'), 'accounts');
    eq('Moral Education', keyOf('Moral Education'), 'moral');
}

console.log('\n3. Devanagari, where a school types in Nepali');
{
    eq('गणित', keyOf('गणित'), 'mathematics');
    eq('अतिरिक्त गणित beats गणित', keyOf('अतिरिक्त गणित'), 'optionalMathematics');
    eq('विज्ञान', keyOf('विज्ञान'), 'science');
    eq('सामाजिक अध्ययन', keyOf('सामाजिक अध्ययन'), 'socialStudies');
    eq('नेपाली', keyOf('नेपाली'), 'nepali');
    eq('अंग्रेजी', keyOf('अंग्रेजी'), 'english');
    eq('कम्प्युटर', keyOf('कम्प्युटर'), 'computerScience');
    // The conjunct must survive normalisation - stripping combining marks is the bug that made
    // the distress screen silently useless.
    eq('a conjunct is not split', normaliseSubject('विज्ञान'), 'विज्ञान');
    eq('and keeps its length', normaliseSubject('स्वास्थ्य').length, 'स्वास्थ्य'.length);
}

console.log('\n4. The everyday tools share the system');
{
    eq('Typing', keyOf('Typing'), 'typing');
    eq('Read Aloud', keyOf('Read Aloud'), 'reading');
    eq('My Words', keyOf('My Words'), 'words');
    eq('Doubt Box', keyOf('Doubt Box'), 'doubt');
    eq('Daily Set', keyOf('Daily Set'), 'daily');
    eq('Practice Hub', keyOf('Practice Hub'), 'practice');
    eq('Leaderboard', keyOf('Leaderboard'), 'leaderboard');
}

console.log('\n5. Nothing ever renders nothing');
{
    // "Hotel Management" is deliberately NOT here: it matches the business rule on "management",
    // which is right - it is a business subject. A fallback case has to be genuinely unmatched.
    eq('an unknown subject still gets a drawing', keyOf('Astronomy Club'), 'generic');
    eq('and Hotel Management correctly reads as business', keyOf('Hotel Management'), 'business');
    eq('an empty name still gets a drawing', keyOf(''), 'generic');
    eq('whitespace only', keyOf('   '), 'generic');
    eq('punctuation only', keyOf('---'), 'generic');
    eq('every key in the registry exists as a motif',
        (['Mathematics', 'Science', 'Typing', 'Astronomy Club'] as const).every((n) => keyOf(n) in MOTIFS), true);
    eq('every palette named by a rule exists',
        (['Mathematics', 'Science', 'English', 'Nepali', 'Social Studies'] as const)
            .every((n) => resolveSubjectArt(n).palette in PALETTES), true);
}

console.log('\n6. Unknown subjects do not all come out the same colour');
{
    eq('fallback is deterministic', fallbackPalette('Astronomy Club'), fallbackPalette('Astronomy Club'));
    const spread = new Set(['Astronomy Club', 'Agriculture', 'Tourism', 'Law', 'Journalism', 'Debate'].map(fallbackPalette));
    eq('six unknown subjects use more than one palette', spread.size > 1, true);
    eq('every fallback palette is a real one',
        [...spread].every((p) => p in PALETTES), true);
}

console.log('\n6b. A real class grid does not repeat a colour side by side');
{
    // The eight subjects of a Nepali secondary class, alphabetically - which is the order they
    // actually arrive in. Adjacent duplicates are what made the first draft look like a bug.
    const GRID = ['Computer Science', 'English', 'Health & Physical Education', 'Mathematics',
        'Nepali', 'Optional Mathematics', 'Science', 'Social Studies'];
    const cols = GRID.map((n) => resolveSubjectArt(n).palette);
    const adjacent = cols.filter((c, i) => i > 0 && cols[i - 1] === c);
    eq('no two neighbours share a palette', adjacent, []);
    // Three across on desktop, so the card directly above matters too.
    const above = cols.filter((c, i) => i >= 3 && cols[i - 3] === c);
    eq('no card repeats the one above it in a 3-wide grid', above, []);
    eq('the grid uses at least five distinct palettes', new Set(cols).size >= 5, true);
    eq('every drawing in the grid is distinct', new Set(GRID.map(keyOf)).size, GRID.length);
}

console.log('\n7. The palette rule - no banned hue can enter through here');
{
    // The repo rule is absolute. Asserting it on the actual hex values means a well-meaning
    // "let us make Science blue" cannot land quietly.
    const BANNED = /#(3b82f6|60a5fa|2563eb|0ea5e9|06b6d4|6366f1|8b5cf6|a855f7|d946ef)/i;
    const all = Object.values(PALETTES).flatMap((p) => [p.deep, p.mid, p.glow]);
    eq('no known banned hex', all.some((c) => BANNED.test(c)), false);
    eq('every stop is a 6 digit hex', all.every((c) => /^#[0-9a-f]{6}$/i.test(c)), true);
    eq('every palette has three stops', Object.values(PALETTES).every((p) => p.deep && p.mid && p.glow), true);
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
