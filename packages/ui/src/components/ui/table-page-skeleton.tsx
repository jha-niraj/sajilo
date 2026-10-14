import * as React from "react"
import { StatBandSkeleton } from "./stat-band"
import { Skeleton } from "./skeleton"
import { cn } from "../../lib/utils"

/**
 * The loading shape of a list page: header, optional stat strip, optional filter row, a table in a
 * card, and an optional pagination footer.
 *
 * ## Why this exists
 *
 * Every list page used to carry its OWN hand-written copy of its layout as a skeleton, in a
 * separate file. That is the arrangement the root CLAUDE.md warns about: "editing a client's layout
 * desyncs its skeleton, and nothing will tell you". It went wrong three times on one page in a
 * single afternoon, and there are twenty-four of these files.
 *
 * The failure is structural, not carelessness. A skeleton that re-states the layout has to be
 * edited whenever the layout moves, and nothing links the two. So the layout lives HERE, once, and
 * each page declares only what is genuinely its own - how many columns, whether it has stats,
 * whether it paginates. Those facts change far less often than padding does, and when the density
 * of every table changes again, this is the one file that moves.
 *
 * ## The band heights are not arbitrary
 *
 * They mirror what the real pages render after the density pass:
 *   header   title `text-xl` + `text-xs` subtitle, `h-8` buttons
 *   stats    `px-3 py-2` tile with a `h-7` icon  ->  ~44px
 *   filters  `h-9` controls
 *   table    `TableHead` is `h-9`, `TableCell` is `px-3 py-1.5`  ->  ~44px rows
 *   footer   `px-4 py-3`, matching `ListPagination variant="footer"`
 *
 * If you change the `Table` primitive, change the row band here in the same commit.
 *
 * ## Composing instead of configuring
 *
 * Pages with a shape this does not cover - a wizard, a master-detail, a tabbed ledger - should
 * import the individual bands rather than bending this wrapper with more props. A skeleton that
 * takes twelve booleans is the copy-paste problem again, wearing a function signature.
 */

/**
 * Page title, subtitle and the action buttons on the right. Pass the page's exact `title` and
 * static `subtitle` (navigation-speed playbook section 2) - they render in the real header's type
 * classes; a `<Skeleton>` subtitle stands in where the real one is data.
 */
export function SkeletonPageHeader({ actions = 2, title, subtitle, className }: {
    actions?: number
    title?: React.ReactNode
    subtitle?: React.ReactNode
    className?: string
}) {
    return (
        <div className={cn("flex shrink-0 flex-col justify-between gap-2 md:flex-row md:items-center", className)}>
            <div className="min-w-0">
                {title !== undefined
                    ? <h1 className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-white">{title}</h1>
                    : <Skeleton className="h-7 w-40 rounded-lg" />}
                {subtitle !== undefined
                    ? typeof subtitle === "string"
                        ? <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">{subtitle}</p>
                        : <div className="mt-0.5">{subtitle}</div>
                    : <Skeleton className="mt-1 h-3 w-72 max-w-full rounded" />}
            </div>
            {actions > 0 && (
                <div className="flex shrink-0 gap-2">
                    {Array.from({ length: actions }).map((_, i) => (
                        <Skeleton key={i} className="h-8 w-28 rounded-md" />
                    ))}
                </div>
            )}
        </div>
    )
}

/**
 * The stat band. `count` and `cols` must match the page's own `<StatBand>` or the band wraps to a
 * different number of rows than the real one and the whole page below it shifts on load.
 * Thin alias of `StatBandSkeleton` so older loaders keep compiling.
 */
export function SkeletonStatStrip({ count = 4, cols = 4 }: {
    count?: number
    cols?: 2 | 3 | 4 | 5 | 6 | 8
}) {
    return <StatBandSkeleton count={count} cols={cols} />
}

/** A search box plus `selects` dropdowns. No card around it - the real pages dropped theirs. */
export function SkeletonFilterRow({ selects = 1 }: { selects?: number }) {
    return (
        <div className="flex shrink-0 flex-col gap-2 md:flex-row">
            <Skeleton className="h-9 flex-1 rounded-md" />
            {Array.from({ length: selects }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full rounded-md md:w-[170px]" />
            ))}
        </div>
    )
}

/** A segmented tab strip, for pages that switch views above the table. */
export function SkeletonTabStrip({ count = 3 }: { count?: number }) {
    return (
        <div className="flex shrink-0 gap-1 rounded-xl border border-neutral-200 p-0.5 dark:border-neutral-800 w-fit">
            {Array.from({ length: count }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-28 rounded-lg" />
            ))}
        </div>
    )
}

/**
 * The table itself, in its card, with the pagination band inside it.
 *
 * `avatarFirstColumn` widens the first cell into an avatar plus two lines, which is what a roster
 * row looks like. A table of dates and amounts should leave it off, or the skeleton promises a
 * column shape the real table does not have.
 */
