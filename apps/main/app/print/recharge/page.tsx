import { redirect } from "next/navigation"

/** The report moved to /reports/recharge (phone view, print, PDF and share in one place). */
export default async function PrintRechargePage({ searchParams }: { searchParams: Promise<{ y?: string; m?: string }> }) {
    const sp = await searchParams
    redirect(sp.y && sp.m ? `/reports/recharge?m=${sp.y}-${sp.m.padStart(2, "0")}` : "/reports/recharge")
}
