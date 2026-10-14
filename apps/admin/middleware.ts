import { NextRequest, NextResponse } from "next/server"

const protectedPrefixes = [
    "/home",
    "/admins",
    "/analytics",
    "/reports",
    "/system",
    "/communications",
    "/users",
]

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl

    if (
        pathname.startsWith("/api/") ||
        pathname.startsWith("/_next/") ||
        pathname.includes(".")
    ) {
        return NextResponse.next()
    }

    const isProtected = protectedPrefixes.some(
        (p) => pathname === p || pathname.startsWith(p + "/"),
    )

    const prefix = process.env.AUTH_COOKIE_PREFIX || "better-auth"
    const sessionCookie =
        request.cookies.get(`${prefix}.session_token`) ?? request.cookies.get(`__Secure-${prefix}.session_token`)
    const isLoggedIn = !!sessionCookie?.value

    if (!isLoggedIn && isProtected) {
        // Preserve the original destination so we can redirect back after sign-in
        const loginUrl = new URL("/", request.nextUrl.origin)
        loginUrl.searchParams.set("callbackUrl", pathname)
        return NextResponse.redirect(loginUrl)
    }

    if (isLoggedIn && (pathname === "/" || pathname === "/join")) {
        return NextResponse.redirect(new URL("/home", request.nextUrl.origin))
    }

    return NextResponse.next()
}

export const config = {
    matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
