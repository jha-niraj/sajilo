"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { AnimatePresence, motion } from "framer-motion"
import { toast } from "sonner"
import { ArrowUp, Camera, Keyboard, Mic, Square, UserPlus, AudioLines, UserRoundX, ChartColumnBig, TrendingUp, HandCoins, History, SquarePen, Trash2, WifiOff } from "lucide-react"
import { useRouter } from "next/navigation"
import { toNepalDateStr } from "@repo/calendar"
import { useConfirm } from "@repo/ui/components/ui/use-confirm"
import { BottomSheet } from "@/components/bottom-sheet"
import { useOnline } from "@/lib/offline/network"
import { cn } from "@repo/ui/lib/utils"
import { Loader } from "@repo/ui/components/ui/loader"
import { Textarea } from "@repo/ui/components/ui/textarea"
import { ScrollArea } from "@repo/ui/components/ui/scroll-area"
import { useI18n } from "@/lib/i18n"
import { refreshDay } from "@/lib/offline/sync"
import { confirmProposal, deleteConversation, listConversations, munshiSpeak, saveConversation } from "@/actions/munshi.action"
import type { MunshiConversationSummary, MunshiMessage, MunshiTurnResult, Proposal } from "@/lib/munshi/types"
import type { DictKey } from "@/lib/dict"
import { Orb, type OrbState } from "./orb"
import { ProposalCard } from "./proposal-card"
import { useVoiceSession } from "./use-voice-session"
import { useDictation } from "./use-dictation"
import { TypingDots, Waveform } from "./waveform"

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
    const { t } = useI18n()
    const router = useRouter()
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
        (res: MunshiTurnResult, userText: string | undefined, via?: "voice") => {
            for (const r of res.resolved) setProposalStatus(r.id, r.status)
            if (res.error === "no_speech") {
                toast(t("didntHear"))
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

    const history = () => messagesRef.current.map(({ role, content, id, at }) => ({ role, content, id, at }))
    const pendingNow = () => messagesRef.current.flatMap((m) => m.proposals ?? []).filter((p) => p.status === "pending")

    const sendText = useCallback(
        async (text: string, speakReply: boolean) => {
            const clean = text.trim()
            if (!clean || busy) return
            setBusy(true)
            setMessages((ms) => [...ms, { id: newId(), role: "user", content: clean, at: Date.now(), ...(speakReply ? { via: "voice" as const } : {}) }])
            try {
                const res = (await fetch("/api/munshi", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ text: clean, history: history(), pending: pendingNow(), voice: speakReply }),
                }).then((r) => r.json())) as MunshiTurnResult
                applyResult(res, undefined)
                if (speakReply && res.reply) {
                    const audio = await munshiSpeak(res.reply)
                    if (audio) await voice.sayOnce(audio)
                }
            } catch {
                applyResult({ reply: "", proposals: [], resolved: [], error: "failed" }, undefined)
            } finally {
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
            const res = (await fetch("/api/munshi", { method: "POST", body: fd }).then((r) => r.json())) as MunshiTurnResult
            applyResult(res, res.heard, speakReply ? "voice" : undefined)
            return res
        },
        [applyResult],
    )

    const voice = useVoiceSession({
        onUtterance: async (blob) => {
            const res = await sendAudio(blob, true)
            return { audio: res.audio ?? null }
        },
    })

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
                    <h1 className="text-[22px] font-semibold leading-tight text-ink">{t("munshi")}</h1>
                    <p className="truncate whitespace-nowrap text-[13px] text-ink-3">{t("munshiTagline")}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5 pt-4">
                    <button type="button" onClick={() => setHistoryOpen(true)} aria-label={t("pastChats")} className="flex h-9 w-9 items-center justify-center rounded-full bg-paper-2 text-ink-2">
                        <History className="h-[18px] w-[18px]" />
                    </button>
                    {!empty && (
                        <button type="button" onClick={() => void reset()} aria-label={t("newConversation")} className="flex h-9 w-9 items-center justify-center rounded-full bg-paper-2 text-ink-2">
                            <SquarePen className="h-[18px] w-[18px]" />
                        </button>
                    )}
                    <div className="grid grid-cols-2 rounded-full bg-paper-2 p-1 text-[14px] font-semibold" role="tablist">
                        {(["voice", "chat"] as const).map((m) => (
                            <button
                                key={m}
                                type="button"
                                role="tab"
                                aria-selected={mode === m}
                                onClick={() => switchMode(m)}
                                className={cn("flex h-9 items-center gap-1.5 rounded-full px-3.5 transition-colors", mode === m ? "bg-card text-ink shadow-sm" : "text-ink-3")}
                            >
                                {m === "voice" ? <AudioLines className="h-4 w-4" /> : <Keyboard className="h-4 w-4" />}
                                {m === "voice" ? t("modeVoice") : t("modeChat")}
                            </button>
                        ))}
                    </div>
                </div>
            </header>

            {!online ? (
                <MunshiOffline />
            ) : mode === "voice" ? (
                <VoiceView
                    orbState={orbState}
                    level={voice.level}
                    onOrb={voice.toggle}
                    status={voice.status}
                    busy={busy}
                    lastUser={lastUser?.content}
                    lastAssistant={lastAssistant?.content}
                    pending={pending}
                    confirming={confirming}
                    onConfirm={confirm}
                    onCancel={(p) => setProposalStatus(p.id, "cancelled")}
                    empty={empty}
                    hasCustomers={hasCustomers}
                    onSuggest={(text) => void sendText(text, true)}
                />
            ) : (
                <ChatView
                    messages={messages}
                    busy={busy}
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
            <HistorySheet open={historyOpen} onOpenChange={setHistoryOpen} currentId={convId} onOpen={(id) => void openConversation(id)} onDeleted={(id) => id === convIdRef.current && void reset()} />
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
    currentId,
    onOpen,
    onDeleted,
}: {
    open: boolean
    onOpenChange: (o: boolean) => void
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
        listConversations()
            .then((rows) => alive && setItems(rows))
            .catch(() => alive && setItems([]))
        return () => {
            alive = false
        }
    }, [open, online])

    const remove = async (c: MunshiConversationSummary) => {
        const ok = await confirm({ title: t("deleteChatTitle"), description: c.title, confirmText: t("delete"), cancelText: t("cancel"), destructive: true })
        if (!ok) return
        setItems((xs) => xs?.filter((x) => x.id !== c.id) ?? null)
        await deleteConversation(c.id).catch(() => toast.error(t("somethingWrong")))
        onDeleted(c.id)
    }

    return (
        <>
            <BottomSheet open={open} onOpenChange={onOpenChange} title={t("pastChats")}>
                <div className="px-4 pb-4">
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
                                            {date(toNepalDateStr(new Date(c.updatedAt)), true)} · {t("questionsCount", { count: c.messageCount })}
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
    onSuggest: (text: string) => void
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
                    {props.lastUser && <p className="line-clamp-2 text-[13px] text-ink-3">“{props.lastUser}”</p>}
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
                                {props.lastAssistant}
                            </motion.p>
                        )}
                    </AnimatePresence>
                    </ScrollArea>
                </div>
            </div>

            <div className="w-full max-w-md space-y-3 pb-5">
                {latest && (
                    <ProposalCard p={latest} busy={props.confirming === latest.id} onConfirm={() => props.onConfirm(latest)} onCancel={() => props.onCancel(latest)} />
                )}
                {!props.hasCustomers ? (
                    <StartCards />
                ) : (
                    props.empty &&
                    props.status === "off" && (
                        <div className="flex flex-wrap justify-center gap-2">
                            {SUGGESTIONS.map((k) => (
                                <button
                                    key={k}
                                    type="button"
                                    disabled={props.busy}
                                    onClick={() => props.onSuggest(t(k))}
                                    className="rounded-full bg-card px-3.5 py-2 text-[13px] font-medium text-ink ring-1 ring-line transition-colors active:bg-paper-2 disabled:opacity-50"
                                >
                                    {t(k)}
                                </button>
                            ))}
                        </div>
                    )
                )}
            </div>
            </div>
        </ScrollArea>
    )
}

