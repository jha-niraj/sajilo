import type { Metadata } from "next"
import { fetchBorrowers } from "@/actions/loan.action"
import { fetchDeadline } from "@/actions/report.action"
import { fetchSettings } from "@/actions/settings.action"
import { NewLoanClient } from "@/components/loans/new-loan-client"
import { nepalToday } from "@/lib/today"

export const metadata: Metadata = { title: "New loan" }

export default async function NewLoanPage() {
    const [borrowers, settings, deadline] = await Promise.all([fetchBorrowers(), fetchSettings(), fetchDeadline()])
    return (
        <NewLoanClient
            borrowers={borrowers}
            today={nepalToday()}
            defaultRate={settings.defaultRatePer100}
            defaultCompounding={settings.compoundingEnabled}
            basis={settings.interestBasis}
            suggestedDue={deadline.deadline}
        />
    )
}
