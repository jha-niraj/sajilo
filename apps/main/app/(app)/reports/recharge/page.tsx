import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { adToBs } from "@repo/calendar"
import { fetchRecharge } from "@/actions/recharge.action"
import { getSession } from "@/lib/session"
import { nepalToday } from "@/lib/today"
import { RechargeReport } from "@/components/reports/recharge-report"

export const metadata: Metadata = { title: "Recharge report" }

/** `?m=2083-07` is the BS month; no month (or a bad one) means this month. */
export default async function RechargeReportPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
    const session = await getSession()
    if (!session) redirect("/api/session/clear")
    const now = adToBs(nepalToday())
    const hit = /^(\d{4})-(\d{1,2})$/.exec((await searchParams).m ?? "")
    let year = hit ? Number(hit[1]) : now.year
    let month = hit ? Number(hit[2]) : now.month
    if (month < 1 || month > 12 || year * 12 + month > now.year * 12 + now.month || year < 2070) {
        year = now.year
        month = now.month
    }
    const data = await fetchRecharge(year, month)
    return <RechargeReport key={`${year}-${month}`} data={data} year={year} month={month} now={now} name={session.user.name ?? ""} />
}
