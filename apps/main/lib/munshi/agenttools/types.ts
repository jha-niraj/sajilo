/**
 * The shape every Munshi tool declares itself in (same pattern as Gurukul's Saathi agenttools).
 *
 * Layout: one folder per area of the app, reads and writes in separate files, all flattened
 * by `index.ts`. A tool wraps a server action for anything that changes data; reads may query.
 *
 * Write tools follow the preview/confirm protocol: called with confirm=false they save nothing
 * and return a preview, which also becomes a Confirm card on screen. Only after he approves
 * (tap or "yes") is the same tool called with confirm=true. One write per turn, enforced by
 * `claimWriteSlot`, so a single "yes" can never commit two things; `commit` claims the card's id,
 * so the same card can never be saved twice.
 */

import type { CoreTool } from "ai"
import type { Proposal, ProposalKind } from "../types"

export interface MunshiToolContext {
    collectorId: string
    /** Nepal-local AD date, YYYY-MM-DD */
    today: string
    lang: "ne" | "en"
    /** A write tool's preview: shown as a Confirm card */
    propose: (p: Omit<Proposal, "id" | "status">) => Proposal
    /**
     * A confirm=true call: finds the card being confirmed, claims it so it can never be saved twice
     * (voice "yes" and the Confirm button both reach it), runs `save`, and closes the card.
     */
    commit: (kind: ProposalKind, payload: Record<string, unknown>, save: () => Promise<{ ok: boolean; message: string }>) => Promise<{ ok: boolean; message: string }>
    claimWriteSlot: (toolName: string) => null | { error: string; alreadyCommitted: string }
}

export type BuiltTool = CoreTool

export interface MunshiToolDef {
    name: string
    /** One line for the system prompt: what this lets him do */
    capability: string
    isWrite: boolean
    build: (ctx: MunshiToolContext) => BuiltTool
}

export interface MunshiWriteDef extends MunshiToolDef {
    isWrite: true
    kind: ProposalKind
    /** The commit, shared by confirm=true and the on-screen Confirm button */
    commit: (payload: Record<string, unknown>, ctx: Pick<MunshiToolContext, "collectorId" | "today">) => Promise<{ ok: boolean; message: string }>
}
