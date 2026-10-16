import "server-only"
import { db, eq } from "@repo/db"
import { munshiCommit } from "@repo/db/schema"

/** True when this call is the first to save the card; false when it was already saved. */
export async function claimProposal(proposalId: string, collectorId: string, kind: string): Promise<boolean> {
    const rows = await db
        .insert(munshiCommit)
        .values({ proposalId, collectorId, kind })
        .onConflictDoNothing()
        .returning({ id: munshiCommit.proposalId })
    return rows.length > 0
}

/** The save failed, so let a retry claim the card again. */
export async function releaseProposal(proposalId: string): Promise<void> {
    await db.delete(munshiCommit).where(eq(munshiCommit.proposalId, proposalId))
}
