import { NextRequest, NextResponse } from "next/server"

// Edge middleware (Cloudflare/OpenNext does not run Node "proxy" yet), so this only checks
// that a session cookie exists. Pages and actions verify the session for real.

const PUBLIC_ROUTES = ["/login", "/signup", "/about"]
// "/" is the public landing page, so it is public for exactly that path.
// Signed-in visitors skip these and go straight to the app (/about stays readable by everyone).
const SIGNED_IN_SKIPS = ["/", "/login", "/signup"]
const COOKIE_PREFIX = process.env.AUTH_COOKIE_PREFIX || "better-auth"

// Which isolate answered: 1 = a fresh one (a cold start). Cloudflare adds nothing like this, and a
// Worker can't time its own cold start, so it is read from outside (scripts/bench-navigation.mts).
let isolateRequests = 0
const isolateStart = Date.now()

function stamp(res: NextResponse): NextResponse {
    res.headers.set("x-isolate-requests", String(isolateRequests))
    res.headers.set("x-isolate-age-ms", String(Date.now() - isolateStart))
    return res
}

export function middleware(request: NextRequest) {
    isolateRequests++
    const { pathname, search } = request.nextUrl

    const isLoggedIn = Boolean(
        request.cookies.get(`${COOKIE_PREFIX}.session_token`)?.value ||
            request.cookies.get(`__Secure-${COOKIE_PREFIX}.session_token`)?.value,
    )
    const isPublic = pathname === "/" || PUBLIC_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/"))

    if (!isLoggedIn && !isPublic) {
        // Back to this page after signing in (validated by lib/sign-in-destination.ts).
        const to = new URL("/login", request.nextUrl.origin)
        to.searchParams.set("returnTo", pathname + search)
        return stamp(NextResponse.redirect(to))
    }
    // A signed-in person who OPENS the landing or login page goes home. Only a document load: the
    // router's background fetches (Sec-Fetch-Dest: empty) must get the page, because the sign-out
    // button prefetches `/login` while he is still signed in, and a cached redirect would send
    // sign-out back to Munshi. Next strips its own router headers before this runs, so this header
    // is how to tell.
    const dest = request.headers.get("sec-fetch-dest")
    const skips = SIGNED_IN_SKIPS.some((r) => pathname === r || (r !== "/" && pathname.startsWith(r + "/")))
    if (isLoggedIn && skips && (!dest || dest === "document")) {
        return stamp(NextResponse.redirect(new URL("/munshi", request.nextUrl.origin)))
    }
    return stamp(NextResponse.next())
}

export const config = {
    // Skip API routes, Next assets and any public file (has an extension: images, icons, sw.js, ...).
    matcher: ["/((?!api|_next/static|_next/image|offline|.*\\.[a-zA-Z0-9]+$).*)"],
}
