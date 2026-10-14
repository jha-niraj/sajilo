import { requireCollectorId } from "@/lib/session"
import { BottomNav } from "@/components/shell/bottom-nav"
import { OfflineBar } from "@/components/shell/offline-bar"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
    await requireCollectorId()
    return (
        <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col">
            <OfflineBar />
            <div className="flex-1 pb-6">{children}</div>
            <BottomNav />
        </div>
    )
}
