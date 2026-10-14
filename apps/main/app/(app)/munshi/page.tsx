import type { Metadata } from "next"
import { db, and, eq, count } from "@repo/db"
import { customer } from "@repo/db/schema"
import { getSession, requireCollectorId } from "@/lib/session"
import { MunshiClient } from "@/components/munshi/munshi-client"

export const metadata: Metadata = { title: "Munshi" }

export default async function MunshiPage({ searchParams }: { searchParams: Promise<{ welcome?: string; mode?: string }> }) {
    const collectorId = await requireCollectorId()
    const [session, sp, [row]] = await Promise.all([
        getSession(),
        searchParams,
        db.select({ n: count() }).from(customer).where(and(eq(customer.collectorId, collectorId), eq(customer.isActive, true))),
    ])
    return <MunshiClient userName={session?.user.name ?? ""} hasCustomers={(row?.n ?? 0) > 0} welcome={sp.welcome === "1"} initialMode={sp.mode === "chat" ? "chat" : "voice"} />
}
