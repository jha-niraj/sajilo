"use client";

import { DotmSquare11 } from "./dotm-square-11";

interface LoaderProps {
    /** Visual size in px (default 32) */
    size?: number;
    /** Dot size in px (default 4) */
    dotSize?: number;
    /** Optional wrapper className */
    className?: string;
    /** Aria label (default "Loading") */
    label?: string;
}

/** Full-page centred loader */
export function PageLoader({ label = "Loading" }: { label?: string }) {
    return (
        <div className="flex min-h-screen items-center justify-center bg-white dark:bg-neutral-950">
            <DotmSquare11 size={36} dotSize={5} speed={1.25} ariaLabel={label} />
        </div>
    );
}

/** Inline / inline-flex loader for buttons, cards, etc. */
export function Loader({ size = 32, dotSize = 4, className, label = "Loading" }: LoaderProps) {
    return (
        <span className={className} aria-label={label}>
            <DotmSquare11 size={size} dotSize={dotSize} speed={1.25} />
        </span>
    );
}

/** Centred loader for a section/card (not full page) */
export function SectionLoader({ label = "Loading" }: { label?: string }) {
    return (
        <div className="flex h-40 w-full items-center justify-center">
            <DotmSquare11 size={32} dotSize={4} speed={1.25} ariaLabel={label} />
        </div>
    );
}

/** Kept for apps written against the earlier loader API (admin app). */
export function InlineLoader({ size = 24, className }: { size?: number; className?: string }) {
    return <Loader size={size} dotSize={Math.max(2, Math.round(size / 8))} className={className} />;
}
