import type { Metadata } from "next"
import { fetchLoans } from "@/actions/loan.action"
import { LoansClient } from "@/components/loans/loans-client"

export const metadata: Metadata = { title: "Loans" }

export default async function LoansPage() {
    const loans = await fetchLoans()
    return <LoansClient loans={loans} />
}
