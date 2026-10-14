"use client"

import { SchoolScreen } from "./school-scene"

/*
 * Signing out: the paper plane lifts from the yard and flies out past the bell tower toward the
 * setting sun. The scene is `SchoolScene` (school-scene.tsx), shared with the sign-in and
 * register screens and the loader, where the plane arrives instead.
 *
 * Shown from the click until the redirect lands, so the wait is never a dead button. See the
 * sign-out handlers in each app's sidebar for why it is rendered through a portal.
 */
export function SigningOutScreen({ label = "Signing you out", note = "See you soon" }: { label?: string; note?: string }) {
    return <SchoolScreen mode="leaving" title={label} note={note} />
}

export default SigningOutScreen
