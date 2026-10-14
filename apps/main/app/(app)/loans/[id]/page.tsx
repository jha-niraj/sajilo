import { notFound } from "next/navigation"
import { fetchLoan } from "@/actions/loan.action"
import { fetchSettings } from "@/actions/settings.action"
import { LoanDetailClient } from "@/components/loans/loan-detail-client"
import { nepalToday } from "@/lib/today"

export default async function LoanPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const [loan, settings] = await Promise.all([fetchLoan(id), fetchSettings()])
    if (!loan) notFound()
    return <LoanDetailClient loan={loan} today={nepalToday()} basis={settings.interestBasis} />
}
