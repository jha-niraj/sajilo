"use client"

import { motion } from "framer-motion"
import { cn } from "@repo/ui/lib/utils"
import { BrandMark } from "@/components/brand"
import { LangToggle } from "@/components/lang-toggle"
import { useI18n } from "@/lib/i18n"

/**
 * Shared shell for login and sign-up: warm glow, brand, language, optional step progress.
 * `stepKey` drives a gentle slide between steps so the flow feels like one continuous card.
 */
export function AuthFrame({
    children,
    stepKey,
    step,
    steps,
    direction = 1,
}: {
    children: React.ReactNode
    stepKey?: string
    step?: number
    steps?: number
    direction?: 1 | -1
}) {
    const { t } = useI18n()
    return (
        <main className="relative min-h-dvh overflow-hidden">
            <div aria-hidden className="pointer-events-none absolute inset-0">
                <div className="absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,rgb(232_140_70/0.28),transparent_65%)] blur-2xl" />
                <div className="absolute -bottom-48 -left-24 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle_at_center,rgb(108_85_201/0.12),transparent_65%)] blur-2xl" />
                <div className="absolute inset-0 bg-[radial-gradient(rgb(42_33_24/0.05)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:linear-gradient(to_bottom,black,transparent_70%)]" />
            </div>

            <div className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 pt-safe pb-safe">
                <header className="flex items-center justify-between pt-5">
                    <div className="flex items-center gap-2.5">
                        <BrandMark size={38} />
                        <div className="leading-tight">
                            <p className="text-[16px] font-semibold text-ink">{t("appName")}</p>
                            <p className="text-[13px] text-ink-3">{t("tagline")}</p>
                        </div>
                    </div>
                    <LangToggle />
                </header>

                {steps && step !== undefined && (
                    <div className="mt-7 flex gap-1.5" aria-hidden>
                        {Array.from({ length: steps }, (_, i) => (
                            <span key={i} className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink/10">
                                <motion.span
                                    className="block h-full rounded-full bg-saffron"
                                    initial={false}
                                    animate={{ width: i < step ? "100%" : i === step ? "45%" : "0%" }}
                                    transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                                />
                            </span>
                        ))}
                    </div>
                )}

                {/* Enter-only: the next step mounts (and focuses) immediately, so typing is never lost to an exit animation. */}
                <motion.div
                    key={stepKey ?? "single"}
                    initial={{ opacity: 0, x: 24 * direction }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                    className="flex flex-1 flex-col"
                >
                    {children}
                </motion.div>
            </div>
        </main>
    )
}

export type AuthArtName = "welcome" | "phone" | "name" | "pin" | "confirm" | "done"

/** Step illustration (transparent cut-out). Height follows the screen so the input stays above the keyboard. */
export function AuthArt({ name, className }: { name: AuthArtName; className?: string }) {
    return (
        // eslint-disable-next-line @next/next/no-img-element -- static WebP; no image optimizer on Workers
        <img
            src={`/images/auth/${name}.webp`}
            alt=""
            aria-hidden
            decoding="async"
            fetchPriority="high"
            className={cn("pointer-events-none mx-auto block h-[min(24dvh,200px)] w-auto select-none", className)}
        />
    )
}

export function AuthHeading({ title, sub, art }: { title: string; sub?: React.ReactNode; art?: AuthArtName }) {
    return (
        <div className={art ? "mt-4" : "mt-10"}>
            {art && <AuthArt name={art} className="mb-3" />}
            <h1 className="text-[26px] font-semibold leading-[1.15] tracking-[-0.01em] text-ink">{title}</h1>
            {sub && <p className="mt-2 text-[15px] leading-snug text-ink-2">{sub}</p>}
        </div>
    )
}
