import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Times every database query made inside `withRequestTiming` (each Neon HTTP query is one fetch, so
 * the driver's fetch hook sees them all). Feeds a `Server-Timing` header: the browser's "waiting"
 * minus this is the cold start, CPU and network. Only a count and durations ever leave the server.
 */
interface Scope {
    count: number;
    ms: number;
}

const store = new AsyncLocalStorage<Scope>();

export function noteQuery(ms: number): void {
    const s = store.getStore();
    if (!s) return;
    s.count++;
    s.ms += ms;
}

export async function withRequestTiming<T>(fn: () => Promise<T>): Promise<{ result: T; db: Scope; totalMs: number }> {
    const scope: Scope = { count: 0, ms: 0 };
    const t0 = Date.now();
    const result = await store.run(scope, fn);
    return { result, db: scope, totalMs: Date.now() - t0 };
}

export function serverTimingHeader(t: { db: Scope; totalMs: number }): string {
    return `db;dur=${Math.round(t.db.ms)};desc="${t.db.count} queries", app;dur=${Math.round(t.totalMs)}`;
}
