"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "@/components/app-link"
import { AnimatePresence, motion } from "framer-motion"
import { toast } from "sonner"
import { ArrowUp, Camera, Mic, Square, UserPlus, UserRoundX, ChartColumnBig, TrendingUp, HandCoins, Trash2, WifiOff, X } from "lucide-react"
import { NewChatIcon, PastChatsIcon, TalkIcon, TypeIcon } from "./munshi-icons"
import { replyParts, stripMarkdown } from "@/lib/munshi/plain-text"
import { useRouter } from "next/navigation"
import { toNepalDateStr } from "@repo/calendar"
import { useConfirm } from "@repo/ui/components/ui/use-confirm"
import { BottomSheet } from "@/components/bottom-sheet"
import { setReachable, useOnline } from "@/lib/offline/network"
import { cn } from "@repo/ui/lib/utils"
import { Loader } from "@repo/ui/components/ui/loader"
import { Textarea } from "@repo/ui/components/ui/textarea"
import { ScrollArea } from "@repo/ui/components/ui/scroll-area"
import { useI18n } from "@/lib/i18n"
import { refreshDay } from "@/lib/offline/sync"
import { confirmProposal, deleteConversation, listConversations, munshiSpeak, saveConversation } from "@/actions/munshi.action"
import type { MunshiConversationSummary, MunshiMessage, MunshiStreamFrame, MunshiTurnResult, Proposal } from "@/lib/munshi/types"
import type { DictKey } from "@/lib/dict"
import { Orb, type OrbState } from "./orb"
import { ProposalCard } from "./proposal-card"
import { useVoiceSession } from "./use-voice-session"
import { useDictation } from "./use-dictation"
import { TypingDots, Waveform } from "./waveform"
import { useVoiceLedger } from "./use-voice-ledger"
import { useOfflineVoice, usePendingClips } from "./use-offline-voice"
import { useLiveQuery } from "dexie-react-hooks"
import { idb } from "@/lib/offline/store"
import { REPLIES } from "@/lib/voice/replies"
import { speakLocally as speakLocallyNow } from "@/lib/voice/local"
import { ByHandButton, ByHandSheet, UndoBar, VoiceCards } from "./voice-cards"
import { nepalToday } from "@/lib/today"
import type { VoiceBook, VoiceCard } from "@/lib/voice/engine"
import type { Who } from "@/lib/voice/parse"

const SUGGESTIONS: DictKey[] = ["suggest1", "suggest2", "suggest3", "suggest4"]

const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now() + Math.random()))

function munshiUrl(id: string | null, mode: "voice" | "chat") {
    const q = new URLSearchParams()
    if (id) q.set("c", id)
    if (mode === "chat") q.set("mode", "chat")
    const qs = q.toString()
    return qs ? `/munshi?${qs}` : "/munshi"
}

