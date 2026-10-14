/**
 * Enforces the house colour rule at authoring time.
 *
 * `CLAUDE.md` has banned these hues since before the audit, and by the time anyone counted there
 * were **1261** usages across 116 files in `apps/main` alone. Nobody added them in bad faith - a
 * rule that lives only in a markdown file is invisible at the moment you are typing `bg-red-500`,
 * and `red`/`green` are the obvious names for an error and a success state.
 *
 * So the rule is enforced where it is broken. Every one of those 1261 would have been caught here.
 *
 * ## Two tiers, on purpose
 *
 * - **error** for the visually jarring families (`blue`, `sky`, `cyan`, `indigo`, `violet`,
 *   `purple`, `fuchsia`). These were already at zero, and the job of this rule is to keep them
 *   there - a single blue icon in an emerald product is instantly visible.
 * - **warn** for the near-misses (`red`, `green`, `gray`, `slate`, `stone`, `pink`). These are the
 *   ones that actually accumulated, precisely because they look almost right. Warn rather than
 *   error so an in-progress branch is not blocked, but the count is visible in every lint run.
 *
 * ## What it deliberately does NOT catch
 *
 * Hex. `#3b82f6` is `bg-blue-500` by another name, and 17 files in `apps/main` were carrying banned
 * hues that way - invisible to any classname rule, because a hex literal in a `style` prop or a
 * recharts series is just a string. Use `apps/main/lib/entity-colors.ts` for those; there is no
 * lint rule that can tell an approved `#10b981` from a banned `#3b82f6` without a colour table, and
 * a table of approved constants is a better answer than a regex over every string in the codebase.
 */

const BANNED_HARD = ["blue", "sky", "cyan", "indigo", "violet", "purple", "fuchsia"];
const BANNED_SOFT = ["red", "green", "gray", "slate", "stone", "pink"];

const REPLACEMENT = {
    blue: "emerald or teal",
    sky: "teal",
    cyan: "teal",
    indigo: "emerald",
    violet: "rose",
    purple: "rose",
    fuchsia: "rose",
    red: "rose",
    green: "emerald",
    gray: "neutral",
    slate: "neutral",
    stone: "neutral",
    pink: "rose",
};

// Every Tailwind utility that can carry a colour. Matches through variant prefixes
// (`hover:`, `dark:`, `md:`, `group-hover:`) and Tailwind's opacity suffix (`/30`).
const UTIL =
    "(?:bg|text|border|from|to|via|ring|ring-offset|fill|stroke|divide|outline|decoration|shadow|accent|caret|placeholder)";

function selectorFor(hues) {
    // Deliberately plain: no `/`, no `{}`, no quote characters.
    //
    // ESLint parses `no-restricted-syntax` selectors with esquery, whose own parser terminates a
    // regex literal at the first `/` it sees - so a Tailwind opacity suffix written as `(\/\d+)?`
    // truncates the pattern mid-expression and ESLint dies with "Invalid regular expression" on
    // EVERY file it lints. `{2,3}` is the same class of hazard. Matching the bare token is enough:
    // `bg-red-400/30` contains `bg-red-400`, and `dark:hover:bg-red-400` contains it too, so
    // variants and opacity modifiers are covered without anchoring to either side.
    const pattern = `${UTIL}-(?:${hues.join("|")})-[0-9]+`;
    // Covers plain strings, template literals (so `cn()` and interpolated classes are caught), and
    // JSX className attributes.
    return [
        `Literal[value=/${pattern}/]`,
        `TemplateElement[value.raw=/${pattern}/]`,
    ];
}

function messageFor(hues, tier) {
    const list = hues.map((h) => `${h} -> ${REPLACEMENT[h]}`).join(", ");
    return `Banned Tailwind hue (${tier}). Approved: emerald, teal, amber, orange, rose, lime, plus neutral/zinc and the brand gold. Map: ${list}. For hex (inline style, recharts series, SVG fill) use lib/entity-colors.ts.`;
}

/**
 * The restriction entries on their own, so another config can splice them into ITS
 * `no-restricted-syntax` list.
 *
 * This export exists because of a real defect, not for tidiness. In ESLint flat config, two config
 * objects that both set the same rule do NOT merge their options - the later one **replaces** the
 * earlier one wholesale. `actionResultConfig` also sets `no-restricted-syntax`, and its `files`
 * glob (`actions/`-prefixed) overlaps this one's (all TS), so for the ~200 files under `actions/` the
 * action-result list won and **the palette rule was silently not running there at all**.
 *
 * That is exactly the class of bug this package exists to prevent: a rule that appears to be on and
 * is not. Any config that sets `no-restricted-syntax` over a subset of these files must spread
 * `PALETTE_RESTRICTIONS` into its own list.
 */
export const PALETTE_RESTRICTIONS = [
    ...selectorFor(BANNED_HARD).map((selector) => ({
        selector,
        message: messageFor(BANNED_HARD, "hard ban"),
    })),
    ...selectorFor(BANNED_SOFT).map((selector) => ({
        selector,
        message: messageFor(BANNED_SOFT, "off-palette"),
    })),
];

/** @type {import("eslint").Linter.Config[]} */
export const paletteConfig = [
    {
        files: ["**/*.{ts,tsx,js,jsx}"],
        rules: {
            "no-restricted-syntax": ["warn", ...PALETTE_RESTRICTIONS],
        },
    },
];
