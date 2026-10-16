"use client"

import { BottomNav } from "@/components/shell/bottom-nav"
import { skeletonFor } from "@/components/skeletons/page-skeletons"

/**
 * Shown over the login screen the instant sign-in succeeds, until the destination page arrives:
 * the app's REAL frame (the bottom bar, highlighting where he is going) around that page's own
 * skeleton, so the screen moves at once instead of the PIN boxes sitting still for a cold Worker.
 */
export function LandingShell({ path }: { path: string }) {
    const Skeleton = skeletonFor(path)
    return (
        <div className="fixed inset-0 z-50 overflow-hidden bg-paper">
            <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col">
                <main className="flex-1 pb-6">
                    <Skeleton />
                </main>
                <BottomNav activePath={path} />
            </div>
        </div>
    )
}
