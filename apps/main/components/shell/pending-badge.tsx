"use client"

import { CloudUpload } from "lucide-react"
import { cn } from "@repo/ui/lib/utils"
import { useI18n } from "@/lib/i18n"

/** Marks something saved on this phone that hasn't reached the server yet. */
export function PendingBadge({ className }: { className?: string }) {
    const { t } = useI18n()
    return (
        <span className={cn("inline-flex items-center gap-1 rounded-full bg-flag-soft px-2.5 py-1 text-[12px] font-semibold text-[#8a5a08]", className)}>
            <CloudUpload className="h-3.5 w-3.5" /> {t("waitingToSync")}
        </span>
    )
}
