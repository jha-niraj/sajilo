import type { Metadata } from "next"
import { db, and, eq, count } from "@repo/db"
import { customer } from "@repo/db/schema"
import { getSession, requireCollectorId } from "@/lib/session"
import { getConversation } from "@/actions/munshi.action"
import { MunshiClient } from "@/components/munshi/munshi-client"

export const metadata: Metadata = { title: "Munshi" }

export default async function MunshiPage({ searchParams }: { searchParams: Promise<{ welcome?: string; mode?: string; c?: string }> }) {
    const collectorId = await requireCollectorId()
    const sp = await searchParams
    const [session, [row], saved] = await Promise.all([
        getSession(),
        db.select({ n: count() }).from(customer).where(and(eq(customer.collectorId, collectorId), eq(customer.isActive, true))),
        sp.c ? getConversation(sp.c) : Promise.resolve(null),
    ])
    const conversationId = saved ? sp.c : undefined
    return (
        <MunshiClient
            key={conversationId ?? "new"}
            userName={session?.user.name ?? ""}
            hasCustomers={(row?.n ?? 0) > 0}
            welcome={sp.welcome === "1"}
            initialMode={sp.mode === "chat" ? "chat" : "voice"}
            conversationId={conversationId}
            initialMessages={saved ?? undefined}
        />
    )
}
