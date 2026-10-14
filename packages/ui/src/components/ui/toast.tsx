'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { CircleCheckIcon, InfoIcon, OctagonXIcon, TriangleAlertIcon, XIcon } from 'lucide-react'
import { useTheme } from 'next-themes'
import { cn } from '../../lib/utils'
import { playSound } from './sounds'

/**
 * The toast system, replacing sonner.
 *
 * ## A DROP-IN, on purpose
 *
 * 335 files raise toasts, and the surface they use was measured rather than guessed: `error` 1,230,
 * `success` 716, `info` 23, `warning` 13, `message` 3, with ZERO bare `toast()` calls and no
 * `promise`, `loading` or `custom`. Options in use are `description`, `duration`, `id` and `action`.
 *
 * So the API below mirrors that exactly, which made the migration an import swap with no call site
 * touched. Designing a nicer API would have meant editing 335 files, and every edit is a chance to
 * change what a message says.
 *
 * `id` and `action` are the two that nearly got left out. They appear at only four places - but one
 * of those is `toastError`, the shared helper 45 files call, so "rare" in a grep meant "on the path
 * every failure in the app takes". A single-line grep does not find an option written on its own
 * line; counting call sites is not the same as counting what runs.
 *
 * ## The store is a module-level list, not a context
 *
 * `toast.error(...)` is called from server-action handlers, stores and plain functions - places with
 * no React tree above them. A context would force every one of those to become a hook. A
 * module-level subscription list lets the call stay a function call, which is the whole reason the
 * sonner API was pleasant to use.
 *
 * ## Colours are inverted against the page, and that is inherited deliberately
 *
 * Light mode gets a near-black toast, dark mode a warm beige one. That was the previous wrapper's
 * decision and it is a good one: a toast is a temporary overlay, and being the opposite of the page
 * is what stops it reading as part of the page. Keeping it means nothing about the product looks
 * different on the day sonner is deleted.
 */

export type ToastKind = 'success' | 'error' | 'info' | 'warning' | 'message'

export interface ToastOptions {
    description?: string
    /** Milliseconds. Defaults by kind - errors are given longer, see DURATION. */
    duration?: number
    /**
     * A stable key. A second toast with the same `id` REPLACES the first in place instead of
     * stacking - which is what turns "save failed" x8 from a bulk action into one message.
     */
    id?: string
    /** One button on the toast. Used for Retry, and for jumping to the thing just created. */
    action?: { label: string; onClick: () => void }
}

interface ToastItem {
    key: string
    kind: ToastKind
    message: string
    description?: string
    duration: number
    action?: { label: string; onClick: () => void }
}

/**
 * Errors stay longer than anything else.
 *
 * A success confirms something the reader just did - they already know, and four seconds is
 * generous. An error is news, usually a sentence that has to be READ, and the reader may be looking
 * at the field they just left rather than at the toast.
 */
const DURATION: Record<ToastKind, number> = {
    success: 4000,
    error: 7000,
    warning: 6000,
    info: 5000,
    message: 5000,
}

/**
 * The most toasts on screen at once.
 *
 * Past three the oldest is gone before it is read, and a per-row bulk failure can raise dozens.
 * Dropping the oldest keeps the newest, which for a run of failures is the one still relevant.
 */
const MAX_VISIBLE = 3

/**
 * What is shown when the message is `undefined`.
 *
 * Ten call sites write `toast.error(result.error)` against an `error` that is optional on the
 * failure type. Sonner took a ReactNode and rendered `undefined` as nothing, so those ten produced
 * a black box with an icon and no words - a failure the reader could see but not read.
 *
 * The signature below is `string | undefined` rather than `string` so those sites keep compiling,
 * and this map is what makes that safe. It is deliberately NOT optional (`message?:`), so calling
 * `toast.error()` with no argument at all is still a type error.
 */
const FALLBACK: Record<ToastKind, string> = {
    success: 'Done.',
    error: 'Something went wrong. Please try again.',
    warning: 'Something needs your attention.',
    info: 'Something happened.',
    message: 'Something happened.',
}

let seq = 0
let items: ToastItem[] = []
const listeners = new Set<(v: ToastItem[]) => void>()
const timers = new Map<string, ReturnType<typeof setTimeout>>()

