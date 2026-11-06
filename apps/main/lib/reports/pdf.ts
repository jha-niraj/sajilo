"use client"

const A4 = { w: 595.28, h: 841.89 }

/**
 * Turns a report drawn on the page into an A4 PDF in the phone itself: the browser draws it (so
 * Nepali names come out right, which PDF fonts alone cannot shape), then each A4-tall slice
 * becomes a page. Breaks fall between the `[data-pdf-row]` rows when there is one near the cut.
 */
export async function reportPdf(node: HTMLElement): Promise<Blob> {
    const [{ toJpeg }, { PDFDocument }] = await Promise.all([import("html-to-image"), import("pdf-lib")])
    const scale = 2
    const width = node.offsetWidth
    const pageCss = (width * A4.h) / A4.w
    const top = node.getBoundingClientRect().top
    const rows = [...node.querySelectorAll<HTMLElement>("[data-pdf-row]")].map((r) => {
        const b = r.getBoundingClientRect()
        return { start: b.top - top, end: b.bottom - top }
    })
    const cuts: number[] = []
    let at = 0
    while (at + pageCss < node.scrollHeight) {
        let cut = at + pageCss
        const inside = rows.find((r) => r.start < cut && r.end > cut && r.start > at + pageCss * 0.6)
        if (inside) cut = inside.start
        cuts.push(cut)
        at = cut
    }

    const url = await toJpeg(node, { quality: 0.9, pixelRatio: scale, backgroundColor: "#ffffff", cacheBust: true })
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image()
        i.onload = () => resolve(i)
        i.onerror = reject
        i.src = url
    })
    const pdf = await PDFDocument.create()
    const bounds = [0, ...cuts, node.scrollHeight]
    for (let k = 0; k < bounds.length - 1; k++) {
        const from = bounds[k]!
        const h = bounds[k + 1]! - from
        const canvas = document.createElement("canvas")
        canvas.width = width * scale
        canvas.height = Math.ceil(pageCss * scale)
        const ctx = canvas.getContext("2d")!
        ctx.fillStyle = "#ffffff"
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, from * scale, width * scale, h * scale, 0, 0, width * scale, h * scale)
        const jpg = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.9))
        const embedded = await pdf.embedJpg(await jpg.arrayBuffer())
        pdf.addPage([A4.w, A4.h]).drawImage(embedded, { x: 0, y: 0, width: A4.w, height: A4.h })
    }
    return new Blob([(await pdf.save()) as BlobPart], { type: "application/pdf" })
}

export function downloadBlob(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = name
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** The phone's own share sheet (WhatsApp, Viber...) with the PDF attached; false if the phone cannot. */
export async function sharePdf(blob: Blob, name: string, title: string): Promise<boolean> {
    const file = new File([blob], name, { type: "application/pdf" })
    if (!navigator.canShare?.({ files: [file] })) return false
    try {
        await navigator.share({ files: [file], title })
    } catch (e) {
        if ((e as Error).name !== "AbortError") return false
    }
    return true
}
