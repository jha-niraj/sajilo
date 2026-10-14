"use client"

import * as React from "react"
import { cn } from "../../lib/utils"

/**
 * Mobile bottom navigation - the small-screen counterpart to the desktop sidebar.
 *
 * On phones the only way into the app used to be a floating hamburger pinned over the
 * page content, which meant EVERY navigation was two taps (open the sheet, pick a link)
 * and the button sat on top of whatever it happened to overlap. A bottom bar puts the
 * handful of destinations people actually use within thumb reach at one tap, and keeps
 * the full menu one tap away behind "More".
 *
 * The sheet is deliberately unchanged - this is an addition in front of it, not a
 * replacement for it. "More" opens exactly the same sheet the hamburger did.
 *
 * Pages must reserve `--gk-bottom-nav-h` of bottom padding on small screens, or the last
 * row of a list sits under the bar. The apps do this on their content wrapper.
 */

export type BottomNavItem = {
    label: string
    href: string
    icon: React.ReactNode
    /** Consumers own route matching - they have the pathname and the nav shape. */
    active?: boolean
    /** Optional unread/attention count. Values over 9 render as "9+". */
    badge?: number
}

export function MobileBottomNav({
    items,
    onMore,
    moreActive = false,
    moreLabel = "More",
    centreAction,
    linkComponent: Link = "a",
    className,
}: {
    /** Up to four; more than that and the labels stop being readable at 360px. */
    items: BottomNavItem[]
    onMore: () => void
    moreActive?: boolean
    moreLabel?: string
    /**
     * A raised action in the MIDDLE of the bar, between the second and third link.
     *
     * The centre of a bottom bar is the easiest place to reach with a thumb on any hand, so it is
     * reserved for the one action used far more than the others rather than another destination.
     * Rendered as a lifted circle, not a fifth tab: it is a different KIND of thing (it opens a
     * panel over the page, it does not navigate), and looking identical to the tabs either side
     * would say otherwise.
     */
    centreAction?: {
        label: string
        icon: React.ReactNode
        onClick: () => void
        active?: boolean
    }
    /** next/link in the apps; plain <a> in isolation. */
    linkComponent?: React.ElementType
    className?: string
}) {
    const shown = items.slice(0, 4)
    // Split so the raised action sits in the middle. With four links that is 2 | action | 2.
    const half = Math.ceil(shown.length / 2)
    const leftItems = centreAction ? shown.slice(0, half) : shown
    const rightItems = centreAction ? shown.slice(half) : []

    const renderItem = (list: BottomNavItem[]) => list.map((item) => (

                    <Link
                        key={item.href}
                        href={item.href}
                        aria-current={item.active ? "page" : undefined}
                        className={cn(
                            "relative flex flex-1 cursor-pointer flex-col items-center justify-center gap-1 px-1 transition-colors",
                            item.active
                                ? "text-neutral-900 dark:text-white"
                                : "text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200",
                        )}
                    >
                        {/* The active marker is a top rule rather than a filled pill: at this size a
                            filled background crowds the icon and label into illegibility. */}
                        <span
                            aria-hidden
                            className={cn(
                                "absolute inset-x-3 top-0 h-0.5 rounded-full transition-opacity",
                                item.active ? "bg-neutral-900 opacity-100 dark:bg-white" : "opacity-0",
                            )}
                        />
                        <span className="relative flex h-5 w-5 items-center justify-center [&_svg]:h-5 [&_svg]:w-5">
                            {item.icon}
                            {!!item.badge && item.badge > 0 && (
                                <span className="absolute -right-1.5 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                                    {item.badge > 9 ? "9+" : item.badge}
                                </span>
                            )}
                        </span>
                        <span className="w-full truncate text-center text-[11px] font-medium leading-none">
                            {item.label}
                        </span>
                    </Link>
    ));

    return (
        <nav
            aria-label="Primary"
            className={cn(
                // `pb-[env(safe-area-inset-bottom)]` keeps the row clear of the iOS home
                // indicator; without it the last few pixels of the tap target are unreachable.
                "fixed inset-x-0 bottom-0 z-50 lg:hidden print:hidden",
                "pb-[env(safe-area-inset-bottom)]",
                "border-t border-neutral-200 bg-white/95 backdrop-blur-sm",
                "dark:border-neutral-800 dark:bg-neutral-950/95",
                className,
            )}
        >
            <div className="flex h-16 items-stretch">
                {/* One renderer, used for both halves - the centre action splits the row, it does
                    not create a second kind of tab. */}
                {renderItem(leftItems)}

                {centreAction && (
                    <div className="flex w-16 shrink-0 items-center justify-center">
                        {/* Sits IN the bar, not above it.
                            The previous version raised a 56px disc into a notch cut through the
                            bar's top edge. Two circular arcs of different radii meeting a straight
                            border is a lot of geometry to get right, and it did not survive
                            contact: at real sizes the rim read as a stray arc beside a stark
                            white puck. A raised circle also fights the row it belongs to - every
                            neighbour is a flat icon over a label.
                            A rounded tile inside the bar is the same emphasis with none of the
                            geometry, and nothing to misalign. */}
                        <button
                            type="button"
                            onClick={centreAction.onClick}
                            aria-label={centreAction.label}
                            aria-pressed={centreAction.active}
                            className={cn(
                                "flex h-11 w-12 cursor-pointer items-center justify-center rounded-2xl",
                                "transition-colors active:scale-95",
                                // Neutral, like every other control in this bar. Emphasis comes
                                // from the filled tile, not from a colour competing with the page.
                                "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900",
                                centreAction.active && "bg-neutral-700 dark:bg-neutral-200",
                                "[&_svg]:h-5 [&_svg]:w-5",
                            )}
                        >
                            {centreAction.icon}
                        </button>
                    </div>
                )}

                {renderItem(rightItems)}

                <button
                    type="button"
                    onClick={onMore}
                    aria-label={`${moreLabel} - open full menu`}
                    className={cn(
                        "relative flex flex-1 cursor-pointer flex-col items-center justify-center gap-1 px-1 transition-colors",
                        moreActive
                            ? "text-neutral-900 dark:text-white"
                            : "text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200",
                    )}
                >
                    <span className="flex h-5 w-5 items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    </span>
                    <span className="w-full truncate text-center text-[11px] font-medium leading-none">
                        {moreLabel}
                    </span>
                </button>
            </div>
        </nav>
    )
}