function emit() {
    // A fresh array each time: the listeners are React setState, and a mutated array is the same
    // reference, so nothing would re-render.
    const snapshot = [...items]
    for (const l of listeners) l(snapshot)
}

function clearTimer(key: string) {
    const t = timers.get(key)
    if (t) {
        clearTimeout(t)
        timers.delete(key)
    }
}

function dismiss(key: string) {
    clearTimer(key)
    items = items.filter((t) => t.key !== key)
    emit()
}

function push(kind: ToastKind, message: string | undefined, opts?: ToastOptions): string {
    const key = opts?.id ?? `t${++seq}`
    const item: ToastItem = {
        key,
        kind,
        message: message?.trim() || FALLBACK[kind],
        description: opts?.description,
        duration: opts?.duration ?? DURATION[kind],
        action: opts?.action,
    }

    const at = items.findIndex((t) => t.key === key)
    const replacing = at >= 0
    if (replacing) {
        // In PLACE, not appended. A deduped burst that jumped to the bottom of the stack each time
        // would shove the other two toasts around once per failure, which is the jitter the dedupe
        // existed to remove.
        const next = [...items]
        next[at] = item
        items = next
        clearTimer(key)
    } else {
        items = [...items, item].slice(-MAX_VISIBLE)
    }
    emit()

    // Only on a NEW toast, and only for these two kinds - see the note in sounds.tsx. A replacement
    // is by definition a repeat of something the reader has already been told about, and eight
    // identical chimes for eight identical failures is noise, not information. `playSound` checks
    // the preference itself, so there is no second place that can disagree about whether sound is on.
    if (!replacing && (kind === 'success' || kind === 'error')) playSound(kind)

    if (item.duration > 0) {
        timers.set(key, setTimeout(() => dismiss(key), item.duration))
    }
    return key
}

/**
 * The public API. Shaped exactly like the sonner calls it replaces.
 */
export const toast = {
    success: (message: string | undefined, opts?: ToastOptions) => push('success', message, opts),
    error: (message: string | undefined, opts?: ToastOptions) => push('error', message, opts),
    info: (message: string | undefined, opts?: ToastOptions) => push('info', message, opts),
    warning: (message: string | undefined, opts?: ToastOptions) => push('warning', message, opts),
    message: (message: string | undefined, opts?: ToastOptions) => push('message', message, opts),
    dismiss,
}

const ICON: Record<ToastKind, typeof InfoIcon> = {
    success: CircleCheckIcon,
    error: OctagonXIcon,
    warning: TriangleAlertIcon,
    info: InfoIcon,
    message: InfoIcon,
}

export type ToasterPosition = 'top-right' | 'top-center' | 'bottom-right' | 'bottom-center'

const PLACEMENT: Record<ToasterPosition, string> = {
    'top-right': 'top-4 right-4 items-end',
    'top-center': 'top-4 left-1/2 -translate-x-1/2 items-center',
    'bottom-right': 'bottom-4 right-4 items-end',
    'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2 items-center',
}

export interface ToasterProps {
    position?: ToasterPosition
    closeButton?: boolean
    /**
     * Accepted and ignored.
     *
     * A sonner-ism: it asked sonner to tint success and error instead of using one neutral surface.
     * This toaster always colours by kind, so there is nothing to switch on - the prop stays in the
     * signature only so the existing mounts compile unchanged rather than being edited during a
     * migration whose whole point was not editing call sites.
     */
    richColors?: boolean
}

/**
 * The host. One per app, in the root layout.
 *
 * Rendered through a PORTAL to `document.body`, which is not a detail: a toast mounted inside the
 * layout tree inherits any ancestor's `transform`, `filter` or `overflow`, and any one of those
 * turns `position: fixed` into "fixed relative to that ancestor". The Deck's window layer and the
 * playful shell both apply transforms, so a toast raised from either would otherwise be clipped or
 * positioned against the wrong box.
 */
