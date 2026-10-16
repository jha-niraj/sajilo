/** @type {import('next').NextConfig} */
const nextConfig = {
    agentRules: false,
    transpilePackages: ["@repo/ui", "@repo/calendar", "@repo/errors", "@repo/ai", "@repo/sarvamai", "@repo/storage", "@repo/db", "@repo/auth"],
    serverExternalPackages: [],
    experimental: {
        serverActions: { bodySizeLimit: "12mb" },
        // How long the browser reuses what it fetched: a page he just left (dynamic) and prefetched
        // shells (static). Every write refreshes the page it changes, so 30 s is safe.
        staleTimes: { dynamic: 30, static: 180 },
    },
}

export default nextConfig
