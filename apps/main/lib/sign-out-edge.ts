/**
 * Sign-out answered by the Worker BEFORE the Next.js bundle loads (worker.ts). No imports, so it
 * costs nothing on a cold isolate.
 *
 * better-auth's own /sign-out clears the cookies only in its reply, and that reply waits for the
 * bundle to load and for its database work (seconds on a cold Worker). The login page can't show
 * until the cookie is gone (the middleware sends a live session to Munshi), so here the cookies are
 * expired at once and better-auth's sign-out runs after the reply, through `waitUntil`, so the
 * session row is still deleted. If that background call fails, the row simply expires.
 */
export async function signOutBeforeNext(
    request: Request,
    cookiePrefix: string,
    runInBackground: (p: Promise<unknown>) => void,
    nextHandler: (r: Request) => Promise<Response>,
): Promise<Response> {
    const url = new URL(request.url)
    const origin = request.headers.get("origin")
    if (origin !== url.origin) return new Response(null, { status: 403 })

    const cookie = request.headers.get("cookie") ?? ""
    const headers = new Headers({ "cache-control": "no-store" })
    for (const part of cookie.split(";")) {
        const name = part.split("=")[0]?.trim()
        if (!name || !(name.startsWith(`${cookiePrefix}.`) || name.startsWith(`__Secure-${cookiePrefix}.`))) continue
        // The same name, path and Secure flag as when set, or the browser keeps it.
        const secure = name.startsWith("__Secure-") || url.protocol === "https:" ? "; Secure" : ""
        headers.append("set-cookie", `${name}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secure}`)
    }

    const forward = new Headers({ cookie, origin: url.origin, "content-type": "application/json" })
    const ip = request.headers.get("cf-connecting-ip")
    if (ip) forward.set("cf-connecting-ip", ip)
    runInBackground(
        nextHandler(new Request(new URL("/api/auth/sign-out", url.origin), { method: "POST", headers: forward, body: "{}" })).catch(() => undefined),
    )
    return new Response(null, { status: 204, headers })
}