export function Toaster({ position = 'top-right', closeButton = false }: ToasterProps) {
    const [list, setList] = useState<ToastItem[]>([])
    const [mounted, setMounted] = useState(false)
    const { resolvedTheme } = useTheme()
    const isDark = resolvedTheme === 'dark'

    useEffect(() => {
        setMounted(true)
        listeners.add(setList)
        return () => {
            listeners.delete(setList)
        }
    }, [])

    // No portal target during SSR, and `resolvedTheme` is undefined on the first client pass - so
    // rendering before mount would paint every toast in the light palette for a frame.
    if (!mounted) return null

    // Inverted against the page, inherited from the wrapper this replaces. Literals rather than
    // tokens because the inversion is the point: a token would follow the page.
    const bg = isDark ? '#EDE8D0' : '#0a0a0a'
    const fg = isDark ? '#1c1917' : '#fafafa'
    const border = isDark ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.08)'
    const accent: Record<ToastKind, string> = {
        success: isDark ? '#15803d' : '#4ade80',
        error: isDark ? '#b91c1c' : '#f87171',
        warning: isDark ? '#b45309' : '#fbbf24',
        info: fg,
        message: fg,
    }

    return createPortal(
        <div
            // `z-[100]`, above the modal layer at z-50. A toast raised BY a dialog - "could not
            // save" - has to be visible over it, or the one message explaining why nothing happened
            // is hidden behind the thing that failed.
            className={cn(
                'pointer-events-none fixed z-[100] flex w-[min(92vw,380px)] flex-col gap-2',
                PLACEMENT[position],
            )}
            role="region"
            aria-label="Notifications"
        >
            {list.map((t) => {
                const Icon = ICON[t.kind]
                return (
                    <div
                        key={t.key}
                        // `assertive` for an error so a screen reader interrupts with it, polite for
                        // everything else, which waits for a pause. A failure is the one case where
                        // interrupting is correct.
                        role={t.kind === 'error' ? 'alert' : 'status'}
                        aria-live={t.kind === 'error' ? 'assertive' : 'polite'}
                        className="gk-toast-in pointer-events-auto flex w-full items-start gap-2.5 rounded-[var(--radius)] px-3.5 py-3 shadow-[0_12px_32px_-12px_rgba(0,0,0,0.45)]"
                        style={{ background: bg, color: fg, border: `1px solid ${border}` }}
                    >
                        <Icon className="mt-[1px] size-4 shrink-0" style={{ color: accent[t.kind] }} />
                        <div className="min-w-0 flex-1">
                            <p
                                className="text-[13.5px] leading-snug font-medium"
                                style={{ color: accent[t.kind] }}
                            >
                                {t.message}
                            </p>
                            {t.description && (
                                // `currentColor` at 80%, never a grey from a scale. The wrapper this
                                // replaces carried a comment about exactly that: sonner coloured the
                                // description from its own grey scale, which is inverted against this
                                // background and left it near-invisible.
                                <p className="mt-0.5 text-[12.5px] leading-snug opacity-80">
                                    {t.description}
                                </p>
                            )}
                            {t.action && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        t.action?.onClick()
                                        // The action is the whole point of the toast - once it has
                                        // been taken, leaving the message up invites a second press.
                                        dismiss(t.key)
                                    }}
                                    className="mt-2 cursor-pointer rounded-md px-2 py-1 text-[12px] font-medium transition-opacity hover:opacity-80"
                                    style={{ background: fg, color: bg }}
                                >
                                    {t.action.label}
                                </button>
                            )}
                        </div>
                        {closeButton && (
                            <button
                                type="button"
                                onClick={() => dismiss(t.key)}
                                aria-label="Dismiss"
                                className="-mr-1 shrink-0 cursor-pointer rounded-md p-0.5 opacity-60 transition-opacity hover:opacity-100"
                            >
                                <XIcon className="size-3.5" />
                            </button>
                        )}
                    </div>
                )
            })}

            {/* Scoped to this component, so the package carries its own entrance and no app has to
                remember a keyframe. `prefers-reduced-motion` drops the travel and keeps the fade -
                the preference asks for less motion, not for things to appear instantly. */}
            <style>{`
                @keyframes gk-toast-in {
                    from { opacity: 0; transform: translateY(-8px) scale(0.98); }
                    to   { opacity: 1; transform: translateY(0) scale(1); }
                }
                .gk-toast-in { animation: gk-toast-in 180ms cubic-bezier(0.22,1,0.36,1) both; }
                @media (prefers-reduced-motion: reduce) {
                    .gk-toast-in { animation: none; }
                }
            `}</style>
        </div>,
        document.body,
    )
}

export default toast
