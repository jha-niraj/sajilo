import type { Metadata } from "next"
import { fetchRecharge } from "@/actions/recharge.action"
import { RechargeClient } from "@/components/recharge/recharge-client"

export const metadata: Metadata = { title: "Recharge" }

export default async function RechargePage() {
    const data = await fetchRecharge()
    return <RechargeClient initial={data} />
}
