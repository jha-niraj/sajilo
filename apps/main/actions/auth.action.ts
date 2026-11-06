"use server"

import { z } from "zod"
import { headers } from "next/headers"
import { auth } from "@repo/auth"
import { db, eq } from "@repo/db"
import { user, collectorSettings } from "@repo/db/schema"
import { normalizePhone, phoneTempEmail } from "@/lib/phone"

const signupInput = z.object({
    name: z.string().trim().min(1).max(80),
    phone: z.string(),
    pin: z.string().regex(/^\d{4}$/),
    language: z.enum(["ne", "en", "mai"]).default("en"),
})

export type SignupResult = { ok: true; phone: string } | { ok: false; error: "invalid_phone" | "phone_taken" | "invalid" }

export async function signUpCollector(input: z.input<typeof signupInput>): Promise<SignupResult> {
    const parsed = signupInput.safeParse(input)
    if (!parsed.success) return { ok: false, error: "invalid" }
    const phone = normalizePhone(parsed.data.phone)
    if (!phone) return { ok: false, error: "invalid_phone" }

    const existing = await db.query.user.findFirst({ where: eq(user.phoneNumber, phone) })
    if (existing) return { ok: false, error: "phone_taken" }

    // Creates the account AND signs it in: better-auth's nextCookies() puts the session cookie on
    // this action's reply, so the browser doesn't make a second sign-in request.
    const created = await auth.api.signUpEmail({
        body: { email: phoneTempEmail(phone), password: parsed.data.pin, name: parsed.data.name },
        headers: await headers(),
    })
    const userId = created.user.id

    await db.batch([
        db.update(user).set({ phoneNumber: phone }).where(eq(user.id, userId)),
        db.insert(collectorSettings).values({ userId, language: parsed.data.language }).onConflictDoNothing(),
    ])

    return { ok: true, phone }
}

/** Whether a number already has an account (sign-up uses this to send existing users to login). */
export async function phoneHasAccount(phone: string): Promise<boolean> {
    const e164 = normalizePhone(phone)
    if (!e164) return false
    const existing = await db.query.user.findFirst({ where: eq(user.phoneNumber, e164), columns: { id: true } })
    return Boolean(existing)
}
