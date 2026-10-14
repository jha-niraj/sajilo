"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { AnimatePresence, motion } from "framer-motion"
import { toast } from "sonner"
import { ArrowUp, Camera, Keyboard, Mic, RotateCcw, Square, UserPlus, AudioLines } from "lucide-react"
import { cn } from "@repo/ui/lib/utils"
import { Loader } from "@repo/ui/components/ui/loader"
import { Textarea } from "@repo/ui/components/ui/textarea"
import { useI18n } from "@/lib/i18n"
import { refreshDay } from "@/lib/offline/sync"
import { confirmProposal, munshiSpeak } from "@/actions/munshi.action"
import type { MunshiMessage, MunshiTurnResult, Proposal } from "@/lib/munshi/types"
import type { DictKey } from "@/lib/dict"
import { Orb, type OrbState } from "./orb"
import { ProposalCard } from "./proposal-card"
import { useVoiceSession } from "./use-voice-session"

const STORE_KEY = "sajilo.munshi.v1"
const SUGGESTIONS: DictKey[] = ["suggest1", "suggest2", "suggest3", "suggest4"]

const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now() + Math.random()))

function loadMessages(): MunshiMessage[] {
    try {
        return JSON.parse(localStorage.getItem(STORE_KEY) ?? "[]") as MunshiMessage[]
    } catch {
        return []
    }
}

