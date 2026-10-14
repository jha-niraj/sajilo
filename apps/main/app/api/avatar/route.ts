import { NextResponse } from "next/server"
import { db } from "@repo/db"
import { getDownloadUrl } from "@repo/storage"
import { getSession } from "@/lib/session"

/**
 * The bucket is private, so the photo is served through a short-lived signed link. The redirect
 * is cached privately for a little less than the link lives, so the image isn't re-fetched on
 * every screen.
 */
export async function GET() {
    const session = await getSession()
    if (!session) return new NextResponse(null, { status: 401 })
    const row = await db.query.user.findFirst({ where: (u, { eq }) => eq(u.id, session.user.id), columns: { image: true } })
    if (!row?.image?.startsWith("avatars/")) return new NextResponse(null, { status: 404 })
    const url = await getDownloadUrl(row.image, 3600)
    return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "private, max-age=3000" } })
}
