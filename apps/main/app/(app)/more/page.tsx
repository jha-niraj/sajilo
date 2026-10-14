import type { Metadata } from "next"
import { db } from "@repo/db"
import { requireCollectorId } from "@/lib/session"
import { avatarUrl } from "@/lib/avatar"
import { MoreClient } from "@/components/settings/more-client"

export const metadata: Metadata = { title: "More" }

export default async function MorePage() {
    const userId = await requireCollectorId()
    // Read straight from the table: the session can lag behind a photo change.
    const row = await db.query.user.findFirst({
        where: (u, { eq }) => eq(u.id, userId),
        columns: { name: true, phoneNumber: true, image: true },
    })
    return <MoreClient name={row?.name ?? ""} phone={row?.phoneNumber ?? null} photo={avatarUrl(row?.image)} />
}
