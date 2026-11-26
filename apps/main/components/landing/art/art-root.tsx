import type { CSSProperties, ReactNode } from "react"
import { cn } from "@repo/ui/lib/utils"

/**
 * Wrap pixel art in this. The `art-*` motion classes (art.css, imported by the landing layout) run
 * anywhere and stop under prefers-reduced-motion on their own; inside `.art-root` any other animation stops too and
 * every scene shows its finished state. `as="span"` for art inside inline content.
 */
export function ArtRoot({ children, className, style, as = "div" }: { children: ReactNode; className?: string; style?: CSSProperties; as?: "div" | "span" }) {
    const Tag = as
    return (
        <Tag className={cn("art-root", className)} style={style}>
            {children}
        </Tag>
    )
}
