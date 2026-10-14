/**
 * Enforces the house colour rule in an app where colour is **hex**, not class names.
 *
 * ## Why the classname rule is not enough here
 *
 * `palette.js` greps Tailwind utilities (`bg-red-500`). That is the right rule for the web apps,
 * where nearly all colour is a class. It is close to useless in `apps/gurukul-app`: React Native
 * passes colour to `style` props as hex strings, so a scan of the whole app found
 *
 *     4 banned Tailwind classes   vs   ~215 real hex colour sites
 *
 * A rule that catches 2% of the problem is worse than no rule, because it reports green.
 *
 * ## What this rule says instead
 *
 * **Colour lives in `lib/colors.ts`. Screens import it.** Any 6-digit hex literal in `app/`,
 * `components/` or `hooks/` is a colour that has escaped the token file.
 *
 * That single statement covers every finding in `srs/exploration1.1/gurukul-app/02-palette-and-tokens.md`:
 *
 * - **210 inline `const ink = '#0a0a0a'` declarations across 23 files.** All are verbatim copies of
 *   tokens that already exist, and all agree with them **today**. That is the trap: nothing looks
 *   wrong, and the moment anyone edits a value in `lib/colors.ts`, 23 screens silently keep the old
 *   one. This rule is what makes that impossible rather than merely unlikely.
 * - **Three different brand oranges** - `C.brand` `#f25d1f`, `SplashLoader` `#d9692a`, `welcome`
 *   `#c25a20` - on the first three frames a user ever sees. Three internally-consistent files, which
 *   is why no diff review caught it.
 *
 * ## What it deliberately does NOT touch
 *
 * **`lib/` is out of scope entirely**, which is how `lib/colors.ts` stays legal. That file is the
 * one place a hex belongs, and it includes two exemptions that are correct and must survive:
 *
 *     khalti: '#5C2D91',   // a violet
 *     dodo:   '#6366f1',   // indigo-500
 *
 * Those are third-party payment brands. Recolouring a provider's mark on its own pay button
 * misrepresents the provider, which matters more than palette purity - the token file says so in a
 * comment and it is right. A rule that flagged them would be switched off within a week, so the
 * scope is drawn to leave them alone rather than to allow-list them one by one.
 *
 * Warn, not error, matching the other two house rules: a rule that blocks an in-progress branch
 * gets disabled, and the count is visible in every run either way.
 */

import { PALETTE_RESTRICTIONS } from "./palette.js";

// Written out rather than `{6}` on purpose. ESLint parses `no-restricted-syntax` selectors with
// esquery, whose regex parser chokes on brace quantifiers and terminates a pattern at the first
// `/` - the same hazard documented in palette.js, where a `(\/\d+)?` opacity suffix killed lint on
// EVERY file. Six explicit classes are ugly and they work.
const HEX6 = "#[0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F]";

const MESSAGE =
    "Hex colour outside lib/colors.ts. Import the token instead - `import { C } from '@/lib/colors'` " +
    "then `C.ink`, `C.brand`, `C.ok`. 23 screens currently re-declare ~210 of these by hand; they " +
    "agree with the tokens today, so the first edit to lib/colors.ts silently splits the app in two. " +
    "If the colour genuinely does not exist yet, add it to lib/colors.ts and import it from there.";

/**
 * Hex-literal palette enforcement for the React Native app.
 *
 * @type {import("eslint").Linter.Config[]}
 */
export const hexPaletteConfig = [
    {
        // `lib/**` is absent on purpose - see the note above. So is any config file: a Tailwind
        // theme extension is a design token declaration, not a screen hard-coding a colour.
        files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}", "hooks/**/*.{ts,tsx}"],
        rules: {
            "no-restricted-syntax": [
                "warn",
                // Spread in for the same reason actionResultConfig does it: flat config REPLACES a
                // rule's options rather than merging them, and this glob is a subset of
                // paletteConfig's `**/*.ts`. Without this line, enabling the hex rule would turn
                // the classname rule OFF across every screen - trading 4 caught violations for
                // 210, which is a real trade but not one to make silently.
                ...PALETTE_RESTRICTIONS,
                { selector: `Literal[value=/${HEX6}/]`, message: MESSAGE },
                { selector: `TemplateElement[value.raw=/${HEX6}/]`, message: MESSAGE },
            ],
        },
    },
];
