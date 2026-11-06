import type { SVGProps } from "react"

/**
 * Munshi's header icons, drawn as one family: 24px grid, 1.8 stroke, round joins, a filled accent
 * where a second shape would otherwise crowd a 20px glyph.
 */
type P = SVGProps<SVGSVGElement>

const base = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
}

/** Past chats: a conversation bubble with a small clock face. */
export function PastChatsIcon(props: P) {
    return (
        <svg {...base} {...props}>
            <path d="M12.5 4.5H7A3.5 3.5 0 0 0 3.5 8v5.5A3.5 3.5 0 0 0 7 17h1v3l3.6-3h1.4" />
            <circle cx="17" cy="13.5" r="4.5" />
            <path d="M17 11.5v2.2l1.4 1" />
        </svg>
    )
}

/** New chat: a bubble with a plus. */
export function NewChatIcon(props: P) {
    return (
        <svg {...base} {...props}>
            <path d="M20.5 11.5V8A3.5 3.5 0 0 0 17 4.5H7A3.5 3.5 0 0 0 3.5 8v5.5A3.5 3.5 0 0 0 7 17h1v3l3.6-3h1.9" />
            <path d="M18.5 15v5M16 17.5h5" />
        </svg>
    )
}

/** Talk: a microphone with a sound wave either side. */
export function TalkIcon(props: P) {
    return (
        <svg {...base} {...props}>
            <rect x="9" y="3.5" width="6" height="10.5" rx="3" fill="currentColor" fillOpacity={0.14} />
            <path d="M6.5 11a5.5 5.5 0 0 0 11 0M12 16.5v3.5M9.5 20h5" />
            <path d="M3 9.5v3M21 9.5v3" />
        </svg>
    )
}

/** Type: a bubble with two lines of writing and a cursor. */
export function TypeIcon(props: P) {
    return (
        <svg {...base} {...props}>
            <path
                d="M7 4.5h10A3.5 3.5 0 0 1 20.5 8v5.5A3.5 3.5 0 0 1 17 17h-5.4L8 20v-3H7a3.5 3.5 0 0 1-3.5-3.5V8A3.5 3.5 0 0 1 7 4.5Z"
                fill="currentColor"
                fillOpacity={0.14}
            />
            <path d="M7.5 9h6M7.5 12.5h4M16.5 8.5v5" />
        </svg>
    )
}
