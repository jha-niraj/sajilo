import { NextRequest, NextResponse } from "next/server"

// Edge middleware (Cloudflare/OpenNext does not run Node "proxy" yet), so this only checks
// that a session cookie exists. Pages and actions verify the session for real.

const PUBLIC_ROUTES = ["/login", "/signup"]
// "/" is the login screen itself, so it is public for exactly that path.
const COOKIE_PREFIX = process.env.AUTH_COOKIE_PREFIX || "better-auth"

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl

    const isLoggedIn = Boolean(
        request.cookies.get(`${COOKIE_PREFIX}.session_token`)?.value ||
            request.cookies.get(`__Secure-${COOKIE_PREFIX}.session_token`)?.value,
    )
    const isPublic = pathname === "/" || PUBLIC_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/"))

    if (!isLoggedIn && !isPublic) {
        return NextResponse.redirect(new URL("/", request.nextUrl.origin))
    }
    if (isLoggedIn && isPublic) {
        return NextResponse.redirect(new URL("/munshi", request.nextUrl.origin))
    }
    return NextResponse.next()
}

export const config = {
    // Skip API routes, Next assets and any public file (has an extension: images, icons, sw.js, ...).
    matcher: ["/((?!api|_next/static|_next/image|offline|.*\\.[a-zA-Z0-9]+$).*)"],
}
