import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
    return {
        id: "/",
        name: "Sajilo - सजिलो",
        short_name: "Sajilo",
        description: "दैनिक बचत संकलन, सजिलै। Daily savings collection made easy.",
        start_url: "/today",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#faf6ee",
        theme_color: "#faf6ee",
        lang: "en",
        categories: ["finance", "productivity"],
        icons: [
            { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
            { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
            { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
        shortcuts: [
            { name: "Today", url: "/today", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
            { name: "Month", url: "/month", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
        ],
    }
}
