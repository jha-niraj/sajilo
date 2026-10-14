import type { Metadata } from "next"
import { fetchLoans } from "@/actions/loan.action"
import { fetchSettings } from "@/actions/settings.action"
import { CalculatorClient } from "@/components/loans/calculator-client"
import { nepalToday } from "@/lib/today"

export const metadata: Metadata = { title: "Calculator" }

export default async function CalculatorPage() {
    const [loans, settings] = await Promise.all([fetchLoans(), fetchSettings()])
    return (
        <CalculatorClient
            loans={loans.filter((l) => l.status === "active")}
            today={nepalToday()}
            defaultRate={settings.defaultRatePer100}
            defaultCompounding={settings.compoundingEnabled}
            basis={settings.interestBasis}
        />
    )
}
