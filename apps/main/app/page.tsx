import type { Metadata } from "next"
import { DayPanels } from "@/components/landing/day-panels"
import { Features } from "@/components/landing/features"
import { Hero } from "@/components/landing/hero"
import { Closing } from "@/components/landing/closing"
import { SiteShell } from "@/components/landing/site-shell"
import { Story } from "@/components/landing/story"
import { Who } from "@/components/landing/who"

export const metadata: Metadata = {
    title: { absolute: "Sajilo - a bookkeeper you talk to" },
    description: "My father collects daily savings from shop to shop in Nepal. Sajilo lets him say each entry out loud, in Nepali, Maithili or Hindi, and keeps the book for him - even with no signal.",
    robots: { index: true, follow: true },
}

// The public landing page. Signed-in visitors never see it: middleware sends them to /munshi.
export default function Home() {
    return (
        <SiteShell>
            <Hero />
            <Story />
            <Features />
            <DayPanels />
            <Who />
            <Closing />
        </SiteShell>
    )
}
