'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { CheckIcon, ChevronDownIcon, XIcon } from 'lucide-react'
import { cn } from '../../lib/utils'

/**
 * The agent's work, shown as it happens.
 *
 * ## What this actually shows, and what it deliberately does not
 *
 * These are TOOL CALLS - "Reading attendance", "Queried the database" - not the model thinking out
 * loud. Our stream carries `tool-call` / `tool-result` / `tool-error` and no reasoning part, and the
 * default model does not emit reasoning tokens at all. A component that dressed a tool timeline up
 * as a train of thought would be a lie the first curious user catches, so the wording everywhere
 * here is about what was DONE, never about what was thought.
 *
 * ## Why it collapses when the turn ends
 *
 * While a turn is running the steps are the only thing on screen, so they are the content and they
 * are open. Once the answer arrives, they are provenance - worth having, not worth re-reading - and
 * a six-row timeline above every past reply turns a transcript into a log file. So a finished group
 * folds to one line the reader can open again.
 *
 * It does NOT fold on its own while anything is still running, and it never folds a group that ends
 * in an error: a failure is the one case where the detail is the point.
 *
 * ## The rail is drawn with two elements, not per-step borders
 *
 * A continuous track plus a `scaleY` fill that follows progress. Per-step border segments look
 * identical at rest and cannot animate as one movement - and the last one always needs a special
 * case to stop the line dangling past the final dot.
 */

export type ReasoningStepStatus = 'running' | 'done' | 'error'

export interface ReasoningStep {
    id: string
    /** What to show. Already resolved to human words by the caller. */
    label: string
    /**
     * The raw tool name (`getWhoIsAbsentToday`), shown as a small mono chip beside the label when the
     * list has room. Optional - only the staff chat passes it. Showing WHICH tool answered is the most
     * direct proof that an answer came from the school's records (plan/main/saathi/chat-matches-the-demo.md, S1).
     */
    name?: string
    status: ReasoningStepStatus
    /** Epoch ms. Used only for the duration suffix, which is dropped when either end is missing. */
    startedAt?: number
    endedAt?: number
}

/** `1.4s`, or nothing at all when the step was too quick to be worth a number. */
function duration(step: ReasoningStep): string | null {
    if (!step.startedAt || !step.endedAt) return null
    const ms = step.endedAt - step.startedAt
    // Under 300ms the number is noise - it says "instant", which the absence of a number already
    // says, and a column of "0.1s" reads as clutter rather than as information.
    if (ms < 300) return null
    return `${Math.round(ms / 100) / 10}s`
}

function Mark({ status, still }: { status: ReasoningStepStatus; still: boolean }) {
    if (status === 'error') {
        return (
            <span className="flex h-full w-full items-center justify-center rounded-full bg-rose-500 text-white">
                <XIcon className="h-2.5 w-2.5" strokeWidth={3} />
            </span>
        )
    }
    if (status === 'done') {
        return (
            <motion.span
                // The tick POPS. It is the one moment of feedback in the whole component, and a
                // check that fades in reads as "was always there" rather than "just happened".
                initial={still ? false : { scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 520, damping: 22 }}
                className="flex h-full w-full items-center justify-center rounded-full bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
            >
                <CheckIcon className="h-2.5 w-2.5" strokeWidth={3.5} />
            </motion.span>
        )
    }
    // Running: a filled dot with a halo breathing out of it. Not a spinner - a spinner is the
    // house signal for "a control you pressed is working", and several spinners stacked in a
    // column read as several separate stuck buttons.
    return (
        <span className="relative flex h-full w-full items-center justify-center">
            {!still && (
                <motion.span
                    className="absolute inset-0 rounded-full bg-neutral-400/40 dark:bg-neutral-500/40"
                    animate={{ scale: [1, 1.9, 1], opacity: [0.55, 0, 0.55] }}
                    transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
                />
            )}
            <span className="relative h-1.5 w-1.5 rounded-full bg-neutral-500 dark:bg-neutral-400" />
        </span>
    )
}

