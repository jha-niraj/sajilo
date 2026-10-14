/** Same-origin address for the signed-in user's photo; the key in it busts the cache on change. */
export function avatarUrl(image: string | null | undefined): string | null {
    if (!image) return null
    if (/^https?:\/\//.test(image)) return image
    return `/api/avatar?v=${encodeURIComponent(image.split("/").pop() ?? "")}`
}
