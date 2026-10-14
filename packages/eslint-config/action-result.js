/**
 * Enforces the `@repo/errors` contract on server actions.
 *
 * ## What it tests, and why that matters more than it sounds
 *
 * The exploration's own scan for this drifted badly by testing the wrong thing. It ran:
 *
 *     find actions -name '*.ts' -exec grep -L 'ActionResult' {} \; | xargs grep -l 'use server'
 *
 * That looks for the literal **type name** `ActionResult` - and reported **124 of 199 files
 * non-compliant**. The real number was **22**. A file that does `return ok(data)` /
 * `catch (e) { return fail(e) }` with an inferred return type is completely correct and never
 * mentions the type. Two of the four files it named "top priority" were already done.
 *
 * A rule written that way would flag ~120 correct files on day one and be disabled by the end of
 * the week. So this rule tests for the thing that is actually required: **a hand-rolled result
 * literal**, which is what the contract forbids:
 *
 *     Never hand-roll `{ success: false, error: '...' }` or a bare `throw new Error()`.
 *
 * ## The two things it catches
 *
 * 1. **`{ success: true/false, ... }` object literals** - build them with `ok()` / `fail()` /
 *    `failWith()` instead. Those populate `kind` and `retryable`, which is the entire reason the
 *    package exists: without them the client cannot tell a Neon cold start from "not allowed", so
 *    it shows "something went wrong" where it should have shown "reconnecting" with a retry.
 *
 * 2. **`throw new Error(...)`** inside a file marked `'use server'`. A bare throw reaches the
 *    client as an opaque digest with the message erased. Deliberate domain failures should throw
 *    `errForbidden()` / `errNotFound()` / `errValidation()` from `@repo/errors`, which classify.
 *
 * ## Scope
 *
 * `files` is narrowed to `actions/**` so the rule only applies where server actions live. Warn
 * rather than error, matching the palette rule - a lint rule that blocks an in-progress branch gets
 * switched off, and the count is visible in every run either way.
 */

import { PALETTE_RESTRICTIONS } from "./palette.js";

/** @type {import("eslint").Linter.Config[]} */
export const actionResultConfig = [
    {
        files: ["actions/**/*.ts", "actions/**/*.tsx", "**/actions/**/*.ts", "**/actions/**/*.tsx"],
        rules: {
            "no-restricted-syntax": [
                "warn",
                // Spread in, not inherited. ESLint flat config REPLACES a rule's options when a
                // later config object sets the same rule - it does not merge them. This object's
                // `files` glob is a subset of paletteConfig's `**/*.ts`, so without this line the
                // palette rule stopped applying to every file under `actions/` the moment both
                // configs were enabled together. It was off there in apps/main and apps/web and
                // nothing said so. See the note on PALETTE_RESTRICTIONS in palette.js.
                ...PALETTE_RESTRICTIONS,
                {
                    // `{ success: true, ... }` / `{ success: false, ... }` - a hand-rolled result.
                    //
                    // Four selectors, not two: `{ success: false as const }` is the dominant form in
                    // this codebase, and `as const` wraps the literal in a TSAsExpression - so a
                    // selector matching `value.type='Literal'` silently misses every one of them.
                    // The probe caught that: the bare-throw rule fired and this one did not.
                    //
                    // Matching the boolean literal (rather than any value) means a pass-through of
                    // someone else's result, `{ success: res.ok }`, is correctly not flagged.
                    //
                    // Scoped to a DESCENDANT OF `return`, which matters more than it looks. A first
                    // version matched any `{ success: ... }` object and flagged six lines like:
                    //
                    //     results.push({ studentId, name, success: false, message: '...' })
                    //
                    // That is a per-student row inside a results array - a legitimate domain shape
                    // answering "did THIS student promote", not an action's return value. Rewriting
                    // it as `ok()`/`fail()` would be actively wrong. Anchoring on `return` keeps the
                    // rule to what the contract is actually about, and still catches conditional and
                    // wrapped returns that a direct-child selector would miss.
                    // Scoped further to an EXPORTED function. The contract is about what an ACTION
                    // returns, and an action is by definition exported - a private helper returning
                    // its own domain record is not in scope. That distinction removed four more
                    // false positives on `sendWhatsAppMessage`, an internal helper returning a
                    // per-recipient `{ phone, success, messageSid }`. Rewriting that as ok()/fail()
                    // would have destroyed a real domain shape to satisfy a lint rule.
                    selector: [true, false].flatMap((v) => [
                        `ExportNamedDeclaration ReturnStatement ObjectExpression > Property[key.name='success'][value.type='Literal'][value.value=${v}]`,
                        `ExportNamedDeclaration ReturnStatement ObjectExpression > Property[key.name='success'] > TSAsExpression > Literal[value=${v}]`,
                    ]).join(","),
                    message:
                        "Hand-rolled result literal. Use ok(data) / fail(e) / failWith(kind, message) from " +
                        "@repo/errors so the result carries `kind` and `retryable` - without them the client " +
                        "cannot distinguish a transient DB failure from a domain error, and shows a permanent-" +
                        "sounding message where a retry belongs.",
                },
                {
                    // A bare throw in a server action reaches the client as an opaque digest.
                    selector: "ThrowStatement > NewExpression[callee.name='Error']",
                    message:
                        "Bare `throw new Error()` in a server action - the message is erased and the client " +
                        "gets an opaque digest. Use errForbidden() / errNotFound() / errValidation() from " +
                        "@repo/errors for deliberate failures (they classify), or return failWith(kind, message).",
                },
            ],
        },
    },
];
