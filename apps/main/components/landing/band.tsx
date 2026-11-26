import { cn } from "@repo/ui/lib/utils"

/** One section of the public pages: a full-width band, paper or white, with a centred 1200px column. */
export function Band({
    id,
    tone = "paper",
    className,
    inner,
    children,
}: {
    id?: string
    tone?: "paper" | "white" | "sky"
    className?: string
    inner?: string
    children: React.ReactNode
}) {
    return (
        <section
            id={id}
            className={cn(
                "scroll-mt-16",
                tone === "white" && "bg-card",
                tone === "paper" && "bg-paper",
                tone === "sky" && "bg-sky-soft",
                className,
            )}
        >
            <div className={cn("mx-auto w-full max-w-[1200px] px-4 py-20 sm:px-6 sm:py-24 lg:py-28", inner)}>{children}</div>
        </section>
    )
}

export function Kicker({ children, className }: { children: React.ReactNode; className?: string }) {
    return <p className={cn("mb-3 text-sm font-semibold text-saffron", className)}>{children}</p>
}

/** Two-tone heading: the claim in ink, the second line quieter. */
export function BandTitle({ title, muted, className, as: Tag = "h2" }: { title: string; muted?: string; className?: string; as?: "h1" | "h2" }) {
    return (
        <Tag className={cn("max-w-3xl text-[2rem] leading-[1.12] font-semibold tracking-[-0.035em] text-balance sm:text-5xl", className)}>
            <span className="text-ink">{title}</span>
            {muted && <span className="block text-ink-3">{muted}</span>}
        </Tag>
    )
}
