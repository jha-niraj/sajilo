import { notFound } from "next/navigation"
import { adToBs } from "@repo/calendar"
import { fetchCustomerHistory } from "@/actions/collection.action"
import { HistoryClient } from "@/components/customers/history-client"
import { nepalToday } from "@/lib/today"

export default async function CustomerPage({
    params,
    searchParams,
}: {
    params: Promise<{ id: string }>
    searchParams: Promise<{ y?: string; m?: string }>
}) {
    const [{ id }, sp] = await Promise.all([params, searchParams])
    const today = nepalToday()
    const bs = adToBs(today)
    const history = await fetchCustomerHistory(id, Number(sp.y) || undefined, Number(sp.m) || undefined)
    if (!history) notFound()
    return <HistoryClient initial={history} today={today} max={{ year: bs.year, month: bs.month }} />
}
