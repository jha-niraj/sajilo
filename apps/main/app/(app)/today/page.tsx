import type { Metadata } from "next"
import { Suspense } from "react"
import { TodayClient } from "@/components/today/today-client"
import { DeadlineSlot } from "../deadline-slot"

export const metadata: Metadata = { title: "Today" }

export default function TodayPage() {
    return (
        <TodayClient
            deadlineSlot={
                <Suspense fallback={null}>
                    <DeadlineSlot />
                </Suspense>
            }
        />
    )
}
