"use client"

import { Skeleton } from "@repo/ui/components/ui/skeleton"
import { cn } from "@repo/ui/lib/utils"
import { PageTop } from "@/components/shell/page-top"
import { useI18n } from "@/lib/i18n"

/**
 * One skeleton per page, drawn to the page's real layout: the REAL header (title, back link and
 * sync pill from `PageTop`) with grey blocks only where data goes, so nothing moves when the page
 * lands. Used by each route's `loading.tsx` and by the screen sign-in shows before Munshi arrives.
 * A title that is itself data (a customer's or borrower's name) stays grey.
 */

function Block({ className, delay }: { className?: string; delay?: number }) {
    return <Skeleton delay={delay} className={cn("rounded-[22px] bg-paper-2", className)} />
}

/** The dark summary card several pages open with (Today, Month, Loans, Cash). */
function InkCard({ className, tiles }: { className?: string; tiles?: boolean }) {
    return (
        <div className={cn("rounded-[22px] bg-ink p-4", className)}>
            <Skeleton className="h-4 w-24 rounded-md bg-paper/15" />
            <Skeleton className="mt-2 h-8 w-40 rounded-lg bg-paper/15" delay={0.05} />
            {tiles ? (
                <div className="mt-4 grid grid-cols-3 gap-2">
                    {[0, 1, 2].map((i) => (
                        <Skeleton key={i} className="h-14 rounded-xl bg-paper/10" delay={0.1 + i * 0.05} />
                    ))}
                </div>
            ) : (
                <Skeleton className="mt-4 h-2 w-full rounded-full bg-paper/15" delay={0.1} />
            )}
        </div>
    )
}

function Rows({ count, className }: { count: number; className?: string }) {
    return (
        <div className="space-y-2.5">
            {Array.from({ length: count }, (_, i) => (
                <Block key={i} className={cn("h-[78px]", className)} delay={i * 0.05} />
            ))}
        </div>
    )
}

const Body = ({ children }: { children: React.ReactNode }) => <div className="space-y-4 px-4 pt-4">{children}</div>
const Line = ({ className }: { className?: string }) => <Skeleton className={cn("h-4 rounded-md bg-paper-2", className)} />

export function TodaySkeleton() {
    const { t } = useI18n()
    return (
        <>
            <PageTop title={t("todayTitle")} subtitle={<Line className="mt-1.5 w-36" />} />
            <div className="px-4 pb-4 pt-3">
                <InkCard />
            </div>
            <div className="px-4 pt-1.5">
                <Rows count={6} />
            </div>
        </>
    )
}

export function FinishSkeleton() {
    const { t } = useI18n()
    return (
        <>
            <PageTop title={t("finishTitle")} subtitle={<Line className="mt-1 w-32" />} backHref="/today" />
            <Body>
                <Block className="h-36 rounded-[24px]" />
                <Block className="h-24 rounded-[24px]" delay={0.05} />
                <Block className="h-14 rounded-2xl" delay={0.1} />
            </Body>
        </>
    )
}

export function MonthSkeleton() {
    const { t } = useI18n()
    return (
        <>
            <PageTop title={t("monthTitle")} />
            <Body>
                <Block className="h-11 rounded-2xl" />
                <InkCard tiles />
                <Block className="h-11 rounded-2xl" delay={0.05} />
                <Rows count={5} className="h-14 rounded-2xl" />
            </Body>
        </>
    )
}

export function LoansSkeleton() {
    const { t } = useI18n()
    return (
        <>
            <PageTop title={t("loansTitle")} />
            <Body>
                <InkCard tiles />
                <div className="grid grid-cols-3 gap-2.5">
                    {[0, 1, 2].map((i) => (
                        <Block key={i} className="h-[84px] rounded-2xl" delay={i * 0.05} />
                    ))}
                </div>
                <Block className="h-11 rounded-2xl" />
                <Rows count={3} className="h-24" />
            </Body>
        </>
    )
}

export function NewLoanSkeleton() {
    const { t } = useI18n()
    return (
        <>
            <PageTop title={t("newLoan")} backHref="/loans" />
            <Body>
                <Block className="h-[420px] rounded-[24px]" />
                <Block className="h-14 rounded-2xl" delay={0.05} />
            </Body>
        </>
    )
}

export function CalculatorSkeleton() {
    const { t } = useI18n()
    return (
        <>
            <PageTop title={t("calculator")} backHref="/loans" />
            <Body>
                <Block className="h-72 rounded-[24px]" />
                <Block className="h-48 rounded-[24px]" delay={0.05} />
            </Body>
        </>
    )
}

export function LoanDetailSkeleton() {
    return (
        <>
            <PageTop title={<Skeleton className="h-6 w-40 rounded-md bg-paper-2" />} subtitle={<Line className="mt-1 w-52" />} backHref="/loans" />
            <Body>
                <InkCard />
                <Block className="h-14 rounded-2xl" delay={0.05} />
                <Block className="h-64 rounded-[24px]" delay={0.1} />
            </Body>
        </>
    )
}

export function CashSkeleton() {
    const { t } = useI18n()
    return (
        <>
            <PageTop title={t("cashOnHand")} subtitle={<Line className="mt-1 w-28" />} backHref="/loans" />
            <Body>
                <InkCard />
                <Block className="h-64 rounded-[24px]" delay={0.05} />
            </Body>
        </>
    )
}

