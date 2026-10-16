/** Where sign-in lands. Sajilo has one role; the only choice is a `returnTo` from the login URL. */
export const HOME_AFTER_SIGN_IN = "/munshi"

/**
 * A same-site app path from `?returnTo=` (set by the middleware when a signed-out visit to a page
 * was sent to the login), or Munshi. Never another site (`//host`, `/\host`, a scheme), never the
 * login or sign-up pages themselves, never the API.
 */
export function signInDestination(search: string): string {
    let raw: string | null = null
    try {
        raw = new URLSearchParams(search).get("returnTo")
    } catch {
        return HOME_AFTER_SIGN_IN
    }
    if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\") || [...raw].some((c) => c.charCodeAt(0) < 32)) return HOME_AFTER_SIGN_IN
    const path = raw.split(/[?#]/)[0]!
    if (path === "/" || path === "/login" || path.startsWith("/signup") || path.startsWith("/api") || path.startsWith("/_next")) return HOME_AFTER_SIGN_IN
    return raw
}