export function MunshiClient({
    userName,
    hasCustomers: initialHasCustomers,
    welcome,
    initialMode = "voice",
    conversationId,
    initialMessages,
}: {
    userName: string
    hasCustomers: boolean
    welcome: boolean
    initialMode?: "voice" | "chat"
    conversationId?: string
    initialMessages?: MunshiMessage[]
}) {
    const { t, lang } = useI18n()
    const router = useRouter()
    const ledger = useVoiceLedger({ today: nepalToday(), lang: lang === "ne" ? "ne" : lang === "mai" ? "mai" : "en" })
    const [byHand, setByHand] = useState(false)
    const [misses, setMisses] = useState(0)
    const [showUnpaid, setShowUnpaid] = useState(false)
    const online = useOnline()
    const [mode, setMode] = useState<"voice" | "chat">(initialMode)
    const [convId, setConvId] = useState<string | null>(conversationId ?? null)
    const [historyOpen, setHistoryOpen] = useState(false)
    const firstName = userName.split(" ")[0] ?? ""
    const [messages, setMessages] = useState<MunshiMessage[]>(() =>
        initialMessages?.length
            ? initialMessages
            : welcome || !initialHasCustomers
              ? [{ id: newId(), role: "assistant", content: t("welcomeMunshi", { name: firstName }), at: Date.now() }]
              : [],
    )
    const [busy, setBusy] = useState(false)
    // The assistant message whose text is still arriving (chat streams; voice gets the whole reply).
    const [streamingId, setStreamingId] = useState<string | null>(null)
    const [confirming, setConfirming] = useState<string | null>(null)
    const [hasCustomers, setHasCustomers] = useState(initialHasCustomers)
    const [transcribing, setTranscribing] = useState(false)
    const messagesRef = useRef(messages)
    messagesRef.current = messages

    const hasUserMessage = messages.some((m) => m.role === "user")

    // The chat gets its id (and its URL) with his first message, so a refresh reopens it.
    useEffect(() => {
        if (hasUserMessage && !convId) {
            const id = newId()
            setConvId(id)
            window.history.replaceState(null, "", munshiUrl(id, mode))
        }
    }, [hasUserMessage, convId, mode])

    const convIdRef = useRef(convId)
    convIdRef.current = convId
    const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const saveNow = useCallback(async () => {
        if (saveTimer.current) clearTimeout(saveTimer.current)
        saveTimer.current = null
        const id = convIdRef.current
        if (!id || !messagesRef.current.some((m) => m.role === "user")) return
        await saveConversation(id, messagesRef.current).catch(() => {})
    }, [])
    useEffect(() => {
        if (!convId || !hasUserMessage) return
        if (saveTimer.current) clearTimeout(saveTimer.current)
        saveTimer.current = setTimeout(() => void saveNow(), 500)
    }, [messages, convId, hasUserMessage, saveNow])

    useEffect(() => {
        const onHide = () => document.visibilityState === "hidden" && void saveNow()
        document.addEventListener("visibilitychange", onHide)
        return () => document.removeEventListener("visibilitychange", onHide)
    }, [saveNow])

    const switchMode = (m: "voice" | "chat") => {
        if (m === "chat") voice.stop()
        setMode(m)
        window.history.replaceState(null, "", munshiUrl(convIdRef.current, m))
    }

    const pending = useMemo(() => messages.flatMap((m) => m.proposals ?? []).filter((p) => p.status === "pending"), [messages])

    const setProposalStatus = useCallback((id: string, status: Proposal["status"]) => {
        setMessages((ms) => {
            if (status === "done" && ms.some((m) => m.proposals?.some((p) => p.id === id && p.kind === "add_customer"))) setHasCustomers(true)
            return ms.map((m) => (m.proposals?.some((p) => p.id === id) ? { ...m, proposals: m.proposals.map((p) => (p.id === id ? { ...p, status } : p)) } : m))
        })
        if (status === "done") void refreshDay()
    }, [])

    const applyResult = useCallback(
        (res: MunshiTurnResult, userText: string | undefined, via?: "voice", streamedId?: string) => {
            for (const r of res.resolved) setProposalStatus(r.id, r.status)
            if (res.error === "no_speech") {
                toast(t("didntHear"))
                return
            }
            // A reply that already streamed in keeps its text; it only gains its cards (or an error note).
            if (streamedId) {
                setMessages((ms) =>
                    ms.map((m) =>
                        m.id === streamedId
                            ? { ...m, content: res.error ? `${m.content}\n\n${t("munshiError")}` : res.reply || m.content, proposals: res.proposals }
                            : m,
                    ),
                )
                return
            }
            const additions: MunshiMessage[] = []
            if (userText) additions.push({ id: newId(), role: "user", content: userText, at: Date.now(), ...(via ? { via } : {}) })
            const reply = res.error ? (res.error === "no_llm" ? t("noLlm") : t("munshiError")) : res.reply
            if (reply || res.proposals.length) {
                additions.push({ id: newId(), role: "assistant", content: reply, proposals: res.proposals, at: Date.now() })
            }
            setMessages((ms) => [...ms, ...additions])
        },
        [setProposalStatus, t],
    )

    // Bumped when a new chat starts, so a reply still on its way doesn't land in the new chat.
    const chatGen = useRef(0)

    // A card he confirmed or cancelled with the buttons leaves no words in the chat, so its outcome rides
    // along with the reply that proposed it; otherwise Munshi still thinks it is waiting and brings it up again.
    const history = () =>
        messagesRef.current.map(({ role, content, id, at, proposals }) => {
            const outcomes = (proposals ?? [])
                .filter((p) => p.status !== "pending")
                .map((p) => `[card "${p.title}": ${p.status === "done" ? "saved" : p.status === "cancelled" ? "cancelled by him" : "failed to save"}]`)
            return { role, content: outcomes.length ? `${content}\n${outcomes.join("\n")}` : content, id, at }
        })
    const pendingNow = () => messagesRef.current.flatMap((m) => m.proposals ?? []).filter((p) => p.status === "pending")

    const sendText = useCallback(
        async (text: string, speakReply: boolean, opts: { addUser?: boolean; play?: boolean } = {}): Promise<MunshiTurnResult | null> => {
            const clean = text.trim()
            if (!clean || (busy && opts.addUser !== false)) return null
            const gen = chatGen.current
            setBusy(true)
            if (opts.addUser !== false) setMessages((ms) => [...ms, { id: newId(), role: "user", content: clean, at: Date.now(), ...(speakReply ? { via: "voice" as const } : {}) }])
            const replyId = newId()
            let started = false
            try {
                const http = await fetch("/api/munshi", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ text: clean, history: history(), pending: pendingNow(), voice: speakReply }),
                })
                const res = await readTurn(http, (delta) => {
                    if (gen !== chatGen.current) return
                    if (!started) {
                        started = true
                        setStreamingId(replyId)
                        setMessages((ms) => [...ms, { id: replyId, role: "assistant", content: delta, at: Date.now() }])
                    } else {
                        setMessages((ms) => ms.map((m) => (m.id === replyId ? { ...m, content: m.content + delta } : m)))
                    }
                })
                if (gen !== chatGen.current) return null
                applyResult(res, undefined, undefined, started ? replyId : undefined)
                if (speakReply && res.reply && opts.play !== false) {
                    const audio = await munshiSpeak(res.reply)
                    if (audio) await voice.sayOnce(audio)
                }
                return res
            } catch {
                if (gen === chatGen.current) applyResult({ reply: "", proposals: [], resolved: [], error: "failed" }, undefined, undefined, started ? replyId : undefined)
                return null
            } finally {
                setStreamingId(null)
                setBusy(false)
            }
        },
        [applyResult, busy], // eslint-disable-line react-hooks/exhaustive-deps
    )

    const sendAudio = useCallback(
        async (audio: Blob, speakReply: boolean) => {
            const fd = new FormData()
            fd.set("audio", audio, audio.type.includes("mp4") ? "speech.mp4" : "speech.webm")
            fd.set("history", JSON.stringify(history()))
            fd.set("pending", JSON.stringify(pendingNow()))
            fd.set("speak", speakReply ? "1" : "0")
            const gen = chatGen.current
            const res = (await fetch("/api/munshi", { method: "POST", body: fd }).then((r) => r.json())) as MunshiTurnResult
            if (gen !== chatGen.current) return { ...res, audio: null }
            applyResult(res, res.heard, speakReply ? "voice" : undefined)
            return res
        },
        [applyResult],
    )

    const say = (role: "user" | "assistant", content: string) =>
        setMessages((ms) => [...ms, { id: newId(), role, content, at: Date.now(), ...(role === "user" ? { via: "voice" as const } : {}) }])

    /**
     * Talk mode: Saaras writes down what he said, the phone reads it (lib/voice). Entries, yes/no,
     * questions about today and closing the day are answered here; anything else goes to the agent.
     */
    const voice = useVoiceSession({
        onUtterance: async (blob) => {
            const fd = new FormData()
            fd.set("audio", blob, blob.type.includes("mp4") ? "speech.mp4" : "speech.webm")
            const heard = (await fetch("/api/munshi/hear", { method: "POST", body: fd })
                .then((r) => r.json())
                .catch(() => ({ text: "" }))) as { text: string; error?: string }
            if (heard.error === "no_key") {
                say("assistant", t("noVoiceKey"))
                return { audio: null }
            }
            return onTranscript(heard.text?.trim() ?? "")
        },
    })

    const onTranscript = async (text: string): Promise<{ audio: string | null }> => {
            if (!text) {
                const n = misses + 1
                setMisses(n)
                if (n >= 2) setByHand(true)
                return { audio: await munshiSpeak(t("didntHear")).catch(() => null) }
            }
            say("user", text)
            const step = await ledger.hear(text)
            if (step.handled) {
                setMisses(step.state.cards.some((c) => !c.who && !c.options.length) ? misses + 1 : 0)
                if (step.show === "unpaid") setShowUnpaid(true)
                if (step.say) say("assistant", step.say)
                return { audio: step.say ? await munshiSpeak(step.say).catch(() => null) : null }
            }
            setMisses(0)
            const res = await sendText(text, true, { addUser: false, play: false })
            return { audio: res?.reply ? await munshiSpeak(stripMarkdown(res.reply)).catch(() => null) : null }
    }

    const today = nepalToday()
    const clips = usePendingClips()
    const outboxCount = useLiveQuery(() => idb().outbox.count(), [], 0)
    const [goingThrough, setGoingThrough] = useState(false)

    const offlineVoice = useOfflineVoice({
        active: !online,
        today,
        names: ledger.book?.people.map((p) => p.name) ?? [],
        laterLine: () => ({ say: REPLIES[ledger.state.lang].later, lang: ledger.state.lang }),
        onText: async (text) => {
            say("user", text)
            const step = await ledger.hear(text)
            if (!step.handled) {
                say("assistant", REPLIES[step.state.lang].later)
                return null
            }
            if (step.show === "unpaid") setShowUnpaid(true)
            if (step.say) say("assistant", step.say)
            return { say: step.say, lang: step.state.lang }
        },
    })

    /** Back online: go through one note he said offline (a recording or words), as if he said it now. */
    const goThroughNext = async () => {
        const clip = clips[0]
        if (!clip || goingThrough) return
        setGoingThrough(true)
        try {
            let text = clip.text ?? ""
            if (!text && clip.audio) {
                const fd = new FormData()
                fd.set("audio", clip.audio, clip.audio.type.includes("mp4") ? "speech.mp4" : "speech.webm")
                const heard = (await fetch("/api/munshi/hear", { method: "POST", body: fd }).then((r) => r.json())) as { text?: string; error?: string }
                if (heard.error) return
                text = heard.text?.trim() ?? ""
            }
            await idb().clips.delete(clip.id)
            if (!text) return
            say("user", text)
            const step = await ledger.hear(text, { date: clip.date })
            if (step.handled) {
                if (step.say) await speakLine(step.say)
            } else {
                const res = await sendText(text, true, { addUser: false, play: false })
                if (res?.reply) {
                    const audio = await munshiSpeak(stripMarkdown(res.reply)).catch(() => null)
                    if (audio) await voice.sayOnce(audio)
                }
            }
        } finally {
            setGoingThrough(false)
        }
    }

    // Dev only: lets a browser test feed a sentence without a microphone.
    useEffect(() => {
        if (process.env.NODE_ENV === "production") return
        const w = window as unknown as { __sajiloHear?: (t: string) => Promise<unknown>; __sajiloOffline?: (off: boolean) => void }
        w.__sajiloHear = onTranscript
        w.__sajiloOffline = (off) => setReachable(!off)
    })

    const speakLine = async (line: string, show = true) => {
        if (!line) return
        if (show) say("assistant", line)
        if (!navigator.onLine) return void speakLocallyNow(line, ledger.state.lang)
        const audio = await munshiSpeak(line).catch(() => null)
        if (audio && voice.status === "off") await voice.sayOnce(audio)
    }

    useEffect(() => {
        if (voice.error === "mic_denied") toast.error(t("micDenied"))
    }, [voice.error, t])

    const confirm = async (p: Proposal) => {
        setConfirming(p.id)
        const res = await confirmProposal(p).catch(() => ({ ok: false, message: "failed" }))
        setProposalStatus(p.id, res.ok ? "done" : "failed")
        setConfirming(null)
        if (res.ok) toast.success(`${t("savedDone")} · ${p.title}`)
    }

    const reset = async () => {
        voice.stop()
        chatGen.current++
        setBusy(false)
        await saveNow()
        setMessages([])
        setConvId(null)
        window.history.replaceState(null, "", munshiUrl(null, mode))
    }

    const openConversation = async (id: string) => {
        setHistoryOpen(false)
        if (id === convIdRef.current) return
        voice.stop()
        await saveNow()
        router.push(munshiUrl(id, mode))
    }

    const orbState: OrbState = voice.status === "off" ? (busy ? "thinking" : "idle") : voice.status
    const lastUser = [...messages].reverse().find((m) => m.role === "user")
    const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant" && m.content)
    const empty = messages.filter((m) => m.role === "user").length === 0

    return (
        <div className="relative flex -mb-6 h-[calc(100dvh-78px-env(safe-area-inset-bottom))] flex-col overflow-hidden">
            <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
                <div className="absolute -top-32 left-1/2 h-[480px] w-[480px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgb(232_140_70/0.22),transparent_65%)] blur-2xl" />
                <div className="absolute bottom-0 right-[-120px] h-[360px] w-[360px] rounded-full bg-[radial-gradient(circle,rgb(123_97_255/0.12),transparent_65%)] blur-2xl" />
            </div>

            <header className="flex items-center justify-between gap-3 px-4 pt-safe">
                <div className="min-w-0 pt-4">
                    <h1 className="truncate text-[22px] font-semibold leading-tight text-ink">{t("munshi")}</h1>
                    {online ? (
                        <p className="truncate whitespace-nowrap text-[13px] text-ink-3">{t("munshiTagline")}</p>
                    ) : (
                        <p className="mt-0.5 inline-flex items-center gap-1.5 rounded-full bg-miss-soft px-2.5 py-0.5 text-[12px] font-semibold text-miss">
                            <WifiOff className="h-3.5 w-3.5" /> {t("vcOffline", { count: outboxCount + clips.length })}
                        </p>
                    )}
                </div>
                <div className="flex shrink-0 items-center gap-1.5 pt-4">
                    <button
                        type="button"
                        onClick={() => setHistoryOpen(true)}
                        aria-label={t("pastChats")}
                        title={t("pastChats")}
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-card text-ink-2 ring-1 ring-line transition-colors active:bg-paper-2"
                    >
                        <PastChatsIcon className="h-5 w-5" />
                    </button>
                    {!empty && (
                        <button
                            type="button"
                            onClick={() => void reset()}
                            aria-label={t("newConversation")}
                            title={t("newConversation")}
                            className="flex h-10 w-10 items-center justify-center rounded-full bg-card text-ink-2 ring-1 ring-line transition-colors active:bg-paper-2"
                        >
                            <NewChatIcon className="h-5 w-5" />
                        </button>
                    )}
                    <div className="relative grid grid-cols-2 rounded-full bg-card p-1 ring-1 ring-line" role="tablist">
                        <span
                            aria-hidden
                            className={cn(
                                "absolute inset-y-1 left-1 w-9 rounded-full bg-saffron shadow-sm transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
                                mode === "chat" && "translate-x-9",
                            )}
                        />
                        {(["voice", "chat"] as const).map((m) => (
                            <button
                                key={m}
                                type="button"
                                role="tab"
                                aria-selected={mode === m}
                                aria-label={m === "voice" ? t("modeVoice") : t("modeChat")}
                                title={m === "voice" ? t("modeVoice") : t("modeChat")}
                                onClick={() => switchMode(m)}
                                className={cn("relative flex h-8 w-9 items-center justify-center rounded-full transition-colors duration-200", mode === m ? "text-white" : "text-ink-3")}
                            >
                                {m === "voice" ? <TalkIcon className="h-5 w-5" /> : <TypeIcon className="h-5 w-5" />}
                            </button>
                        ))}
                    </div>
                </div>
            </header>

            {!online && mode !== "voice" ? (
                <MunshiOffline />
            ) : mode === "voice" ? (
                <VoiceView
                    offline={!online}
                    offlineLocal={offlineVoice.local}
                    offlineSupport={offlineVoice.support}
                    onInstallOffline={() => void offlineVoice.install()}
                    partial={offlineVoice.partial}
                    clipsCount={clips.length}
                    goingThrough={goingThrough}
                    onGoThrough={() => void goThroughNext()}
                    ledgerCards={ledger.state.cards}
                    book={ledger.book}
                    last={ledger.last}
                    showUnpaid={showUnpaid}
                    onCloseUnpaid={() => setShowUnpaid(false)}
                    onEditCard={(id, patch) => void ledger.edit(id, patch).then((line) => patch !== "remove" && void speakLine(line))}
                    onConfirmCards={() => void ledger.confirm().then(speakLine)}
                    onCancelCards={ledger.clear}
                    onUndo={() => void ledger.undo()}
                    onByHand={() => setByHand(true)}
                    orbState={online ? orbState : offlineVoice.status === "off" ? "idle" : offlineVoice.status}
                    level={online ? voice.level : offlineVoice.level}
                    onOrb={online ? voice.toggle : () => void offlineVoice.toggle()}
                    status={online ? voice.status : offlineVoice.status}
                    busy={busy}
                    lastUser={lastUser?.content}
                    lastAssistant={lastAssistant?.content}
                    pending={pending}
                    confirming={confirming}
                    onConfirm={confirm}
                    onCancel={(p) => setProposalStatus(p.id, "cancelled")}
                    empty={empty}
                    hasCustomers={hasCustomers}
                />
            ) : (
                <ChatView
                    messages={messages}
                    busy={busy}
                    streaming={streamingId !== null}
                    confirming={confirming}
                    onConfirm={confirm}
                    onCancel={(p) => setProposalStatus(p.id, "cancelled")}
                    onSend={(text) => void sendText(text, false)}
                    onAudio={async (blob) => {
                        setBusy(true)
                        setTranscribing(true)
                        try {
                            await sendAudio(blob, false)
                        } finally {
                            setTranscribing(false)
                            setBusy(false)
                        }
                    }}
                    transcribing={transcribing}
                    empty={empty}
                    hasCustomers={hasCustomers}
                />
            )}
            {ledger.book && (
                <ByHandSheet
                    open={byHand}
                    onOpenChange={(o) => {
                        setByHand(o)
                        if (!o) setMisses(0)
                    }}
                    people={ledger.book.people}
                    onAdd={(who: Who, amount: number) => void ledger.add(who, amount).then(speakLine)}
                />
            )}
            <HistorySheet open={historyOpen} onOpenChange={setHistoryOpen} beforeLoad={saveNow} currentId={convId} onOpen={(id) => void openConversation(id)} onDeleted={(id) => id === convIdRef.current && void reset()} />
        </div>
    )
}