export function CustomerSkeleton() {
    return (
        <>
            <PageTop title={<Skeleton className="h-6 w-40 rounded-md bg-paper-2" />} subtitle={<Line className="mt-1 w-24" />} backHref="/manage" />
            <Body>
                <div className="grid grid-cols-2 gap-2.5">
                    <Block className="h-[84px] rounded-2xl" />
                    <Block className="h-[84px] rounded-2xl" delay={0.05} />
                </div>
                <Block className="h-11 rounded-2xl" delay={0.1} />
                <Block className="h-80 rounded-[24px]" delay={0.15} />
            </Body>
        </>
    )
}

export function ManageSkeleton() {
    const { t } = useI18n()
    return (
        <>
            <PageTop title={t("manageTitle")} subtitle={<Line className="mt-1 w-20" />} backHref="/more" />
            <Body>
                <div className="grid grid-cols-3 gap-2.5">
                    {[0, 1, 2].map((i) => (
                        <Block key={i} className="h-[92px] rounded-2xl" delay={i * 0.05} />
                    ))}
                </div>
                <Line className="w-48" />
                <Rows count={6} className="h-16 rounded-[20px]" />
            </Body>
        </>
    )
}

export function MoreSkeleton() {
    const { t } = useI18n()
    return (
        <>
            <PageTop title={t("navMore")} />
            <Body>
                <Block className="h-[88px] rounded-[24px]" />
                <Block className="h-[340px] rounded-[24px]" delay={0.05} />
            </Body>
        </>
    )
}

export function ScanSkeleton() {
    const { t } = useI18n()
    return (
        <>
            <PageTop title={t("scanTitle")} backHref="/more" />
            <Body>
                <Line className="w-36" />
                <div className="grid grid-cols-3 gap-2">
                    {[0, 1, 2].map((i) => (
                        <Block key={i} className="h-[88px] rounded-2xl" delay={i * 0.05} />
                    ))}
                </div>
                <Block className="h-60 rounded-[24px]" delay={0.1} />
            </Body>
        </>
    )
}

export function SettingsSkeleton() {
    const { t } = useI18n()
    return (
        <>
            <PageTop title={t("settingsTitle")} backHref="/more" />
            <Body>
                {[0, 1, 2, 3].map((i) => (
                    <Block key={i} className="h-28 rounded-[24px]" delay={i * 0.05} />
                ))}
            </Body>
        </>
    )
}

export function RechargeSkeleton() {
    const { t } = useI18n()
    return (
        <>
            <PageTop title={t("rcTitle")} subtitle={<Line className="mt-1.5 w-36" />} backHref="/more" />
            <div className="space-y-4 px-4 pt-3">
                <div className="grid grid-cols-2 gap-2">
                    <Block className="h-12 rounded-2xl" />
                    <Block className="h-12 rounded-2xl" delay={0.05} />
                </div>
                <Block className="h-12 rounded-2xl" delay={0.1} />
                <InkCard tiles />
                <div className="grid grid-cols-4 gap-2">
                    {Array.from({ length: 9 }, (_, i) => (
                        <Block key={i} className={cn("h-14 rounded-2xl", i === 8 && "col-span-4")} delay={0.05 * (i % 4)} />
                    ))}
                </div>
                <div className="grid grid-cols-3 gap-2">
                    {[0, 1, 2].map((i) => (
                        <Block key={i} className="h-16 rounded-2xl" delay={i * 0.05} />
                    ))}
                </div>
            </div>
        </>
    )
}

/** Munshi has its own header (title, tagline, history and Talk/Type) and the orb, not a PageTop. */
export function MunshiSkeleton() {
    const { t } = useI18n()
    return (
        <div className="flex h-[calc(100dvh-78px-env(safe-area-inset-bottom))] flex-col">
            <header className="flex items-center justify-between gap-3 px-4 pt-safe">
                <div className="min-w-0 pt-4">
                    <h1 className="text-[22px] font-semibold leading-tight text-ink">{t("munshi")}</h1>
                    <p className="truncate whitespace-nowrap text-[13px] text-ink-3">{t("munshiTagline")}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5 pt-4">
                    <Skeleton className="h-10 w-10 rounded-full bg-paper-2" />
                    <Skeleton className="h-10 w-[82px] rounded-full bg-paper-2" />
                </div>
            </header>
            <div className="flex flex-1 flex-col items-center justify-center gap-6 px-5">
                <Skeleton className="size-[min(62vw,34dvh,270px)] rounded-full bg-paper-2" />
                <Line className="w-32" />
                <div className="w-full max-w-md space-y-2">
                    <Line className="mx-auto w-4/5" />
                    <Line className="mx-auto w-3/5" />
                </div>
            </div>
        </div>
    )
}

/** The skeleton for a destination path, for the screen shown the moment sign-in succeeds. */
export function skeletonFor(path: string): React.ComponentType {
    const p = path.split("?")[0]!
    if (p.startsWith("/today/finish")) return FinishSkeleton
    if (p.startsWith("/today")) return TodaySkeleton
    if (p.startsWith("/month")) return MonthSkeleton
    if (p === "/loans/new") return NewLoanSkeleton
    if (p === "/loans/calculator") return CalculatorSkeleton
    if (p.startsWith("/loans/")) return LoanDetailSkeleton
    if (p.startsWith("/loans")) return LoansSkeleton
    if (p.startsWith("/cash")) return CashSkeleton
    if (p.startsWith("/customers/")) return CustomerSkeleton
    if (p.startsWith("/manage")) return ManageSkeleton
    if (p.startsWith("/more")) return MoreSkeleton
    if (p.startsWith("/scan")) return ScanSkeleton
    if (p.startsWith("/settings")) return SettingsSkeleton
    if (p.startsWith("/recharge")) return RechargeSkeleton
    return MunshiSkeleton
}
