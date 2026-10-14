import { WifiOff } from "lucide-react"
import Link from "next/link"

export const dynamic = "force-static"

export default function OfflinePage() {
    return (
        <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-8 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-paper-2">
                <WifiOff className="h-8 w-8 text-ink-2" />
            </span>
            <h1 className="text-2xl font-semibold text-ink">इन्टरनेट छैन</h1>
            <p className="text-[17px] text-ink-2">यो पाना अहिले खुल्दैन। &quot;आज&quot; को सूची फोनमै सेभ छ।</p>
            <p className="text-[15px] text-ink-3">No internet. Today&apos;s list is saved on the phone.</p>
            <Link href="/today" className="mt-2 rounded-2xl bg-ink px-6 py-4 text-lg font-semibold text-paper">
                आज · Today
            </Link>
        </main>
    )
}
