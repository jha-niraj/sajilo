import type { Metadata } from "next"
import { About } from "@/components/landing/about"
import { SiteShell } from "@/components/landing/site-shell"

export const metadata: Metadata = {
    title: "About",
    description: "Why I'm building Sajilo: my father, a daily savings collector in Nepal, his ledger, and a phone that listens.",
    robots: { index: true, follow: true },
}

export default function AboutPage() {
    return (
        <SiteShell>
            <About />
        </SiteShell>
    )
}
