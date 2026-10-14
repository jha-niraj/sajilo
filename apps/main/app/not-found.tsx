import Link from "next/link"

export default function NotFound() {
    return (
        <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-8 text-center">
            <p className="text-6xl font-semibold text-ink-3">४०४</p>
            <h1 className="text-2xl font-semibold text-ink">पाना भेटिएन</h1>
            <p className="text-ink-3">Page not found</p>
            <Link href="/today" className="mt-4 rounded-2xl bg-ink px-6 py-4 text-[16px] font-semibold text-paper">
                आज · Today
            </Link>
        </main>
    )
}
