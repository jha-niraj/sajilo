import "server-only"
import { cache } from "react"
import { redirect } from "next/navigation"
import { getServerSession } from "@repo/auth"

export const getSession = cache(async () => getServerSession())

/** Current collector's user id. Redirects to the login screen (/) when signed out. */
export async function requireCollectorId(): Promise<string> {
    const session = await getSession()
    if (!session) redirect("/api/session/clear")
    return session.user.id
}

/** For server actions: throws instead of redirecting so the client sees a clean error. */
export async function actionCollectorId(): Promise<string> {
    const session = await getSession()
    if (!session) throw new Error("UNAUTHORIZED")
    return session.user.id
}
