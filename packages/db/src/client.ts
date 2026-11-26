import { neon, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { isTransient, noteQuotaExhausted, clearQuotaSignal } from '@repo/errors';
import * as schema from './schema/index';
import { noteQuery } from './request-timing';
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    console.warn('[db] DATABASE_URL is not set - database calls will fail at runtime.');
}

// ─── Neon cold-start resilience ──────────────────────────────────────────────
// The Neon HTTP driver issues every query as an HTTP `fetch`. Neon serverless
// compute auto-suspends after idle and cold-starts on the next request; that
// first request can exceed the connect timeout, or a transient network blip can
// drop the socket. Because better-auth shares this same `db` client, a single
// blip during the session lookup would otherwise take down a whole authenticated
// page with a hard 500.
//
// We wrap Neon's fetch with a bounded retry + exponential backoff, but ONLY on
// transient connection-level errors where the server never responded (so a retry
// cannot cause a double-write). Cross-platform (global `fetch` only) so it also
// works on Cloudflare Workers.
//
// The `isTransient` heuristic lives in `@repo/errors` - the single source of
// truth shared with the UI error boundaries and every app's action layer, so the
// server retry logic and the "Reconnecting…" UI can never disagree on what counts
// as a momentary blip.

// The other failure mode: `fetch` SUCCEEDS but Neon returns an HTTP error whose
// body carries `"neon:retryable": true` - e.g. "Control plane request failed" or
// "Too many database connection attempts are currently ongoing" during a cold
// start / connection storm. These happen before the query runs (the connection
// was never acquired), so retrying is safe and cannot double-write - Neon's own
// flag confirms it. Since fetch didn't throw, the throw-based retry above never
// sees these; we detect them here by peeking at a cloned response body.
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

async function isRetryableResponse(res: Response): Promise<boolean> {
    if (res.ok || !RETRYABLE_STATUS.has(res.status)) return false;
    try {
        const body = (await res.clone().json()) as { 'neon:retryable'?: boolean };
        return body?.['neon:retryable'] === true;
    } catch {
        // Non-JSON 5xx (e.g. a gateway 502/503 in front of Neon) - still transient.
        return true;
    }
}

/**
 * Record a provider quota refusal while it is still legible.
 *
 * This is the ONLY place in the stack that can see it. Neon answers 402 with the reason in
 * the body; by the time the failure surfaces in an action, better-auth has replaced it with
 * a bare `APIError('Failed to get session', { statusCode: 500 })` and no cause, so nothing
 * downstream can tell a spent quota from a dropped socket. See `quota-signal.ts`.
 *
 * Note this is NOT added to RETRYABLE_STATUS - 402 is correctly absent from that set, so a
 * quota refusal already fails fast rather than burning three attempts against a limit that
 * is not going to move.
 */
async function notePaymentRequired(res: Response): Promise<void> {
    if (res.status !== 402) return;
    noteQuotaExhausted();
    try {
        const body = (await res.clone().json()) as { message?: string };
        console.error(`[db] provider refused the query on quota: ${body?.message ?? '(no message)'}`);
    } catch {
        console.error('[db] provider returned 402 Payment Required');
    }
}

// FAIL-FAST budget. Retrying is only worthwhile for a momentary blip (a cold
// start that clears in a beat). When Neon's control plane is genuinely down,
// each attempt otherwise sits ~15s waiting for a slow 500 - so 4 attempts turned
// a hard outage into a ~62s hang. We now:
//   - cap EACH attempt with an AbortController timeout, and
//   - keep only a few attempts,
// so the worst case is a handful of seconds, not a minute. A healthy cold start
// still wakes well within the per-attempt timeout, so legit boots aren't cut off.
const MAX_ATTEMPTS = 3;
const PER_ATTEMPT_TIMEOUT_MS = 4000; // caps a hung control-plane request
const backoff = (attempt: number) => new Promise((r) => setTimeout(r, 250 * 2 ** (attempt - 1)));

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit | undefined, ms: number): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error('neon fetch timeout')), ms);
    // Respect an upstream abort signal (if the driver ever passes one) too.
    const upstream = init?.signal;
    if (upstream) {
        if (upstream.aborted) controller.abort(upstream.reason);
        else upstream.addEventListener('abort', () => controller.abort(upstream.reason), { once: true });
    }
    try {
        return await fetch(input, { ...init, signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
}

const retryingFetch: typeof fetch = async (input, init) => {
    const t0 = Date.now();
    try {
        return await retryingFetchInner(input, init);
    } finally {
        noteQuery(Date.now() - t0);
    }
};

const retryingFetchInner: typeof fetch = async (input, init) => {
    let lastErr: unknown;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
            const res = await fetchWithTimeout(input, init, PER_ATTEMPT_TIMEOUT_MS);
            // A query that got through is proof the quota is no longer refusing, so the
            // signal clears itself without a restart.
            if (res.ok) clearQuotaSignal();
            else await notePaymentRequired(res);
            // 250ms then 500ms backoff - first attempt usually fails on a cold
            // start; a retry shortly after typically hits warmed compute.
            if (attempt < MAX_ATTEMPTS && (await isRetryableResponse(res))) {
                await backoff(attempt);
                continue;
            }
            return res;
        } catch (err) {
            lastErr = err;
            if (attempt === MAX_ATTEMPTS || !isTransient(err)) throw err;
            await backoff(attempt);
        }
    }
    throw lastErr;
};
neonConfig.fetchFunction = retryingFetch;
// docker-compose.yml runs plain Postgres behind a local Neon proxy; the driver posts its queries there.
if (process.env.NEON_FETCH_ENDPOINT) neonConfig.fetchEndpoint = process.env.NEON_FETCH_ENDPOINT;

const sql = neon(connectionString ?? 'postgresql://placeholder/placeholder');

export const db = drizzle({ client: sql, schema });

// Raw Neon query client (tagged-template + `.unsafe()`), sharing the retrying fetch
// config above. Use for dynamic/raw SQL that Drizzle's typed builder can't express
// (e.g. the AI agent's read-only tool queries). Prefer `db` for everything typed.
export const neonQuery = sql;

export type Database = typeof db;
export { schema };

// Per-request factory - pass the connection string explicitly when process.env
// is not available at module init time (e.g. edge functions outside Next.js).
export function createDb(url: string) {
    return drizzle({ client: neon(url), schema });
}