export function ReasoningSteps({
    steps,
    /** True while the turn is still streaming. Keeps the group open and the summary live. */
    active = false,
    className,
}: {
    steps: ReasoningStep[]
    active?: boolean
    className?: string
}) {
    const reduced = useReducedMotion()
    /*
     * Open while the turn runs, closed when this is history.
     *
     * `steps` are hydrated back onto a reloaded conversation from `metadata.steps`
     * (`hydrate-messages.ts`), so a long transcript really can render twenty of these at once. An
     * always-open default would turn re-opening yesterday's chat into a wall of timelines above
     * every reply. A group that FAILED opens either way - there the detail is the message.
     */
    const [open, setOpen] = useState(() => active || steps.some((s) => s.status === 'error'))
    // Distinguishes "rendered as history" from "just happened". A conversation reloaded from the
    // database must not replay twenty ticks popping in; only steps that arrive while this component
    // is already mounted animate.
    const mountedRef = useRef(false)
    useEffect(() => {
        mountedRef.current = true
    }, [])

    const failed = steps.some((s) => s.status === 'error')
    const running = steps.filter((s) => s.status === 'running').length
    const settled = steps.length - running

    // Auto-fold when the turn finishes, and only then. Never on a failure - there the detail IS the
    // message. `active` going false is an edge, so this cannot fight a reader who opened it again:
    // once folded, nothing re-folds it.
    const wasActive = useRef(active)
    useEffect(() => {
        if (wasActive.current && !active && !failed) setOpen(false)
        wasActive.current = active
    }, [active, failed])

    if (steps.length === 0) return null

    const still = Boolean(reduced) || !mountedRef.current
    const progress = steps.length === 0 ? 0 : settled / steps.length

    // While running, the folded line is the step in flight - so a collapsed group is still a live
    // status rather than a count that will not change until the end.
    const errors = steps.filter((s) => s.status === 'error').length
    const summary = active
        ? (steps.find((s) => s.status === 'running')?.label ?? 'Working')
        : failed
            ? `${errors} of ${steps.length} failed`
            : `Did ${steps.length} ${steps.length === 1 ? 'thing' : 'things'}`

    return (
        <div
            className={cn(
                'w-fit max-w-full overflow-hidden rounded-xl border border-neutral-200 bg-white/70 dark:border-neutral-800 dark:bg-neutral-900/50',
                className,
            )}
        >
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                className="flex w-full cursor-pointer items-center gap-2 px-2.5 py-1.5 text-left transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
            >
                <span className="relative flex h-3 w-3 shrink-0 items-center justify-center">
                    <Mark status={active ? 'running' : failed ? 'error' : 'done'} still={still} />
                </span>
                <span
                    className={cn(
                        'min-w-0 flex-1 truncate text-xs font-medium',
                        failed && !active
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-neutral-600 dark:text-neutral-400',
                    )}
                >
                    {summary}
                    {active && <span className="gk-rs-ellipsis" aria-hidden />}
                </span>
                <ChevronDownIcon
                    className={cn(
                        'h-3 w-3 shrink-0 text-neutral-400 transition-transform duration-200',
                        open && 'rotate-180',
                        reduced && 'transition-none',
                    )}
                />
            </button>

            <AnimatePresence initial={false}>
                {open && (
                    <motion.div
                        // Height, not display. A `hidden` list cannot animate, and the reader who
                        // just opened this wants to see it arrive rather than blink into place.
                        initial={still ? false : { height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={still ? { opacity: 0 } : { height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                        style={{ overflow: 'hidden' }}
                    >
                        <div className="relative px-2.5 pb-2">
                            {/* The rail: one track, one fill that grows with progress. */}
                            <span
                                aria-hidden
                                className="absolute left-[13px] top-1 bottom-3 w-px bg-neutral-200 dark:bg-neutral-800"
                            />
                            <motion.span
                                aria-hidden
                                className="absolute left-[13px] top-1 bottom-3 w-px origin-top bg-neutral-900 dark:bg-neutral-100"
                                initial={still ? false : { scaleY: 0 }}
                                animate={{ scaleY: progress }}
                                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                            />

                            <ul className="@container relative flex flex-col gap-1">
                                {steps.map((step, i) => {
                                    const secs = duration(step)
                                    return (
                                        <motion.li
                                            key={step.id}
                                            initial={still ? false : { opacity: 0, x: -4 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ duration: 0.18, delay: still ? 0 : Math.min(i, 6) * 0.03 }}
                                            className="flex items-center gap-2"
                                        >
                                            <span className="relative z-10 flex h-3 w-3 shrink-0 items-center justify-center rounded-full bg-white dark:bg-neutral-900">
                                                <Mark status={step.status} still={still} />
                                            </span>
                                            <span
                                                className={cn(
                                                    'min-w-0 flex-1 truncate text-xs',
                                                    step.status === 'running'
                                                        ? 'text-neutral-500 dark:text-neutral-400'
                                                        : step.status === 'error'
                                                            ? 'text-rose-600 dark:text-rose-400'
                                                            : 'text-neutral-700 dark:text-neutral-300',
                                                )}
                                            >
                                                {step.label}
                                                {step.status === 'running' && (
                                                    <span className="gk-rs-ellipsis" aria-hidden />
                                                )}
                                            </span>
                                            {step.name && (
                                                // A container query, not a viewport one: the docked chat panel is narrow on a wide
                                                // screen, so the chip appears only when the step LIST is at least 24rem wide.
                                                // neutral-600 on neutral-100 is ~7:1; neutral-400 on neutral-800 ~5.6:1.
                                                <code className="hidden shrink-0 rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-[10.5px] text-neutral-600 @sm:inline dark:bg-neutral-800 dark:text-neutral-400">
                                                    {step.name}
                                                </code>
                                            )}
                                            {secs && (
                                                <span className="shrink-0 text-[11px] tabular-nums text-neutral-400 dark:text-neutral-600">
                                                    {secs}
                                                </span>
                                            )}
                                        </motion.li>
                                    )
                                })}
                            </ul>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* The trailing dots on a running label. CSS rather than three motion spans, so a list
                of running steps costs nothing, and `content` animation is the one way to do this
                without the text reflowing as the dots appear. */}
            <style>{`
                .gk-rs-ellipsis::after {
                    content: '';
                    animation: gk-rs-dots 1.4s steps(1, end) infinite;
                }
                @keyframes gk-rs-dots {
                    0%   { content: ''; }
                    25%  { content: '.'; }
                    50%  { content: '..'; }
                    75%  { content: '...'; }
                    100% { content: ''; }
                }
                @media (prefers-reduced-motion: reduce) {
                    .gk-rs-ellipsis::after { content: '...'; animation: none; }
                }
            `}</style>
        </div>
    )
}