export function MunshiClient({ userName, hasCustomers: initialHasCustomers, welcome }: { userName: string; hasCustomers: boolean; welcome: boolean }) {
    const { t } = useI18n()
    const [mode, setMode] = useState<"voice" | "chat">("voice")
    const [messages, setMessages] = useState<MunshiMessage[]>([])
    const [loaded, setLoaded] = useState(false)
    const [busy, setBusy] = useState(false)
    const [confirming, setConfirming] = useState<string | null>(null)
    const [hasCustomers, setHasCustomers] = useState(initialHasCustomers)
    const messagesRef = useRef(messages)
    messagesRef.current = messages

    const firstName = userName.split(" ")[0] ?? ""

    useEffect(() => {
        const saved = loadMessages()
        if (saved.length === 0 && (welcome || !hasCustomers)) {
            saved.push({ id: newId(), role: "assistant", content: t("welcomeMunshi", { name: firstName }), at: Date.now() })
        }
        setMessages(saved)
        setLoaded(true)
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (loaded) localStorage.setItem(STORE_KEY, JSON.stringify(messages.slice(-60)))
    }, [messages, loaded])

    const pending = useMemo(() => messages.flatMap((m) => m.proposals ?? []).filter((p) => p.status === "pending"), [messages])

    const setProposalStatus = useCallback((id: string, status: Proposal["status"]) => {
        setMessages((ms) => {
            if (status === "done" && ms.some((m) => m.proposals?.some((p) => p.id === id && p.kind === "add_customer"))) setHasCustomers(true)
            return ms.map((m) => (m.proposals?.some((p) => p.id === id) ? { ...m, proposals: m.proposals.map((p) => (p.id === id ? { ...p, status } : p)) } : m))
        })
        if (status === "done") void refreshDay()
    }, [])

    const applyResult = useCallback(
        (res: MunshiTurnResult, userText: string | undefined) => {
            for (const r of res.resolved) setProposalStatus(r.id, r.status)
            if (res.error === "no_speech") {
                toast(t("didntHear"))
                return
            }
            const additions: MunshiMessage[] = []
            if (userText) additions.push({ id: newId(), role: "user", content: userText, at: Date.now() })
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
            setMessages((ms) => [...ms, { id: newId(), role: "user", content: clean, at: Date.now() }])
            try {
                const res = (await fetch("/api/munshi", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ text: clean, history: history(), pending: pendingNow() }),
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
            applyResult(res, res.heard)
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

    const reset = () => {
        voice.stop()
        setMessages([])
        localStorage.removeItem(STORE_KEY)
    }

    const orbState: OrbState = voice.status === "off" ? (busy ? "thinking" : "idle") : voice.status
    const lastUser = [...messages].reverse().find((m) => m.role === "user")
    const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant" && m.content)
    const empty = messages.filter((m) => m.role === "user").length === 0

    return (
        <div className="relative flex min-h-[calc(100dvh-5rem-env(safe-area-inset-bottom))] flex-col">
            <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
                <div className="absolute -top-32 left-1/2 h-[480px] w-[480px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgb(232_140_70/0.22),transparent_65%)] blur-2xl" />
                <div className="absolute bottom-0 right-[-120px] h-[360px] w-[360px] rounded-full bg-[radial-gradient(circle,rgb(123_97_255/0.12),transparent_65%)] blur-2xl" />
            </div>

            <header className="flex items-center justify-between gap-3 px-4 pt-safe">
                <div className="pt-4">
                    <h1 className="text-[26px] font-semibold leading-tight text-ink">{t("munshi")}</h1>
                    <p className="text-[14px] text-ink-3">{t("munshiTagline")}</p>
                </div>
                <div className="flex items-center gap-2 pt-4">
                    {!empty && (
                        <button type="button" onClick={reset} aria-label={t("newConversation")} className="flex h-10 w-10 items-center justify-center rounded-full bg-paper-2 text-ink-2">
                            <RotateCcw className="h-5 w-5" />
                        </button>
                    )}
                    <div className="grid grid-cols-2 rounded-full bg-paper-2 p-1 text-[14px] font-semibold" role="tablist">
                        {(["voice", "chat"] as const).map((m) => (
                            <button
                                key={m}
                                type="button"
                                role="tab"
                                aria-selected={mode === m}
                                onClick={() => {
                                    if (m === "chat") voice.stop()
                                    setMode(m)
                                }}
                                className={cn("flex h-9 items-center gap-1.5 rounded-full px-3.5 transition-colors", mode === m ? "bg-card text-ink shadow-sm" : "text-ink-3")}
                            >
                                {m === "voice" ? <AudioLines className="h-4 w-4" /> : <Keyboard className="h-4 w-4" />}
                                {m === "voice" ? t("modeVoice") : t("modeChat")}
                            </button>
                        ))}
                    </div>
                </div>
            </header>

            {mode === "voice" ? (
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
                        try {
                            await sendAudio(blob, false)
                        } finally {
                            setBusy(false)
                        }
                    }}
                    empty={empty}
                    hasCustomers={hasCustomers}
                />
            )}
        </div>
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
        <div className="flex flex-1 flex-col items-center px-5">
            <div className="flex flex-1 flex-col items-center justify-center py-6">
                <Orb
                    state={props.orbState}
                    levelRef={props.level}
                    onClick={props.onOrb}
                    label={label}
                    className="size-[min(66vw,280px)]"
                />
                <AnimatePresence mode="wait">
                    <motion.p
                        key={label}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.2 }}
                        className="mt-9 flex items-center gap-2 text-[16px] font-medium text-ink-2"
                    >
                        {props.orbState === "listening" && <span className="h-2 w-2 animate-pulse rounded-full bg-miss" />}
                        {label}
                        {props.status !== "off" && props.orbState === "listening" && <Square className="ml-1 h-3.5 w-3.5 fill-ink-3 text-ink-3" />}
                    </motion.p>
                </AnimatePresence>

                <div className="mt-6 min-h-[96px] w-full max-w-md text-center">
                    {props.lastUser && <p className="line-clamp-2 text-[15px] text-ink-3">“{props.lastUser}”</p>}
                    <AnimatePresence mode="wait">
                        {props.lastAssistant && (
                            <motion.p
                                key={props.lastAssistant}
                                initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
                                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                                className="mt-2 text-[20px] font-medium leading-snug text-ink"
                            >
                                {props.lastAssistant}
                            </motion.p>
                        )}
                    </AnimatePresence>
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
                                    className="rounded-full bg-card px-4 py-2.5 text-[14px] font-medium text-ink ring-1 ring-line transition-colors active:bg-paper-2 disabled:opacity-50"
                                >
                                    {t(k)}
                                </button>
                            ))}
                        </div>
                    )
                )}
            </div>
        </div>
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
    const [recording, setRecording] = useState(false)
    const recRef = useRef<MediaRecorder | null>(null)
    const endRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
    }, [props.messages.length, props.busy])

    const toggleMic = async () => {
        if (recording) {
            recRef.current?.stop()
            return
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
            const rec = new MediaRecorder(stream)
            const chunks: BlobPart[] = []
            rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)
            rec.onstop = () => {
                stream.getTracks().forEach((tr) => tr.stop())
                setRecording(false)
                void props.onAudio(new Blob(chunks, { type: rec.mimeType || "audio/webm" }))
            }
            recRef.current = rec
            rec.start()
            setRecording(true)
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
        <div className="flex flex-1 flex-col">
            <div className="flex-1 space-y-3 px-4 pb-4 pt-4">
                {props.messages.map((m) => (
                    <div key={m.id} className={cn("flex flex-col gap-2", m.role === "user" ? "items-end" : "items-start")}>
                        {m.content && (
                            <div
                                className={cn(
                                    "max-w-[85%] whitespace-pre-wrap rounded-[22px] px-4 py-3 text-[16px] leading-relaxed",
                                    m.role === "user" ? "rounded-br-md bg-ink text-paper" : "rounded-bl-md bg-card text-ink ring-1 ring-line",
                                )}
                            >
                                {m.role === "assistant" && (
                                    <span className="mb-1 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-saffron">
                                        <span className="h-2.5 w-2.5 rounded-full bg-gradient-to-br from-[#ffb36b] to-[#7b61ff]" /> {t("munshi")}
                                    </span>
                                )}
                                {m.content}
                            </div>
                        )}
                        {m.proposals?.map((p) => (
                            <div key={p.id} className="w-full max-w-[92%]">
                                <ProposalCard p={p} compact busy={props.confirming === p.id} onConfirm={() => props.onConfirm(p)} onCancel={() => props.onCancel(p)} />
                            </div>
                        ))}
                    </div>
                ))}
                {props.busy && (
                    <div className="flex items-center gap-2 px-1 text-[14px] text-ink-3">
                        <Loader size={18} dotSize={2} /> {t("thinking")}
                    </div>
                )}
                {!props.hasCustomers && <StartCards />}
                {props.empty && props.hasCustomers && (
                    <div className="flex flex-wrap gap-2 pt-2">
                        {SUGGESTIONS.map((k) => (
                            <button
                                key={k}
                                type="button"
                                onClick={() => props.onSend(t(k))}
                                className="rounded-full bg-card px-4 py-2.5 text-[14px] font-medium text-ink ring-1 ring-line active:bg-paper-2"
                            >
                                {t(k)}
                            </button>
                        ))}
                    </div>
                )}
                <div ref={endRef} />
            </div>

            <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] bg-gradient-to-t from-paper via-paper to-paper/0 px-4 pb-3 pt-4">
                <div className="flex items-end gap-2 rounded-[26px] bg-card p-2 pl-4 shadow-[0_10px_30px_-16px_rgb(42_33_24/0.4)] ring-1 ring-line focus-within:ring-2 focus-within:ring-saffron">
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
                        placeholder={recording ? t("listening") : t("typeMessage")}
                        className="max-h-32 min-h-11 flex-1 resize-none [resize:none] border-0 bg-transparent px-0 py-2.5 text-[17px] text-ink shadow-none outline-none placeholder:text-ink-3 focus-visible:ring-0"
                    />
                    {text.trim() ? (
                        <button type="button" onClick={submit} disabled={props.busy} aria-label={t("send")} className="flex h-11 w-11 items-center justify-center rounded-full bg-ink text-paper disabled:opacity-40">
                            <ArrowUp className="h-5 w-5" />
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={toggleMic}
                            disabled={props.busy}
                            aria-label={recording ? t("tapToStop") : t("modeVoice")}
                            className={cn("flex h-11 w-11 items-center justify-center rounded-full transition-colors disabled:opacity-40", recording ? "animate-pulse bg-miss text-white" : "bg-saffron-soft text-saffron")}
                        >
                            {recording ? <Square className="h-4 w-4 fill-white" /> : <Mic className="h-5 w-5" />}
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