export function SkeletonTableCard({
    columns = 6,
    rows = 12,
    avatarFirstColumn = false,
    pagination = false,
    className,
}: {
    columns?: number
    rows?: number
    avatarFirstColumn?: boolean
    pagination?: boolean
    className?: string
}) {
    const trailing = Math.max(0, columns - 1)
    return (
        <div
            className={cn(
                "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900",
                className,
            )}
        >
            <div className="min-h-0 flex-1 overflow-hidden">
                {/* Column header strip - `h-9`, matching `TableHead`. */}
                <div className="flex h-9 items-center gap-4 border-b border-neutral-200 px-3 dark:border-neutral-800">
                    <Skeleton className={cn("h-3 rounded", avatarFirstColumn ? "w-40" : "w-24")} />
                    {Array.from({ length: trailing }).map((_, i) => (
                        <Skeleton key={i} className="hidden h-3 w-16 rounded md:block" />
                    ))}
                </div>
                {Array.from({ length: rows }).map((_, r) => (
                    <div key={r} className="flex items-center gap-4 px-3 py-1.5">
                        {avatarFirstColumn ? (
                            <>
                                <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
                                <div className="min-w-0 flex-1 space-y-1">
                                    <Skeleton className="h-3.5 w-40 max-w-full rounded" />
                                    <Skeleton className="h-2.5 w-56 max-w-full rounded" />
                                </div>
                            </>
                        ) : (
                            <Skeleton className="h-3.5 w-40 max-w-full flex-1 rounded" />
                        )}
                        {Array.from({ length: trailing }).map((_, i) => (
                            <Skeleton key={i} className="hidden h-3 w-16 shrink-0 rounded md:block" />
                        ))}
                    </div>
                ))}
            </div>
            {pagination && (
                // Inside the card and outside the scroller, exactly where `ListPagination
                // variant="footer"` puts it. A skeleton that omits it lets the table claim the
                // band's height and then lose it the moment data lands.
                <div className="flex shrink-0 items-center justify-between gap-3 border-t border-neutral-200 px-4 py-3 dark:border-neutral-800">
                    <Skeleton className="h-4 w-44 rounded" />
                    <div className="flex gap-2">
                        <Skeleton className="h-8 w-24 rounded-md" />
                        <Skeleton className="h-8 w-20 rounded-md" />
                    </div>
                </div>
            )}
        </div>
    )
}

export interface TablePageSkeletonProps {
    /**
     * `true` for a page whose root is `h-[var(--gk-page-h)] overflow-hidden` - its ONE list scrolls
     * under fixed chrome. `false` for a page that scrolls with the shell. Getting this wrong bounds
     * a page the real one does not bound, and it resizes on load.
     */
    /**
     * `true` bounds at every width; `'lg'` bounds only from `lg` up, matching a client that carries
     * the "flows on a phone" fix (`lg:h-[var(--gk-page-h)] lg:overflow-hidden`). See the same prop
     * on `BoundedPageSkeleton` for why an all-or-nothing bound silently desynced nine pages.
     */
    bounded?: boolean | 'lg'
    /**
     * The client's exact bound classes, when they are not the bare `var(--gk-page-h)` this renders.
     *
     * A page whose bounded region sits BELOW chrome its own layout draws has to subtract that
     * chrome: Configure -> Fees uses `lg:h-[calc(var(--gk-page-h)-7.5rem)]` because the Configure
     * layout renders the section title above it. Matching the BREAKPOINT without matching the
     * HEIGHT leaves a 7.5rem jump - smaller than the bug it replaced, still a jump.
     *
     * It is a full class string rather than a height expression on purpose. Tailwind finds classes
     * by scanning source text, so `h-[${'${expr}'}]` built here would never be generated at all; written
     * out at the call site, the scanner sees it. Passing this overrides `bounded`.
     */
    boundedClass?: string
    actions?: number
    stats?: number
    statCols?: 2 | 3 | 4 | 5 | 6 | 8
    tabs?: number
    filters?: false | number
    columns?: number
    rows?: number
    avatarFirstColumn?: boolean
    pagination?: boolean
    /** The page's exact title. Unset only when the title is data. */
    title?: React.ReactNode
    /** The exact static description, or a `<Skeleton>` where it is data. */
    subtitle?: React.ReactNode
}

export function TablePageSkeleton({
    bounded = true,
    boundedClass,
    actions = 2,
    stats = 0,
    statCols = 4,
    tabs = 0,
    filters = 1,
    columns = 6,
    rows = 12,
    avatarFirstColumn = false,
    pagination = false,
    title,
    subtitle,
}: TablePageSkeletonProps) {
    return (
        <div className={cn(
            "flex flex-col gap-5",
            boundedClass
                ?? (bounded === 'lg'
                    ? "lg:h-[var(--gk-page-h)] lg:overflow-hidden"
                    : bounded ? "h-[var(--gk-page-h)] overflow-hidden" : "min-h-0"),
        )}>
            <SkeletonPageHeader actions={actions} title={title} subtitle={subtitle} />
            {stats > 0 && <SkeletonStatStrip count={stats} cols={statCols} />}
            {tabs > 0 && <SkeletonTabStrip count={tabs} />}
            {filters !== false && <SkeletonFilterRow selects={filters} />}
            <SkeletonTableCard
                columns={columns}
                rows={rows}
                avatarFirstColumn={avatarFirstColumn}
                pagination={pagination}
            />
        </div>
    )
}
