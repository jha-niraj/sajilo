# Speed pass: record (fast sign-in + navigation)

Following `ayudocs/docs/handoffs/fast-sign-in.md` and `navigation-speed.md`. Map taken 2026-10-16, read-only, before any change. Paths relative to `apps/main/` unless stated.

## How Sajilo differs from the playbooks

- Next **16.3** (playbooks: 15). `router.prefetch(href, { kind: 'auto' | 'full' })` takes a string kind; `auto` and the default prefetch a dynamic route down to its nearest `loading.tsx`.
- Sign-in is **phone + 4-digit PIN** through better-auth's `phoneNumber` plugin (playbooks: email). One role, no admin plugin.
- **No TanStack Query.** Data reaches pages as server-component props or through server actions; Today is offline-first (Dexie snapshot + outbox, `public/sw.js`).
- One deployed site (production on Workers); no staging.

## Auth map

| Item | Finding | Where |
|---|---|---|
| Hashing | native scrypt on Workers (`workerd` condition kept by OpenNext; built bundle uses `node:crypto` scrypt) | `@better-auth/utils@0.4.2`, `open-next.config.ts` |
| Plugins | `phoneNumber`, `emailOTP`; **no `nextCookies()`** | `packages/auth/src/auth.ts:140-168` |
| Session cookie cache | **off**: every session read = session query + user query (joins off) | `auth.ts:109-112` |
| Session reader | `cache(getServerSession)`, DB first | `lib/session.ts:6` |
| Rate limit | database storage: +2 sequential queries on every `/api/auth/*` request | `auth.ts:129-138` |
| Sign-in POST | rate limit (2) + user + account + scrypt + session insert = 5 trips | better-auth phone route |
| After sign-in | `updateSettings` server action POSTed to `/` with the new cookie: the middleware redirects it to `/munshi`, so it most likely never saves the language; then `window.location.replace('/munshi')` (full document load) | `app/(auth)/login/login-client.tsx:60-61`, `middleware.ts:22` |
| Sign-up | `signUpEmail` creates a session that is thrown away (no `nextCookies`), then a second full sign-in from the browser; a fixed 1.4 s "done" delay | `actions/auth.action.ts:27`, `signup-client.tsx:92,100` |
| Middleware | cookie presence only, no DB; redirects every kind of request (documents, RSC fetches, prefetches, actions) the same way; `/api` excluded by matcher | `middleware.ts` |
| Login page | dynamic: root layout `await cookies()` for the language | `app/layout.tsx:62` |
| First page `/munshi` | layout `requireCollectorId` (2 queries) then count (1) [+ conversation]; no `loading.tsx` | `app/(app)/layout.tsx`, `app/(app)/munshi/page.tsx` |
| After landing | SW warm-up fetches 11 full HTML pages in a row; bottom nav `<Link prefetch>` = 5 FULL dynamic prefetches | `components/shell/offline-bar.tsx:121-131`, `components/shell/bottom-nav.tsx` |
| Sign-out | one control (More profile card): flush, unsynced check, `signOut()` (rate limit 2 + delete), wipe Dexie + page caches, `window.location.replace('/')`; `/` never prefetched | `components/settings/more-client.tsx` |
| Placement | `"placement": { "mode": "smart" }`; Neon is `ap-southeast-1` | `wrangler.jsonc:12` |
| Timing headers | none (no `x-isolate-*`, no `Server-Timing`) | - |

## Pages map

| Route | loading.tsx | Real title in skeleton | Awaits before render | Notes |
|---|---|---|---|---|
| `/` login, `/signup` | none | - | nothing (layout reads cookie) | first paint is a Loader until localStorage is read |
| `/munshi` | none | - | session (2) → count (+ conversation) | own header, not PageTop |
| `/today` | yes | no | nothing (client data) | refreshes twice per sync (`today-client:32`, `offline-bar:56`) |
| `/today/finish` | inherits Today's | no (wrong shape) | nothing | |
| `/month` | yes | no | `fetchMonthReport` (session → 3 parallel → entries) | |
| `/loans` | yes | no | `fetchLoans` + `fetchSettings` (`getSettings` twice) | |
| `/loans/new`, `/loans/calculator`, `/loans/[id]` | inherit Loans' | no (wrong shapes) | 2-3 actions each, `getSettings` twice | |
| `/cash` | none | - | `fetchCashOnHand` | |
| `/customers/[id]` | yes | no | session → customer → entries (3 sequential) | |
| `/manage` | none | - | `listCustomers` | Suspense with no fallback |
| `/more` | none | - | session → user | |
| `/scan` | none | - | customers + settings + recent scans | |
| `/settings` | none | - | `fetchSettings` | |
| `/print/month` | none | - | session → report → `receivedBetween` again (duplicate query) | wide table clipped on a phone |

