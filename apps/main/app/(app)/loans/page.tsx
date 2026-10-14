import type { Metadata } from "next"
import { fetchLoans } from "@/actions/loan.action"
import { fetchSettings } from "@/actions/settings.action"
import { nepalToday } from "@/lib/today"
import { LoansClient } from "@/components/loans/loans-client"

export const metadata: Metadata = { title: "Loans" }

export default async function LoansPage() {
    const [loans, settings] = await Promise.all([fetchLoans(), fetchSettings()])
    return <LoansClient loans={loans} today={nepalToday()} basis={settings.interestBasis} defaultCompounding={settings.compoundingEnabled} />
}
