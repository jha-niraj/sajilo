'use client';

import { useEffect, useState } from 'react';
import { Eye } from 'lucide-react';

/**
 * The always-visible banner while Gurukul support views an account (plan/admin/security/impersonation.md).
 *
 * Mounted once in the root layout of each app that can be viewed (apps/main, apps/shishya-main). It
 * renders nothing unless the display-only cookie `cookieName` holds `{ name, expiresAt }` - set by
 * the impersonation hand-off with the session's own lifetime. That cookie grants nothing: the
 * session row's `impersonatedBy` is what turns every write off on the server. It is a cookie, not a
 * server read, because `/m` is a static, offline shell that must not read the server to draw it.
 *
 * Stop POSTs `stopPath` (the app's better-auth endpoint), which ends the session, records it and
 * answers with the admin console URL to return to. At zero the page reloads: the session has ended,
 * and the app sends the browser to sign in.
 *
 * Neutral surface, amber for the "view only" signal - the approved colours, no green surface.
 */

interface Hint {
    name: string;
    expiresAt: number;
}

/** Same shape as `readImpersonationHint` in @repo/auth/impersonation-constants (ui does not depend on auth). */
function readHint(cookieName: string): Hint | null {
    if (typeof document === 'undefined') return null;
    for (const part of document.cookie.split(';')) {
        const idx = part.indexOf('=');
        if (idx === -1 || part.slice(0, idx).trim() !== cookieName) continue;
        try {
            const v = JSON.parse(decodeURIComponent(part.slice(idx + 1).trim())) as Partial<Hint>;
            if (typeof v.name === 'string' && typeof v.expiresAt === 'number' && v.expiresAt > Date.now()) {
                return { name: v.name, expiresAt: v.expiresAt };
            }
        } catch {
            return null;
        }
    }
    return null;
}

function mmss(ms: number): string {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function ViewAsBanner({ cookieName, stopPath }: { cookieName: string; stopPath: string }) {
    const [hint, setHint] = useState<Hint | null>(null);
    const [now, setNow] = useState(() => Date.now());
    const [stopping, setStopping] = useState(false);
    const [failed, setFailed] = useState(false);

    // Read after mount: the cookie is the browser's, and the server render must match "nothing".
    useEffect(() => {
        setHint(readHint(cookieName));
    }, [cookieName]);

    useEffect(() => {
        if (!hint) return;
        const id = window.setInterval(() => {
            const t = Date.now();
            setNow(t);
            if (t >= hint.expiresAt) {
                window.clearInterval(id);
                window.location.reload();
            }
        }, 1000);
        return () => window.clearInterval(id);
    }, [hint]);

    if (!hint) return null;

    const stop = async () => {
        if (stopping) return;
        setStopping(true);
        setFailed(false);
        try {
            const res = await fetch(stopPath, {
                method: 'POST',
                credentials: 'include',
                headers: { 'content-type': 'application/json' },
                body: '{}',
            });
            const body = (await res.json().catch(() => null)) as { redirectTo?: unknown } | null;
            if (!res.ok || typeof body?.redirectTo !== 'string') throw new Error(`stop failed: ${res.status}`);
            window.location.assign(body.redirectTo);
        } catch {
            setStopping(false);
            setFailed(true);
        }
    };

    return (
        <div
            role="status"
            aria-live="polite"
            className="pointer-events-none fixed inset-x-0 top-2 z-[200] flex justify-center px-4"
        >
            <div className="pointer-events-auto flex max-w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl bg-white px-3 py-2 text-xs shadow-lg ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-800">
                <span className="flex min-w-0 items-center gap-1.5">
                    <Eye className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                    <span className="min-w-0 text-neutral-700 dark:text-neutral-200">
                        Viewing as <span className="font-semibold text-neutral-900 dark:text-white">{hint.name}</span>
                        {' - '}
                        <span className="font-medium text-amber-700 dark:text-amber-300">Gurukul support, view only</span>
                        {' - ends in '}
                        <span className="font-mono tabular-nums">{mmss(hint.expiresAt - now)}</span>
                    </span>
                </span>
                {failed && <span className="text-rose-600 dark:text-rose-400">Could not stop - try again</span>}
                <button
                    type="button"
                    onClick={stop}
                    disabled={stopping}
                    className="cursor-pointer rounded-xl px-2.5 py-1 font-semibold text-neutral-900 ring-1 ring-neutral-300 hover:bg-neutral-100 disabled:cursor-default disabled:opacity-60 dark:text-white dark:ring-neutral-700 dark:hover:bg-neutral-800"
                >
                    {stopping ? 'Stopping...' : 'Stop'}
                </button>
            </div>
        </div>
    );
}
