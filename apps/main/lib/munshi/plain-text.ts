/**
 * Munshi is told to write plain text, but models still slip in markdown. Chat shows **bold** as bold
 * (`RichReply`); everything else is markup he should never see, and the voice must never read out.
 */

/** Removes markdown syntax but keeps the words: headings, list stars, emphasis, code ticks, links. */
export function stripMarkdown(text: string): string {
    return text
        .replace(/^\s{0,3}#{1,6}\s+/gm, "")
        .replace(/^(\s*)[*+]\s+/gm, "$1- ")
        .replace(/\*\*(.+?)\*\*/g, "$1")
        .replace(/__(.+?)__/g, "$1")
        .replace(/(^|[^*\w])\*(?!\s)([^*\n]+?)\*(?!\w)/g, "$1$2")
        .replace(/`([^`\n]+)`/g, "$1")
        .replace(/\[([^\]\n]+)\]\([^)\s]+\)/g, "$1")
        .replace(/\*{2,}/g, "")
}

export type ReplyPart = { text: string; bold: boolean }

/** Splits a reply into plain and bold runs; all other markdown is removed. */
export function replyParts(text: string): ReplyPart[] {
    const clean = stripMarkdown(text.replace(/\*\*(.+?)\*\*/g, "\uE000$1\uE001"))
    const parts: ReplyPart[] = []
    for (const chunk of clean.split(/(\uE000[^\uE001]*\uE001)/)) {
        if (!chunk) continue
        const bold = chunk.startsWith("\uE000")
        parts.push({ text: bold ? chunk.slice(1, -1) : chunk.replace(/[\uE000\uE001]/g, ""), bold })
    }
    return parts
}
