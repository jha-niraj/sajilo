"use client"

/** Phone photos are 4-12 MB. Shrink to a sharp, readable JPEG before upload. */
export async function compressImage(file: File, maxSide = 2200, quality = 0.85): Promise<File> {
    if (!file.type.startsWith("image/") || file.type === "image/gif") return file
    try {
        const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" })
        const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
        const w = Math.round(bitmap.width * scale)
        const h = Math.round(bitmap.height * scale)
        const canvas = document.createElement("canvas")
        canvas.width = w
        canvas.height = h
        canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h)
        bitmap.close()
        const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", quality))
        if (!blob || blob.size >= file.size) return file
        return new File([blob], (file.name || "page").replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" })
    } catch {
        return file
    }
}