function MunshiOffline() {
    const { t } = useI18n()
    return (
        <div className="flex flex-1 flex-col items-center justify-center px-8 pb-10 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-paper-2 text-ink-3">
                <WifiOff className="h-7 w-7" />
            </span>
            <h2 className="mt-4 text-[18px] font-semibold text-ink">{t("munshiOfflineTitle")}</h2>
            <p className="mt-1 max-w-xs text-[14px] leading-snug text-ink-2">{t("munshiOfflineBody")}</p>
            <Link href="/today" className="mt-5 flex h-11 items-center rounded-full bg-ink px-5 text-[14px] font-semibold text-paper">
                {t("openToday")}
            </Link>
        </div>
    )
}

function HistorySheet({
    open,
    onOpenChange,
    beforeLoad,
    currentId,
    onOpen,
    onDeleted,
}: {
    open: boolean
    onOpenChange: (o: boolean) => void
    beforeLoad: () => Promise<void>
    currentId: string | null
    onOpen: (id: string) => void
    onDeleted: (id: string) => void
}) {
    const { t, date } = useI18n()
    const online = useOnline()
    const { confirm, confirmDialog } = useConfirm()
    const [items, setItems] = useState<MunshiConversationSummary[] | null>(null)

    useEffect(() => {
        if (!open || !online) return
        let alive = true
        setItems(null)
        beforeLoad()
            .then(() => listConversations())
            .then((rows) => alive && setItems(rows))
            .catch(() => alive && setItems([]))
        return () => {
            alive = false
        }
    }, [open, online, beforeLoad])

    const remove = async (c: MunshiConversationSummary) => {
        const ok = await confirm({ title: t("deleteChatTitle"), description: c.title, confirmText: t("delete"), cancelText: t("cancel"), destructive: true })
        if (!ok) return
        setItems((xs) => xs?.filter((x) => x.id !== c.id) ?? null)
        await deleteConversation(c.id).catch(() => toast.error(t("somethingWrong")))
        onDeleted(c.id)
    }

    return (
        <>
            <BottomSheet open={open} onOpenChange={onOpenChange} title={t("pastChats")} half>
                <div>
                    {!online ? (
                        <p className="py-8 text-center text-[14px] text-ink-3">{t("munshiOfflineBody")}</p>
                    ) : items === null ? (
                        <div className="flex justify-center py-10">
                            <Loader size={22} />
                        </div>
                    ) : items.length === 0 ? (
                        <p className="py-8 text-center text-[14px] text-ink-3">{t("noPastChats")}</p>
                    ) : (
                        <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-card ring-1 ring-line">
                            {items.map((c) => (
                                <li key={c.id} className={cn("flex items-center gap-2 pl-4 pr-1.5", c.id === currentId && "bg-saffron-soft/50")}>
                                    <button type="button" onClick={() => onOpen(c.id)} className="min-w-0 flex-1 py-3 text-left">
                                        <p className="truncate text-[15px] font-medium text-ink">{c.title || t("untitledChat")}</p>
                                        <p className="text-[12px] text-ink-3">
                                            {date(toNepalDateStr(new Date(c.updatedAt)), true)} · {c.messageCount === 1 ? t("oneQuestion") : t("questionsCount", { count: c.messageCount })}
                                        </p>
                                    </button>
                                    <button type="button" onClick={() => void remove(c)} aria-label={t("delete")} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-3 active:bg-paper-2">
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </BottomSheet>
            {confirmDialog}
        </>
    )
}

function VoiceView(props: {
    offline: boolean
    offlineLocal: boolean
    offlineSupport: string | null
    onInstallOffline: () => void
    partial: string
    clipsCount: number
    goingThrough: boolean
    onGoThrough: () => void
    ledgerCards: VoiceCard[]
    book: VoiceBook | null
    last: { label: string; at: number } | null
    showUnpaid: boolean
    onCloseUnpaid: () => void
    onEditCard: (id: string, patch: Partial<VoiceCard> | "remove") => void
    onConfirmCards: () => void
    onCancelCards: () => void
    onUndo: () => void
    onByHand: () => void
    orbState: OrbState
    level: React.MutableRefObject<number>
    onOrb: () => void
    status: string
    busy: boolean
    lastUser?: string
    lastAssistant?: string
    pending: Proposal[]
    confirming: string | null
    onConfirm: (p: Proposal) => void
    onCancel: (p: Proposal) => void
    empty: boolean
    hasCustomers: boolean
}) {
    const { t } = useI18n()
    const label =
        props.orbState === "listening"
            ? t("listening")
            : props.orbState === "thinking"
              ? t("thinking")
              : props.orbState === "speaking"
                ? t("speaking")
                : t("tapToTalk")
    const latest = props.pending.at(-1)

    return (
        <ScrollArea orientation="vertical" className="min-h-0 flex-1">
            <div className="flex min-h-[calc(100dvh-10rem-env(safe-area-inset-bottom))] flex-col items-center px-5">
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center py-4">
                <Orb
                    state={props.orbState}
                    levelRef={props.level}
                    onClick={props.onOrb}
                    label={label}
                    className="size-[min(62vw,34dvh,270px)]"
                />
                <AnimatePresence mode="wait">
                    <motion.p
                        key={label}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.2 }}
                        className="mt-6 flex items-center gap-2 text-[14px] font-medium text-ink-2"
                    >
                        {props.orbState === "listening" && <span className="h-2 w-2 animate-pulse rounded-full bg-miss" />}
                        {label}
                        {props.status !== "off" && props.orbState === "listening" && <Square className="ml-1 h-3.5 w-3.5 fill-ink-3 text-ink-3" />}
                    </motion.p>
                </AnimatePresence>

                <div className="mt-4 min-h-[72px] w-full max-w-md text-center">
                    {props.offline && props.partial && props.orbState === "listening" ? (
                        <p className="line-clamp-2 text-[15px] text-ink-2">{props.partial}</p>
                    ) : (
                        props.lastUser && <p className="line-clamp-2 text-[13px] text-ink-3">“{props.lastUser}”</p>
                    )}
                    <ScrollArea orientation="vertical" viewportClassName="max-h-[22dvh]">
                    <AnimatePresence mode="wait">
                        {props.lastAssistant && (
                            <motion.p
                                key={props.lastAssistant}
                                initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
                                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                                className="mt-1.5 px-1 text-[16px] font-medium leading-snug text-ink"
                            >
                                {stripMarkdown(props.lastAssistant)}
                            </motion.p>
                        )}
                    </AnimatePresence>
                    </ScrollArea>
                </div>
            </div>

            <div className="w-full max-w-md space-y-3 pb-5">
                <OfflineVoiceNote {...props} />
                {props.last && <UndoBar key={props.last.at} label={props.last.label} at={props.last.at} onUndo={props.onUndo} />}
                {props.book && props.ledgerCards.length > 0 ? (
                    <VoiceCards cards={props.ledgerCards} book={props.book} onEdit={props.onEditCard} onConfirm={props.onConfirmCards} onCancel={props.onCancelCards} />
                ) : (
                    latest && <ProposalCard p={latest} busy={props.confirming === latest.id} onConfirm={() => props.onConfirm(latest)} onCancel={() => props.onCancel(latest)} />
                )}
                {props.showUnpaid && props.book && props.book.unpaid.length > 0 && <UnpaidList names={props.book.unpaid} onClose={props.onCloseUnpaid} />}
                {props.hasCustomers && !props.ledgerCards.length && (
                    <div className="flex justify-center">
                        <ByHandButton onClick={props.onByHand} />
                    </div>
                )}
                {props.empty && !props.hasCustomers && <StartCards />}
            </div>
            </div>
        </ScrollArea>
    )
}

/** Offline: how he is being heard. Online: notes from offline to go through, and the one-time offline download. */
function OfflineVoiceNote(props: { offline: boolean; offlineLocal: boolean; offlineSupport: string | null; onInstallOffline: () => void; clipsCount: number; goingThrough: boolean; onGoThrough: () => void }) {
    const { t } = useI18n()
    if (props.offline) {
        return (
            <p className="rounded-2xl bg-paper-2 px-4 py-3 text-center text-[14px] leading-snug text-ink-2">
                {props.offlineLocal ? t("vcOfflineLocal") : t("vcOfflineClips")}
            </p>
        )
    }
    return (
        <>
            {props.clipsCount > 0 && (
                <button
                    type="button"
                    disabled={props.goingThrough}
                    onClick={props.onGoThrough}
                    className="flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl bg-saffron-soft px-4 text-left disabled:opacity-60"
                >
                    <span className="text-[15px] font-semibold text-ink">{t("vcNotes", { count: props.clipsCount })}</span>
                    <span className="shrink-0 rounded-full bg-saffron px-3 py-1.5 text-[13px] font-semibold text-white">{props.goingThrough ? t("thinking") : t("vcGoThrough")}</span>
                </button>
            )}
            {(props.offlineSupport === "downloadable" || props.offlineSupport === "downloading") && (
                <button
                    type="button"
                    disabled={props.offlineSupport === "downloading"}
                    onClick={props.onInstallOffline}
                    className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-card px-4 text-[14px] font-semibold text-ink-2 ring-1 ring-line disabled:opacity-60"
                >
                    <WifiOff className="h-4 w-4" /> {props.offlineSupport === "downloading" ? t("vcDownloading") : t("vcGetOffline")}
                </button>
            )}
        </>
    )
}

function UnpaidList({ names, onClose }: { names: string[]; onClose: () => void }) {
    const { t } = useI18n()
    return (
        <div className="rounded-[22px] bg-card p-4 ring-1 ring-line">
            <div className="mb-2 flex items-center justify-between">
                <p className="text-[15px] font-semibold text-ink">
                    {t("vcUnpaidTitle")} · {names.length}
                </p>
                <button type="button" onClick={onClose} aria-label={t("cancel")} className="flex h-8 w-8 items-center justify-center rounded-full text-ink-3 active:bg-paper-2">
                    <X className="h-4 w-4" />
                </button>
            </div>
            <ScrollArea orientation="vertical" viewportClassName="max-h-44">
                <ul className="space-y-1">
                    {names.map((n) => (
                        <li key={n} className="text-[15px] text-ink-2">
                            {n}
                        </li>
                    ))}
                </ul>
            </ScrollArea>
        </div>
    )
}

function StartCards() {
    const { t } = useI18n()
    return (
        <div className="rounded-[22px] bg-card p-4 ring-1 ring-line">
            <p className="text-[15px] font-medium text-ink">{t("welcomeEmpty")}</p>
            {/* Stacked: side by side the labels (longer still in Nepali) spill out on a phone. */}
            <div className="mt-3 grid gap-2">
                <Link href="/manage" className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-center text-[15px] font-semibold text-paper">
                    <UserPlus className="h-5 w-5 shrink-0" /> {t("addCustomers")}
                </Link>
                <Link href="/scan?kind=customers" className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-paper-2 px-4 py-2.5 text-center text-[15px] font-semibold text-ink">
                    <Camera className="h-5 w-5 shrink-0" /> {t("importFromPhoto")}
                </Link>
            </div>
        </div>
    )
}

function ChatView(props: {
    messages: MunshiMessage[]
    busy: boolean
    streaming: boolean
    transcribing: boolean
    confirming: string | null
    onConfirm: (p: Proposal) => void
    onCancel: (p: Proposal) => void
    onSend: (text: string) => void
    onAudio: (blob: Blob) => Promise<void>
    empty: boolean
    hasCustomers: boolean
}) {
    const { t } = useI18n()
    const [text, setText] = useState("")
    const viewportRef = useRef<HTMLDivElement>(null)
    const dictation = useDictation((blob) => void props.onAudio(blob))

    const lastLength = props.messages.at(-1)?.content.length ?? 0
    useEffect(() => {
        const el = viewportRef.current
        if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" })
    }, [props.messages.length, lastLength, props.busy, props.transcribing])

    const toggleMic = async () => {
        if (dictation.recording) return dictation.stop()
        try {
            await dictation.start()
        } catch {
            toast.error(t("micDenied"))
        }
    }

    const submit = () => {
        if (!text.trim()) return
        props.onSend(text)
        setText("")
    }

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <ScrollArea orientation="vertical" viewportRef={viewportRef} className="min-h-0 flex-1">
                <div className="space-y-3 px-4 pb-4 pt-4">
                    {props.messages.map((m) => (
                        <div key={m.id} className={cn("flex flex-col gap-2", m.role === "user" ? "items-end" : "items-start")}>
                            {m.content && (
                                <div
                                    className={cn(
                                        "whitespace-pre-wrap rounded-[22px] px-4 py-2.5 text-[15px] leading-relaxed",
                                        m.role === "user" ? "max-w-[85%] rounded-br-md bg-ink text-paper" : "w-full rounded-bl-md bg-card text-ink ring-1 ring-line",
                                    )}
                                >
                                    {m.role === "assistant" && (
                                        <span className="mb-1 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-saffron">
                                            <span className="h-2.5 w-2.5 rounded-full bg-gradient-to-br from-[#ffb36b] to-[#7b61ff]" /> {t("munshi")}
                                        </span>
                                    )}
                                    {m.via === "voice" && m.role === "user" && <Mic className="-mt-0.5 mr-1.5 inline h-3.5 w-3.5 opacity-60" />}
                                    {m.role === "assistant" ? <RichReply text={m.content} /> : m.content}
                                </div>
                            )}
                            {m.proposals?.map((p) => (
                                <div key={p.id} className="w-full">
                                    <ProposalCard p={p} compact busy={props.confirming === p.id} onConfirm={() => props.onConfirm(p)} onCancel={() => props.onCancel(p)} />
                                </div>
                            ))}
                        </div>
                    ))}
                    {props.transcribing && (
                        <div className="flex justify-end">
                            <span className="rounded-[22px] rounded-br-md bg-ink px-5 py-4 text-paper">
                                <TypingDots />
                            </span>
                        </div>
                    )}
                    {props.busy && !props.transcribing && !props.streaming && (
                        <div className="flex items-center gap-2 px-1 text-[14px] text-ink-3">
                            <Loader size={18} dotSize={2} /> {t("thinking")}
                        </div>
                    )}
                    {props.empty && !props.hasCustomers && <StartCards />}
                    {props.empty && props.hasCustomers && <ChatWelcome onPick={props.onSend} />}
                </div>
            </ScrollArea>

            <div className="shrink-0 border-t border-line/60 bg-paper/95 px-4 pb-3 pt-3 backdrop-blur">
                {dictation.recording ? (
                    <div className="flex items-center gap-3 rounded-[22px] bg-card p-2 pl-4 shadow-[0_10px_30px_-16px_rgb(200_97_31/0.5)] ring-2 ring-saffron/50">
                        <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-miss" />
                        <Waveform levelRef={dictation.level} className="min-w-0 flex-1 justify-center" />
                        <button
                            type="button"
                            onClick={toggleMic}
                            aria-label={t("tapToStop")}
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-miss text-white"
                        >
                            <Square className="h-4 w-4 fill-white" />
                        </button>
                    </div>
                ) : (
                    <div className="flex items-end gap-2 rounded-[22px] bg-card p-2 pl-4 shadow-[0_10px_30px_-16px_rgb(42_33_24/0.4)] ring-1 ring-line focus-within:ring-2 focus-within:ring-saffron">
                        <Textarea
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault()
                                    submit()
                                }
                            }}
                            rows={1}
                            placeholder={t("typeMessage")}
                            className="max-h-32 min-h-11 flex-1 resize-none sm:resize-none border-0 bg-transparent px-0 py-2.5 text-[15px] text-ink shadow-none outline-none placeholder:text-ink-3 focus-visible:ring-0"
                        />
                        {text.trim() ? (
                            <button type="button" onClick={submit} disabled={props.busy} aria-label={t("send")} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ink text-paper disabled:opacity-40">
                                <ArrowUp className="h-5 w-5" />
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={toggleMic}
                                disabled={props.busy}
                                aria-label={t("modeVoice")}
                                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-saffron-soft text-saffron transition-colors active:bg-saffron active:text-white disabled:opacity-40"
                            >
                                <Mic className="h-5 w-5" />
                            </button>
                        )}
                    </div>
                )}
                {dictation.recording && <p className="mt-2 text-center text-[13px] text-ink-3">{t("listening")}</p>}
            </div>
        </div>
    )
}

