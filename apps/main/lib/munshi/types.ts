export type ProposalKind = "mark_payment" | "add_customer" | "add_loan" | "add_repayment"

/** An action Munshi wants to take. Nothing changes until he confirms it on screen (or says yes). */
export interface Proposal {
    id: string
    kind: ProposalKind
    title: string
    lines: string[]
    payload: Record<string, unknown>
    /** The tool call that made this card, replayed with confirm=true when he says yes */
    call: { tool: string; args: Record<string, unknown> }
    status: "pending" | "done" | "cancelled" | "failed"
}

export interface MunshiMessage {
    id: string
    role: "user" | "assistant"
    content: string
    proposals?: Proposal[]
    at: number
}

export interface MunshiTurnResult {
    reply: string
    proposals: Proposal[]
    /** Proposals confirmed by voice ("yes") during this turn */
    resolved: { id: string; status: Proposal["status"] }[]
    heard?: string
    audio?: string | null
    error?: "no_llm" | "no_speech" | "failed"
}
