import type { Metadata, Viewport } from "next"
import { cookies } from "next/headers"
import { Bricolage_Grotesque, Mukta } from "next/font/google"
import "./sajilo.css"
import "@/lib/env"
import { INSTALL_CAPTURE_SCRIPT } from "@/lib/install-script"
import { Providers } from "./providers"
import type { Lang } from "@/lib/dict"

// Bricolage Grotesque for Latin text; Mukta covers Devanagari (Bricolage has no Nepali glyphs).
const bricolage = Bricolage_Grotesque({
    subsets: ["latin"],
    variable: "--font-bricolage",
    display: "swap",
})

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
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3100"),
    openGraph: {
        type: "website",
        siteName: "Sajilo",
        title: "Sajilo - सजिलो",
        description: "दैनिक बचत संकलन, सजिलै। Daily savings collection made easy.",
        images: [{ url: "/icons/icon-512.png", width: 512, height: 512, alt: "Sajilo" }],
    },
    twitter: { card: "summary", title: "Sajilo - सजिलो", images: ["/icons/icon-512.png"] },
    appleWebApp: { capable: true, title: "Sajilo", statusBarStyle: "default" },
    formatDetection: { telephone: false },
    icons: {
        icon: [
            { url: "/favicon.ico", sizes: "16x16 32x32 48x48" },
            { url: "/icons/favicon-48.png", sizes: "48x48", type: "image/png" },
            { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
        ],
        apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
    },
    robots: { index: false, follow: false },
}

export const viewport: Viewport = {
    themeColor: "#faf6ee",
    // Light only. Chrome's Auto Dark Theme and Samsung Internet's force dark skip pages that say so;
    // without it they repaint the page and dark-on-dark loaders and text disappear.
    colorScheme: "only light",
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    viewportFit: "cover",
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    const jar = await cookies()
    const lang: Lang = jar.get("sajilo.lang")?.value === "ne" ? "ne" : "en"
    return (
        <html lang={lang} className={`${bricolage.variable} ${mukta.variable}`}>
            <body className="min-h-dvh bg-paper text-ink antialiased">
                <script dangerouslySetInnerHTML={{ __html: INSTALL_CAPTURE_SCRIPT }} />
                <Providers lang={lang}>{children}</Providers>
            </body>
        </html>
    )
}
