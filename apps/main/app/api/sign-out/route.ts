import { signOutBeforeNext } from "@/lib/sign-out-edge"

/**
 * The same sign-out as worker.ts, for `next dev` (and in case the Worker entry ever stops answering
 * first): cookies expired in the reply, better-auth's sign-out run behind it. Keep the two in step.
 */
export async function POST(request: Request) {
    return signOutBeforeNext(
        request,
        process.env.AUTH_COOKIE_PREFIX || "better-auth",
        (p) => void p,
        (r) => fetch(r),
    )
}
