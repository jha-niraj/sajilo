// Fail fast on missing required server env. Optional services (Sarvam, OpenAI, R2, Resend)
// are checked by the features that use them.
const REQUIRED = ["DATABASE_URL", "BETTER_AUTH_SECRET"] as const

if (typeof window === "undefined") {
    const missing = REQUIRED.filter((k) => !process.env[k])
    if (missing.length > 0) {
        throw new Error(`Missing required environment variables: ${missing.join(", ")}. Check apps/main/.env`)
    }
}

export {}
