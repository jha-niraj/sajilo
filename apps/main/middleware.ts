import { NextRequest, NextResponse } from "next/server"

// Edge middleware (Cloudflare/OpenNext does not run Node "proxy" yet), so this only checks
// that a session cookie exists. Pages and actions verify the session for real.

const PUBLIC_ROUTES = ["/login", "/signup"]
const COOKIE_PREFIX = process.env.AUTH_COOKIE_PREFIX || "better-auth"

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl

    const isLoggedIn = Boolean(
        request.cookies.get(`${COOKIE_PREFIX}.session_token`)?.value ||
            request.cookies.get(`__Secure-${COOKIE_PREFIX}.session_token`)?.value,
    )
    const isPublic = PUBLIC_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/"))

    if (!isLoggedIn && !isPublic) {
        return NextResponse.redirect(new URL("/login", request.nextUrl.origin))
    }
    if (isLoggedIn && (isPublic || pathname === "/")) {
        return NextResponse.redirect(new URL("/munshi", request.nextUrl.origin))
    }
    return NextResponse.next()
}

export const config = {
    matcher: ["/((?!api|_next/static|_next/image|sw.js|manifest.webmanifest|icons|offline|favicon.ico|robots.txt).*)"],
}
