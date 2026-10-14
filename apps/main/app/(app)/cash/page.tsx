import type { Metadata } from "next"
import { fetchCashOnHand } from "@/actions/loan.action"
import { CashClient } from "@/components/loans/cash-client"

export const metadata: Metadata = { title: "Cash in hand" }

export default async function CashPage() {
    const cash = await fetchCashOnHand()
    return <CashClient cash={cash} />
}