const SUGGESTION_ICONS = [UserRoundX, ChartColumnBig, TrendingUp, HandCoins] as const

function ChatWelcome({ onPick }: { onPick: (text: string) => void }) {
    const { t } = useI18n()
    return (
        <div className="flex flex-col items-center px-1 pb-2 pt-8 text-center">
            <span className="relative flex h-16 w-16 items-center justify-center">
                <span className="absolute -inset-3 rounded-full bg-[radial-gradient(circle,rgb(232_140_70/0.35),transparent_65%)] blur-md" />
                <span className="relative h-16 w-16 rounded-full bg-[radial-gradient(circle_at_32%_26%,#fff2e2_0%,#ffb36b_28%,#e3611c_62%,#7b61ff_125%)] shadow-[0_12px_30px_-12px_rgb(200_97_31/0.7)]">
                    <span className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_22%,rgb(255_255_255/0.7),transparent_38%)]" />
                </span>
            </span>
            <h2 className="mt-4 text-[19px] font-semibold text-ink">{t("chatWelcomeTitle")}</h2>
            <p className="mt-1 max-w-xs text-[14px] leading-snug text-ink-2">{t("chatWelcomeSub")}</p>
            <div className="mt-6 grid w-full grid-cols-2 gap-2">
                {SUGGESTIONS.map((k, i) => {
                    const Icon = SUGGESTION_ICONS[i]!
                    return (
                        <button
                            key={k}
                            type="button"
                            onClick={() => onPick(t(k))}
                            className="flex min-h-[76px] flex-col items-start justify-between gap-2 rounded-2xl bg-card p-3 text-left ring-1 ring-line transition-colors active:bg-paper-2"
                        >
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-saffron-soft text-saffron">
                                <Icon className="h-4 w-4" />
                            </span>
                            <span className="text-[13px] font-medium leading-snug text-ink">{t(k)}</span>
                        </button>
                    )
                })}
            </div>
        </div>
    )
}

