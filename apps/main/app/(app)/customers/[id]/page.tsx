import { notFound } from "next/navigation"
import { adToBs } from "@repo/calendar"
import { fetchCustomerHistory } from "@/actions/collection.action"
import { HistoryClient } from "@/components/customers/history-client"
import { nepalToday } from "@/lib/today"
import { requireCollectorId } from "@/lib/session"
import { customerRechargeOwed } from "@/lib/recharge/server"

export default async function CustomerPage({
    params,
    searchParams,
}: {
    params: Promise<{ id: string }>
    searchParams: Promise<{ y?: string; m?: string; from?: string }>
}) {
    const [{ id }, sp] = await Promise.all([params, searchParams])
    const today = nepalToday()
    const bs = adToBs(today)
    const [history, rechargeOwed] = await Promise.all([
        fetchCustomerHistory(id, Number(sp.y) || undefined, Number(sp.m) || undefined),
        requireCollectorId().then((c) => customerRechargeOwed(c, id)),
    ])
    if (!history) notFound()
    const backHref = sp.from === "today" ? "/today" : sp.from === "month" ? "/month" : "/manage"
    return <HistoryClient initial={history} today={today} max={{ year: bs.year, month: bs.month }} backHref={backHref} rechargeOwed={rechargeOwed} />
}
