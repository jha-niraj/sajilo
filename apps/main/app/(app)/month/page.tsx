import type { Metadata } from "next"
import { Suspense } from "react"
import { adToBs } from "@repo/calendar"
import { fetchMonthReport } from "@/actions/report.action"
import { MonthClient } from "@/components/month/month-client"
import { nepalToday } from "@/lib/today"
import { DeadlineSlot } from "../deadline-slot"

export const metadata: Metadata = { title: "Month" }

export default async function MonthPage() {
    const bs = adToBs(nepalToday())
    const report = await fetchMonthReport(bs.year, bs.month)
    return (
        <MonthClient
            initial={report}
            max={{ year: bs.year, month: bs.month }}
            deadlineSlot={
                <Suspense fallback={null}>
                    <DeadlineSlot />
                </Suspense>
            }
        />
    )
}
