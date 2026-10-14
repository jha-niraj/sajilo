"use client"

import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { SyncPill } from "./sync-pill"

export function PageTop({
    title,
    subtitle,
    backHref,
    right,
}: {
    title: string
    subtitle?: React.ReactNode
    backHref?: string
    right?: React.ReactNode
}) {
    return (
        <header className="no-print flex items-start justify-between gap-3 px-4 pt-safe">
            <div className="flex min-w-0 items-start gap-1.5 pt-4">
                {backHref && (
                    <Link href={backHref} aria-label="Back" className="-ml-2 mt-0.5 rounded-full p-1.5 text-ink-2 active:bg-paper-2">
                        <ChevronLeft className="h-7 w-7" />
                    </Link>
                )}
                <div className="min-w-0">
                    <h1 className="truncate text-[26px] font-semibold leading-tight text-ink">{title}</h1>
                    {subtitle && <div className="mt-0.5 text-[15px] text-ink-2">{subtitle}</div>}
                </div>
            </div>
            <div className="flex shrink-0 items-center gap-2 pt-5">
                <SyncPill />
                {right}
            </div>
        </header>
    )
}