function StartCards() {
    const { t } = useI18n()
    return (
        <div className="rounded-[22px] bg-card p-4 ring-1 ring-line">
            <p className="text-[15px] font-medium text-ink">{t("welcomeEmpty")}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
                <Link href="/manage" className="flex h-12 items-center justify-center gap-2 rounded-xl bg-ink text-[15px] font-semibold text-paper">
                    <UserPlus className="h-5 w-5" /> {t("addCustomers")}
                </Link>
                <Link href="/scan?kind=customers" className="flex h-12 items-center justify-center gap-2 rounded-xl bg-paper-2 text-[15px] font-semibold text-ink">
                    <Camera className="h-5 w-5" /> {t("importFromPhoto")}
                </Link>
            </div>
        </div>
    )
}

function ChatView(props: {
    messages: MunshiMessage[]
    busy: boolean
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

    useEffect(() => {
        const el = viewportRef.current
        if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" })
    }, [props.messages.length, props.busy, props.transcribing])

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
                                    {m.content}
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
                    {props.busy && !props.transcribing && (
                        <div className="flex items-center gap-2 px-1 text-[14px] text-ink-3">
                            <Loader size={18} dotSize={2} /> {t("thinking")}
                        </div>
                    )}
                    {!props.hasCustomers && <StartCards />}
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
