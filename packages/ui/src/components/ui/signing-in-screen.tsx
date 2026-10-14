"use client"

import { SchoolScreen } from "./school-scene"

/*
 * Signing in and registering: the paper plane comes in from the sun and settles by the steps.
 * Shown from the moment the form succeeds until the next page takes over, so the switch never
 * goes blank. The mirror of `SigningOutScreen`.
 *
 *   sign in:   <SigningInScreen />                       "Welcome back" / "Taking you in"
 *   register:  <SigningInScreen title="Welcome aboard" note="Setting up your account" />
 */
export function SigningInScreen({ title = "Welcome back", note = "Taking you in" }: { title?: string; note?: string }) {
    return <SchoolScreen mode="arriving" title={title} note={note} />
}

export default SigningInScreen
