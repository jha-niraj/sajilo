"use client"

import Link from "@/components/app-link"
import { ChevronRight, ClipboardList, Smartphone } from "lucide-react"
import { PageTop } from "@/components/shell/page-top"
import { useI18n } from "@/lib/i18n"
import type { DictKey } from "@/lib/dict"

/** Every report in one place; new ones are added to this list. */
const REPORTS: { href: string; title: DictKey; sub: DictKey; icon: typeof Smartphone }[] = [
    { href: "/reports/recharge", title: "rcReportTitle", sub: "reportsRechargeSub", icon: Smartphone },
    { href: "/print/month", title: "reportsCollection", sub: "reportsCollectionSub", icon: ClipboardList },
]

export function ReportsList() {
    const { t } = useI18n()
    return (
        <>
            <PageTop title={t("reportsTitle")} backHref="/more" />
            <ul className="space-y-2.5 px-4 pt-4">
                {REPORTS.map(({ href, title, sub, icon: Icon }) => (
                    <li key={href}>
                        <Link href={href} className="flex items-center gap-3 rounded-[22px] bg-card p-4 ring-1 ring-line active:bg-paper-2">
                            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-saffron-soft text-saffron">
                                <Icon className="h-5 w-5" />
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="block text-[16px] font-semibold text-ink">{t(title)}</span>
                                <span className="block text-[13px] text-ink-3">{t(sub)}</span>
                            </span>
                            <ChevronRight className="h-5 w-5 shrink-0 text-ink-3" />
                        </Link>
                    </li>
                ))}
            </ul>
        </>
    )
}
