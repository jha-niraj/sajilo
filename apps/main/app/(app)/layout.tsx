import { requireCollectorId } from "@/lib/session"
import { BottomNav } from "@/components/shell/bottom-nav"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
    await requireCollectorId()
    return (
        <div className="mx-auto min-h-dvh w-full max-w-lg pb-[calc(6.5rem+env(safe-area-inset-bottom))]">
            {children}
            <BottomNav />
        </div>
    )
}
