/* Sajilo service worker.
 * - Static build files (hashed): cache first, forever.
 * - Pages: network first (4s), then the last copy saved on the phone, then /offline.
 * - Everything else (server actions, auth): straight to the network. Marks made offline are
 *   kept in IndexedDB by the app and sent later, not by this worker.
 */
const VERSION = "v1"
const STATIC_CACHE = `sajilo-static-${VERSION}`
const PAGE_CACHE = `sajilo-pages-${VERSION}`
const PRECACHE = ["/offline", "/icons/icon-192.png", "/icons/icon-512.png", "/manifest.webmanifest"]
const PAGE_TIMEOUT_MS = 4000

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches
            .open(PAGE_CACHE)
            .then((cache) => cache.addAll(PRECACHE))
            .then(() => self.skipWaiting()),
    )
})

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches
            .keys()
            .then((keys) => Promise.all(keys.filter((k) => !k.endsWith(VERSION)).map((k) => caches.delete(k))))
            .then(() => self.clients.claim()),
    )
})

function timeout(ms) {
    return new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms))
}

async function cacheFirst(request) {
    const cached = await caches.match(request)
    if (cached) return cached
    const res = await fetch(request)
    if (res.ok) {
        const cache = await caches.open(STATIC_CACHE)
        cache.put(request, res.clone())
    }
    return res
}

async function pageNetworkFirst(request) {
    const cache = await caches.open(PAGE_CACHE)
    const url = new URL(request.url)
    const key = url.origin + url.pathname
    try {
        const res = await Promise.race([fetch(request), timeout(PAGE_TIMEOUT_MS)])
        if (res.ok && !res.redirected) cache.put(key, res.clone())
        return res
    } catch {
        return (
            (await cache.match(key)) ||
            (await cache.match(url.origin + "/today")) ||
            (await cache.match(url.origin + "/offline")) ||
            new Response("Offline", { status: 503 })
        )
    }
}

self.addEventListener("fetch", (event) => {
    const { request } = event
    if (request.method !== "GET") return
    const url = new URL(request.url)
    if (url.origin !== self.location.origin) return
    if (url.pathname.startsWith("/api/")) return

    if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
        event.respondWith(cacheFirst(request))
        return
    }

    if (request.mode === "navigate") {
        event.respondWith(pageNetworkFirst(request))
    }
})

self.addEventListener("message", (event) => {
    if (event.data === "skip-waiting") self.skipWaiting()
})
