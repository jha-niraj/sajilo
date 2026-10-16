import type { Metadata } from "next"
import { listCustomers } from "@/actions/customer.action"
import { recentScans } from "@/actions/scan.action"
import { fetchSettings } from "@/actions/settings.action"
import { ScanClient } from "@/components/scan/scan-client"
import { nepalToday } from "@/lib/today"
import type { ScanKind } from "@/lib/scan/structure"

export const metadata: Metadata = { title: "Scan" }

export default async function ScanPage({ searchParams }: { searchParams: Promise<{ kind?: string; id?: string }> }) {
    const { kind, id } = await searchParams
    const initialKind: ScanKind = kind === "collections" || kind === "loans" ? kind : "customers"
    const [customers, settings, recent] = await Promise.all([listCustomers(), fetchSettings(), recentScans()])
    return (
        <ScanClient
            initialKind={initialKind}
            initialId={id && /^[0-9a-f-]{36}$/.test(id) ? id : null}
            initialRecent={recent}
            customers={customers.filter((c) => c.isActive)}
            today={nepalToday()}
            defaultRate={settings.defaultRatePer100}
        />
    )
}
