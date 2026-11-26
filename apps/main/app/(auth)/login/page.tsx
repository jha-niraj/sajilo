import type { Metadata } from "next"
import { LoginClient } from "./login-client"

export const metadata: Metadata = { title: "Sign in" }

// Signed-in visitors never reach this: middleware sends them to /munshi, and a stale cookie is
// cleared by /api/session/clear, which lands back here.
export default function LoginPage() {
    return <LoginClient />
}