/**
 * Reads one chat turn. The route streams NDJSON frames (`text` deltas, then `done` or `error`);
 * early failures (no model, signed out) still come back as one JSON object.
 */
async function readTurn(http: Response, onDelta: (delta: string) => void): Promise<MunshiTurnResult> {
    const failed: MunshiTurnResult = { reply: "", proposals: [], resolved: [], error: "failed" }
    if (!http.body || !(http.headers.get("content-type") ?? "").includes("ndjson")) {
        return ((await http.json().catch(() => null)) as MunshiTurnResult | null) ?? failed
    }
    const reader = http.body.getReader()
    const dec = new TextDecoder()
    let buf = ""
    let out: MunshiTurnResult = failed
    for (;;) {
        const { value, done } = await reader.read()
        buf += dec.decode(value ?? new Uint8Array(), { stream: !done })
        // A frame can be split across two chunks, so only whole lines are parsed.
        let nl = buf.indexOf("\n")
        while (nl >= 0) {
            const line = buf.slice(0, nl).trim()
            buf = buf.slice(nl + 1)
            nl = buf.indexOf("\n")
            if (!line) continue
            const f = JSON.parse(line) as MunshiStreamFrame
            if (f.type === "text") onDelta(f.delta)
            else if (f.type === "done") out = { ...f.result }
            else out = failed
        }
        if (done) break
    }
    return out
}

/** A reply as he should read it: **bold** shown bold, any other markdown removed (lib/munshi/plain-text.ts). */
function RichReply({ text }: { text: string }) {
    return replyParts(text).map((p, i) =>
        p.bold ? (
            <strong key={i} className="font-semibold">
                {p.text}
            </strong>
        ) : (
            <span key={i}>{p.text}</span>
        ),
    )
}
