/**
 * The twenty lines that make Devanagari draw at all.
 *
 * ## The failure this fixes
 *
 * Embedding Noto Sans Devanagari and then drawing "पाठ योजना" threw, from inside fontkit:
 *
 *     ReferenceError: regeneratorRuntime is not defined
 *       at StateMachine.match (@pdf-lib/fontkit/dist/fontkit.umd.js:35623)
 *       at setupSyllables  -> ShapingPlan.process -> OTLayoutEngine.substitute
 *       at CustomFontSubsetEmbedder.encodeText
 *
 * `@pdf-lib/fontkit@1.1.1` was transpiled by Babel with `@babel/plugin-transform-regenerator` and
 * ships expecting `regeneratorRuntime` as a GLOBAL that it never bundles and never declares as a
 * dependency. In a browser with a core-js polyfill loaded that global happens to be there. In Node
 * and in a Cloudflare Worker it is not, so the call is a bare reference to an undefined name.
 *
 * It is used in exactly one place, `StateMachine.match`, and that place is the syllable state
 * machine for Indic and Universal Shaping Engine scripts. Latin never reaches it. Devanagari
 * reaches it on the first character. So the font embeds cleanly, `loadFonts` shape-probes it, the
 * probe throws, and the whole thing falls back to Helvetica - which is why a correctly configured
 * Noto still printed "???". Two separate bugs wearing each other's clothes: the font URLs were
 * never set anywhere (see wrangler.jsonc), and even once set the font could not shape.
 *
 * ## Why a local shim rather than the `regenerator-runtime` package
 *
 * `regenerator-runtime` is a general implementation of the whole protocol - try/catch frames,
 * delegation, async, `sent`. The one generator fontkit needs it for uses none of that. Its body
 * is a plain `while (1) switch (_context.prev = _context.next)` with two `return` yields and a
 * `_context.stop()`, and the shim below is that protocol and nothing else. Adding a dependency
 * for it would also mean a lockfile change in a repo where other work is in flight.
 *
 * ## What would break this
 *
 * A fontkit upgrade whose generated code uses a context method this does not implement. That is
 * why `wrap` builds the context from an explicit object rather than a `Proxy`: a missing method is
 * then a loud `TypeError` naming the method, at the shape probe in `loadFonts`, which falls back
 * safely. A silent wrong answer here would be a mis-shaped word on a signed document.
 *
 * `@pdf-lib/fontkit` is a pinned fork that has not been published since 2020, so this is a fixed
 * target rather than an ongoing bet.
 */

/** The context object the Babel-generated function drives itself with. */
interface RegeneratorContext {
    /** The label currently executing. Written by the generated code, read by nothing here. */
    prev: number | string;
    /** The label to resume at. The generated code sets this before every yield. */
    next: number | string;
    /** Called at the "end" label. Marks the generator finished. */
    stop(): undefined;
}

type GeneratedBody<T> = (context: RegeneratorContext) => T | undefined;

/**
 * The subset of the regenerator API `@pdf-lib/fontkit` actually calls.
 *
 * `mark` hands the generator function back unchanged: fontkit only ever assigns the result to
 * `[Symbol.iterator]` and calls it, and the prototype plumbing real regenerator does there buys
 * nothing when the result is immediately iterated.
 */
interface RegeneratorRuntimeShim {
    mark<F>(fn: F): F;
    wrap<T>(body: GeneratedBody<T>): IterableIterator<T>;
}

function wrap<T>(body: GeneratedBody<T>): IterableIterator<T> {
    let finished = false;
    const context: RegeneratorContext = {
        prev: 0,
        next: 0,
        stop() {
            finished = true;
            return undefined;
        },
    };

    const iterator: IterableIterator<T> = {
        next(): IteratorResult<T> {
            if (finished) return { value: undefined, done: true };
            // One turn of the generated `while (1) switch (...)` loop. It either returns a yielded
            // value, having already set `context.next` to the resume label, or it reaches the end
            // label and calls `stop()`.
            const value = body(context);
            if (finished) return { value: undefined, done: true };
            return { value: value as T, done: false };
        },
        return(value?: T): IteratorResult<T> {
            finished = true;
            return { value: value as T, done: true };
        },
        throw(err?: unknown): IteratorResult<T> {
            finished = true;
            throw err;
        },
        [Symbol.iterator]() { return this; },
    };
    return iterator;
}

/**
 * Define the global, once, and only if nothing else already has.
 *
 * Deferring to an existing `regeneratorRuntime` matters: `apps/main` and `apps/services` are
 * bundled by different toolchains, and if one of them ever pulls in the real runtime, the complete
 * implementation should win over this deliberate subset.
 */
const globals = globalThis as typeof globalThis & { regeneratorRuntime?: RegeneratorRuntimeShim };
if (!globals.regeneratorRuntime) {
    globals.regeneratorRuntime = { mark: (fn) => fn, wrap };
}
