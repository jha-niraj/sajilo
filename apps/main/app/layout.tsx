import type { Metadata, Viewport } from "next"
import { cookies } from "next/headers"
import { Mukta } from "next/font/google"
import "./sajilo.css"
import "@/lib/env"
import { Providers } from "./providers"
import type { Lang } from "@/lib/dict"

const mukta = Mukta({
    subsets: ["devanagari", "latin"],
    weight: ["400", "500", "600", "700"],
    variable: "--font-mukta",
    display: "swap",
})

export const metadata: Metadata = {
    title: { default: "Sajilo", template: "%s · Sajilo" },
    description: "दैनिक बचत संकलन, सजिलै। Daily savings collection made easy.",
    applicationName: "Sajilo",
    appleWebApp: { capable: true, title: "Sajilo", statusBarStyle: "default" },
    formatDetection: { telephone: false },
    icons: {
        icon: [
            { url: "/icons/favicon-48.png", sizes: "48x48", type: "image/png" },
            { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
        ],
        apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
    },
    robots: { index: false, follow: false },
}

export const viewport: Viewport = {
    themeColor: "#faf6ee",
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    viewportFit: "cover",
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    const jar = await cookies()
    const lang: Lang = jar.get("sajilo.lang")?.value === "ne" ? "ne" : "en"
    return (
        <html lang={lang} className={mukta.variable}>
            <body className="min-h-dvh bg-paper text-ink antialiased">
                <Providers lang={lang}>{children}</Providers>
            </body>
        </html>
    )
}