Repeated lookups: `getSettings` is not `cache()`d (twice per Loans page, twice per `fetchDaySnapshot`). `next.config.js` has no `staleTimes`.

## ScrollArea / overflow audit

No hand-rolled `overflow-auto|scroll` anywhere; all scroll containers are `ScrollArea`. To fix: print register clipped on phones (`app/print/month/page.tsx:74`); scan review row inputs lack `min-w-0` (`components/scan/scan-client.tsx`); small `min-w-0`/`shrink-0` gaps in manage paste preview, settings holidays, loan repayments, cash/breakdown labels, Munshi title.

## Decisions (asked 2026-10-16)

- Measure with `pnpm bench:nav` (copied from Gurukul) on production with a test account; he deploys and runs it. `pnpm bundle:size` for the Worker size.
- Home prefetched in full after sign-in: **Today**. Everything else as a shell, one at a time.
- Offline warm-up: kept, but after load and idle, one page every 350 ms.
- Allowed: Worker pinned to Singapore, 5-minute session cookie, sign-out before Next, static login page. Suspense where it pays.

## Done map

| Item | Status | Notes |
|---|---|---|
| Language save after sign-in (redirected action) | fixed | `LangSync` on the first signed-in page |
| Sign-in shape | fixed | route directly, `router.push`, landing shell with the destination's real skeleton, `returnTo` |
| Sign-up | fixed | signed in inside `signUpCollector` (`nextCookies`), no second sign-in; Munshi prefetched while "done" plays |
| Session cookie cache + `nextCookies()` last | fixed | `packages/auth/src/session-config.ts`, 5 min |
| Memoised session reader | ok | `lib/session.ts` already `cache()`d; better-auth now answers from the cookie |
| Middleware | fixed | document-only redirect off `/`, `returnTo`, isolate headers, no DB, no cookies set |
| Login and sign-up static | fixed | build route table: `/` and `/signup` are static (`index.html`, `signup.html` prerendered) |
| Native hashing | ok | no `@noble/hashes` scrypt in the server bundle |
| Sign-out | fixed | `worker.ts` answers `POST /api/sign-out` before Next; `/` prefetched; in-app push + refresh; offline copy wiped |
| Placement | fixed | `aws:ap-southeast-1` |
| Server-Timing on auth | fixed | `db;dur;desc="N queries"`, `app;dur` |
| A skeleton per page with the real title | fixed | 14 `loading.tsx`, `components/skeletons/page-skeletons.tsx`; verified in the browser on sign-in (Today) |
| Shared link, intent prefetch, eslint ban on `next/link` | fixed | `components/app-link.tsx` |
| Bottom-bar queue | fixed | Today FULL, rest AUTO, 350 ms apart, from idle |
| `staleTimes` | fixed | `{ dynamic: 30, static: 180 }` |
| `getSettings`, `receivedBetween` per request | fixed | `cache()`; removes the second settings read on Loans pages and the duplicate print query |
| Today refreshed twice per sync | fixed | one refresh (`OfflineBar`) |
| Overflow | fixed | print register scrolls sideways on a phone; min-w-0/shrink-0 gaps in scan, manage, settings, loans, cash, Munshi |
| Streaming | left | most pages are one client screen fed by one data shape; the skeleton gives the instant paint. `/loans/new`'s deadline is a form default, not a block. Deposit banner already streams. |
| Reads through Server Actions (`fetchDaySnapshot` etc.) | left | Today is offline-first through Dexie; the snapshot action also writes (fills missed days). A read route is a later pass. |
| `advanced.database.joins` | left | the cookie cache removes most session reads; joins need testing against the schema first (it broke Gurukul) |
| Rate-limit storage in the database (+2 queries per auth request) | left | needed: Workers isolates share no memory |
| Baseline numbers | open | no measurement was taken before the change: run `pnpm bench:nav` against production BEFORE deploying this build, then after |
| Worker size | ok | 15.88 MiB (4.37 MiB gzip), 24.8% of 64 MiB (`pnpm bundle:size`) |

## Plan as built (in this order)


1. Fix the post-sign-in language save; sign-in lands with `router.push` and the landing shell at once.
2. Session cookie cache (`compact`, one config file) + `nextCookies()` last; cookie-first memoised reader; `getSettings` cached per request.
3. Middleware: redirect document loads only (`Sec-Fetch-Dest`), 401 JSON for signed-out `/api/*`.
4. A `loading.tsx` for every page, drawn to its real layout with the real `PageTop` title.
5. Links: bottom nav prefetches shells one at a time (home in full); SW warm-up deferred and queued after idle.
6. Sign-out: prefetch `/` on mount and intent, clear cookies first, in-app navigation.
7. Placement pinned next to Neon; isolate + `Server-Timing` headers.
8. Overflow fixes above.
9. Measure before/after on the deployed site.
