import { NextResponse } from "next/server"
import { db, and, eq } from "@repo/db"
import { scanJob } from "@repo/db/schema"
import { getDownloadUrl } from "@repo/storage"
import { getSession } from "@/lib/session"

/** A scanned page's photo from the private bucket, through a short-lived signed link (like /api/avatar). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getSession()
    if (!session) return new NextResponse(null, { status: 401 })
    const { id } = await params
    const job = await db.query.scanJob.findFirst({
        where: and(eq(scanJob.id, id), eq(scanJob.collectorId, session.user.id)),
        columns: { r2Key: true },
    })
    if (!job?.r2Key) return new NextResponse(null, { status: 404 })
    const url = await getDownloadUrl(job.r2Key, 3600)
    return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "private, max-age=3000" } })
}
