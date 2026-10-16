/**
 * The session cookie cache, in ONE place with no imports, so the auth config (the writer) and any
 * reader stay in step.
 *
 * With it on, better-auth answers getSession from a signed (HMAC, not encrypted) cookie for
 * `maxAge` seconds instead of reading the session and user rows on every page. Name and role can
 * be up to `maxAge` stale for reads. Bump `version` to make every browser drop its cached copy.
 */
export const COOKIE_CACHE = {
    enabled: true,
    maxAge: 300,
    strategy: 'compact' as const,
    version: '1',
}
