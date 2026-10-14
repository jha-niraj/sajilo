"use client"

import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@repo/ui/components/ui/sheet"
import { cn } from "@repo/ui/lib/utils"

export function BottomSheet({
    open,
    onOpenChange,
    title,
    description,
    children,
    className,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    title: string
    description?: string
    children: React.ReactNode
    className?: string
}) {
    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side="bottom"
                className={cn(
                    "mx-auto max-h-[92dvh] w-full max-w-lg rounded-t-[28px] border-line bg-paper px-5 pb-safe pt-3 [&>button:last-child]:hidden",
                    className,
                )}
            >
                <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-line" />
                <SheetTitle className="text-xl font-semibold text-ink">{title}</SheetTitle>
                {description ? (
                    <SheetDescription className="mt-1 text-[15px] text-ink-2">{description}</SheetDescription>
                ) : (
                    <SheetDescription className="sr-only">{title}</SheetDescription>
                )}
                <div className="mt-4 pb-5">{children}</div>
            </SheetContent>
        </Sheet>
    )
}
