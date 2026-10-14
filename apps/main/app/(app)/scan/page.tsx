import type { Metadata } from "next"
import { listCustomers } from "@/actions/customer.action"
import { fetchSettings } from "@/actions/settings.action"
import { ScanClient } from "@/components/scan/scan-client"
import { nepalToday } from "@/lib/today"
import type { ScanKind } from "@/lib/scan/structure"

export const metadata: Metadata = { title: "Scan" }

export default async function ScanPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
    const { kind } = await searchParams
    const initialKind: ScanKind = kind === "collections" || kind === "loans" ? kind : "customers"
    const [customers, settings] = await Promise.all([listCustomers(), fetchSettings()])
    return (
        <ScanClient
            initialKind={initialKind}
            customers={customers.filter((c) => c.isActive)}
            today={nepalToday()}
            defaultRate={settings.defaultRatePer100}
        />
    )
}
