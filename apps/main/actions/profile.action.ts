"use server"

import { db, eq } from "@repo/db"
import { user } from "@repo/db/schema"
import { deleteFile, isR2Configured, putObject } from "@repo/storage"
import { actionCollectorId } from "@/lib/session"
import { avatarUrl } from "@/lib/avatar"

const MAX_BYTES = 5 * 1024 * 1024
const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }

/** R2 keys live in user.image; anything else there (an http URL) is left alone. */
const isOurKey = (v: string | null | undefined): v is string => !!v && v.startsWith("avatars/")

export async function uploadProfilePhoto(formData: FormData): Promise<{ url: string } | { error: "no_storage" | "bad_file" | "too_big" }> {
    const userId = await actionCollectorId()
    if (!isR2Configured()) return { error: "no_storage" }
    const file = formData.get("file")
    if (!(file instanceof File) || !TYPES[file.type]) return { error: "bad_file" }
    if (file.size > MAX_BYTES) return { error: "too_big" }

    const key = `avatars/${userId}/${Date.now()}.${TYPES[file.type]}`
    await putObject(key, new Uint8Array(await file.arrayBuffer()), file.type)

    const old = await db.query.user.findFirst({ where: (u, { eq }) => eq(u.id, userId), columns: { image: true } })
    await db.update(user).set({ image: key }).where(eq(user.id, userId))
    if (isOurKey(old?.image)) await deleteFile(old.image).catch((e) => console.error("[avatar] old photo not deleted", e))

    return { url: avatarUrl(key)! }
}

export async function removeProfilePhoto(): Promise<void> {
    const userId = await actionCollectorId()
    const old = await db.query.user.findFirst({ where: (u, { eq }) => eq(u.id, userId), columns: { image: true } })
    await db.update(user).set({ image: null }).where(eq(user.id, userId))
    if (isOurKey(old?.image)) await deleteFile(old.image).catch((e) => console.error("[avatar] photo not deleted", e))
}
