import type { NextRequest } from 'next/server'
import { withAuth } from './auth'

// Helper to get the session in Next.js middleware (Edge Runtime compatible).
// Note: Better Auth's full server SDK is not edge-compatible; use this lightweight check.
export async function authMiddleware(request: NextRequest) {
    return withAuth((a) => a.api.getSession({ headers: request.headers }))
}
