"use client"

import Link from "@/components/app-link"
import { ChevronLeft } from "lucide-react"
import { SyncPill } from "./sync-pill"

export function PageTop({
    title,
    subtitle,
    backHref,
    right,
}: {
    /** A node only for a skeleton whose title is data (a name still loading) */
    title: React.ReactNode
    subtitle?: React.ReactNode
    backHref?: string
    right?: React.ReactNode
}) {
    return (
        <header className="no-print px-4 pt-safe">
            <div className="flex min-h-14 items-center justify-between gap-3 pt-3">
                <div className="flex min-w-0 items-center gap-1">
                    {backHref && (
                        <Link
                            href={backHref}
                            aria-label="Back"
                            className="-ml-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink-2 transition-colors active:bg-paper-2"
                        >
                            <ChevronLeft className="h-6 w-6" />
                        </Link>
                    )}
                    <h1 className="truncate text-[21px] font-semibold leading-tight tracking-[-0.01em] text-ink">{title}</h1>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    <SyncPill />
                    {right}
                </div>
            </div>
            {subtitle && <div className={backHref ? "pl-9 text-[14px] text-ink-2" : "text-[14px] text-ink-2"}>{subtitle}</div>}
        </header>
    )
}
