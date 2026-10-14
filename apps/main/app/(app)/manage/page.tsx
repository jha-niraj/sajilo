import type { Metadata } from "next"
import { Suspense } from "react"
import { listCustomers } from "@/actions/customer.action"
import { ManageClient } from "@/components/manage/manage-client"
import { nepalToday } from "@/lib/today"

export const metadata: Metadata = { title: "Customers" }

export default async function ManagePage() {
    const customers = await listCustomers()
    return (
        <Suspense>
            <ManageClient initial={customers} today={nepalToday()} />
        </Suspense>
    )
}
