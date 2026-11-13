import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { getSettings } from "@/lib/collection/server"
import { activeCustomers, knownNames } from "@/lib/munshi/agenttools/resolve"
import { transcribe } from "@/lib/munshi/speech"

const MAX_AUDIO_BYTES = 6 * 1024 * 1024

/** Speech to text only (Saaras), for the voice loop: the phone decides what the words mean (lib/voice). */
export async function POST(req: Request) {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
    const collectorId = session.user.id
    const form = await req.formData()
    const audio = form.get("audio")
    if (!(audio instanceof Blob) || audio.size < 800 || audio.size > MAX_AUDIO_BYTES) return NextResponse.json({ text: "" })
    try {
        const [settings, names, customers] = await Promise.all([getSettings(collectorId), knownNames({ collectorId }), activeCustomers({ collectorId })])
        const terms = [...names.customers, ...customers.flatMap((c) => c.aliases), ...names.borrowers]
        const heard = await transcribe(audio, settings.language === "ne" ? "ne" : "en", terms)
        return NextResponse.json({ text: heard.text, language: heard.language })
    } catch (e) {
        console.error("[munshi] hear failed", e)
        return NextResponse.json({ text: "", error: "failed" })
    }
}
