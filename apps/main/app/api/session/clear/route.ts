import { NextResponse, type NextRequest } from "next/server"

const PREFIX = process.env.AUTH_COOKIE_PREFIX || "better-auth"

/**
 * A session cookie whose session no longer exists (expired, revoked, user deleted) would make
 * middleware send /login -> /today and the page send /today -> /login forever. Pages send such
 * requests here instead: drop the auth cookies, then go to login once.
 */
export function GET(req: NextRequest) {
    const res = NextResponse.redirect(new URL("/login", req.nextUrl.origin))
    for (const c of req.cookies.getAll()) {
        if (c.name.startsWith(`${PREFIX}.`) || c.name.startsWith(`__Secure-${PREFIX}.`)) {
            res.cookies.set(c.name, "", { path: "/", maxAge: 0 })
        }
    }
    return res
}
