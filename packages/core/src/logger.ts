/**
 * Minimal leveled logger. `apps/web` keeps its own copy with the same contract and env var.
 *
 * It lives in `@repo/core` because it has ZERO dependencies - only `process.env` - which is the
 * one bar this package holds itself to. `@repo/email` needs it, and both apps/main and
 * gurukul-services need that, so a third hand-rolled copy was the alternative.
 *
 * `apps/main` had 24 `console.log` calls in three distinct categories, which is why deleting them
 * all would have been wrong:
 *
 * 1. **`lib/email.ts` (13)** - one per email type, each printing the Resend message id. That id is
 *    how you answer "did the parent invite actually go out". Worth keeping. -> `info`
 * 2. **Payment verification (5)** - Khalti/eSewa verification lines in `subscription.action.ts`,
 *    `credits.action.ts` and `donation.action.ts`, recording paymentId, amount and gateway
 *    reference at the moment money is confirmed. This is the closest thing to an audit trail when a
 *    school disputes a charge. Definitely worth keeping. -> `info`
 * 3. **Speech-to-text timing (6 in `use-voice-recorder.ts`, 1 in `api/transcribe`)** - millisecond
 *    timings from an optimisation session. Genuine debug leftovers. -> `debug`, so they are off
 *    everywhere by default but can be switched back on without a redeploy.
 *
 * The problem was never that the information is useless. It is that `console.log` has no level: on
 * Cloudflare Workers every one of those lines is an ingested, chargeable log line, and turning them
 * down meant editing and redeploying code.
 *
 * So: same information, behind a level that can be changed with an env var.
 *
 * `LOG_LEVEL` is one of `debug` | `info` | `warn` | `error` | `silent`. Anything below the
 * configured level is dropped. Default is `info` in development and `warn` in production, which
 * means the per-email success lines stop shipping by default while every genuine failure still
 * does - `console.error` was never the noisy part.
 *
 * Deliberately not a dependency: a logging library on a marketing site's Worker bundle costs more
 * than it returns, and this is the entire feature.
 */

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 } as const

export type LogLevel = keyof typeof LEVELS

function resolveLevel(): number {
    const configured = process.env.LOG_LEVEL as LogLevel | undefined
    if (configured && configured in LEVELS) return LEVELS[configured]
    return process.env.NODE_ENV === 'production' ? LEVELS.warn : LEVELS.info
}

const threshold = resolveLevel()

export const logger = {
    debug(...args: unknown[]) {
        if (threshold <= LEVELS.debug) console.debug(...args)
    },
    info(...args: unknown[]) {
        if (threshold <= LEVELS.info) console.info(...args)
    },
    warn(...args: unknown[]) {
        if (threshold <= LEVELS.warn) console.warn(...args)
    },
    error(...args: unknown[]) {
        if (threshold <= LEVELS.error) console.error(...args)
    },
}
