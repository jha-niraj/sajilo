/** @type {import('next').NextConfig} */
const nextConfig = {
    agentRules: false,
    transpilePackages: ["@repo/ui", "@repo/calendar", "@repo/errors", "@repo/ai", "@repo/sarvamai", "@repo/storage", "@repo/db", "@repo/auth"],
    serverExternalPackages: [],
    experimental: {
        serverActions: { bodySizeLimit: "12mb" },
    },
}

export default nextConfig
