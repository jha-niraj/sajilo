import { auth, toNextJsHandler } from "@repo/auth"
import { serverTimingHeader, withRequestTiming } from "@repo/db/request-timing"

const handler = toNextJsHandler(auth)

/**
 * better-auth's routes, with a `Server-Timing` header (database time and query count, and the
 * handler's own time) so a slow sign-in can be split into "database" and "everything before the
 * handler ran" (a cold Worker) from the browser's network panel.
 */
async function timed(run: () => Promise<Response>): Promise<Response> {
    const t = await withRequestTiming(run)
    const res = new Response(t.result.body, t.result)
    res.headers.append("server-timing", serverTimingHeader(t))
    return res
}

export const GET = (req: Request) => timed(() => handler.GET(req))
export const POST = (req: Request) => timed(() => handler.POST(req))
