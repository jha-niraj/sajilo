import type { Metadata } from "next"
import { getSession } from "@/lib/session"
import { MoreClient } from "@/components/settings/more-client"

export const metadata: Metadata = { title: "More" }

export default async function MorePage() {
    const session = await getSession()
    const user = session?.user as { name: string; phoneNumber?: string | null } | undefined
    return <MoreClient name={user?.name ?? ""} phone={user?.phoneNumber ?? null} />
}
