# AGENTS.md: how Sajilo stays fast

Rules for anyone (person or agent) changing `apps/main`. They come from the fast sign-in and navigation playbooks (`ayudocs/docs/handoffs/fast-sign-in.md`, `navigation-speed.md`), adapted to Sajilo on 2026-10-16. The map, the decisions and what is left open are in `plan/speed-record.md`. Break a rule only with a measurement, and write down why.

## Measure, don't guess

- `pnpm bench:nav --url=<deployed site> --allow-production` (from the repo root) times every bottom-bar page and every page behind More, cold and after a hover. Add `--throttle=3g` for a slow phone and `--probe=30 --probe-path=/,/munshi` for cold starts. It signs in with `BENCH_PHONE` / `BENCH_PIN` from your shell: a TEST account (98000000xx), never his. Reports go to `plan/benchmarks/`. First time: `pnpm bench:install` (Playwright's Chromium).
- `pnpm bundle:size` (repo root, or in `apps/main`) builds and runs `wrangler deploy --dry-run` to print the Worker's size. Nothing is uploaded. `pnpm --filter main bundle:size:fast` skips the build.
- Every response carries `x-isolate-requests` (1 = a cold Worker) and `x-isolate-age-ms` (`middleware.ts`). Auth routes carry `Server-Timing: db;dur=..;desc="N queries", app;dur=..` (`app/api/auth/[...all]/route.ts`, timed in `packages/db/src/request-timing.ts`). The browser's wait minus `app` is the cold start.
- Never judge speed on `next dev`: it turns prefetching off and compiles on first use.

## Sign-in and sign-out

- The login page (`/`) and sign-up are static: the root layout reads no cookies or headers. The language is read in the browser there (`I18nProvider` without `initialLang` waits for `ready`), and on the server in `app/(app)/layout.tsx`.
- Sign-in posts straight to better-auth (`signIn.phoneNumber`), no `callbackURL`. The moment it answers, `LandingShell` draws the real bottom bar and the destination's own skeleton, then `router.push`. Never `window.location` and never `router.refresh()` after it.
- The destination comes from `lib/sign-in-destination.ts` (tested): `?returnTo=` (set by the middleware) if it is a safe same-site app path, else `/munshi`.
- Nothing is saved from the login page itself: an action POSTed to `/` with the new cookie is redirected by the middleware. The language goes through `LangSync` on the first signed-in page.
- Sign-up signs in inside `signUpCollector` (`auth.api.signUpEmail` + `nextCookies()`): one request, no second sign-in from the browser.
- Sign-out: `lib/sign-out.ts`. `POST /api/sign-out` is answered by `worker.ts` BEFORE the Next bundle loads (`lib/sign-out-edge.ts`: cookies expired at once, better-auth's sign-out in `waitUntil`); `app/api/sign-out/route.ts` does the same in `next dev`. The login page is prefetched on the More page and on pointer-down. After: offline copy wiped, `router.push("/")` then `router.refresh()`. A bare `/`, never a return address.

## Session and middleware

- The session lives in a signed cookie for 5 minutes (`packages/auth/src/session-config.ts`, the ONE place for those values). `nextCookies()` is the LAST better-auth plugin; without it the cookie cache is never refreshed and every request falls back to the database.
- `lib/session.ts` `getSession` is memoised per request (`cache`). Read it through `requireCollectorId` / `actionCollectorId`.
- `middleware.ts` checks cookie presence only, never the database. It redirects a signed-in person away from `/` only on a DOCUMENT load (`Sec-Fetch-Dest: document`): the sign-out button's background prefetch of `/` must get the page. Signed-out page visits go to `/?returnTo=<path>`. It never sets a cookie.

## Pages

- Every route under `app/(app)` has a `loading.tsx` that renders its skeleton from `components/skeletons/page-skeletons.tsx`: the page's REAL header (`PageTop` with the real title, back link and sync pill) and grey blocks shaped like the content. A new page gets a skeleton there and a `loading.tsx` the same day. A title that is data (a name) stays grey.
- Pages await only what their first screen needs; independent reads go in one `Promise.all`. A block that can wait (the deposit banner) streams in its own `<Suspense>` (`DeadlineSlot`).
- Shared lookups are `cache()`d per request in `server-only` modules (`getSettings`, `receivedBetween`), never in a `"use server"` file (its exports are public endpoints).
- Never write in a render path: a prefetch runs it with nobody looking.

## Links and prefetching

- `import Link from "@/components/app-link"`. `next/link` is banned elsewhere by eslint. It prefetches the page's SHELL on intent (100 ms of pointer movement, or touch, or focus), not every link on screen.
- Always pass a kind to `router.prefetch` (`PrefetchKind` from `lib/prefetch-kind.ts`). FULL only for the home.
- The bottom bar warms its pages one at a time, 350 ms apart, from idle (`use-staggered-prefetch.ts`): Today in FULL, everything else as a shell. Never fire many prefetches at once: on Workers they land on cold isolates.
- `staleTimes: { dynamic: 30, static: 180 }` (`next.config.js`). A write that changes a page refreshes it.
- The offline warm-up (`OfflineBar` -> `public/sw.js` `warm`) waits for the page to load and the phone to be idle, then fetches one page every 350 ms. Bump `VERSION` in `sw.js` when its caching changes.

## Workers

- Placement is pinned next to Neon: `"placement": { "region": "aws:ap-southeast-1" }` (`wrangler.jsonc`). Repeat it in any `env.*` block.
- `wrangler.jsonc` `main` is `worker.ts`, which wraps `.open-next/worker.js`. Paths that need no Next.js (sign-out) are answered there.
- Password hashing is native scrypt on Workers (better-auth's `workerd` export condition; OpenNext keeps it). If the built bundle ever contains `@noble/hashes` scrypt, the condition was lost: 1 s per sign-in.

## Scrolling and overflow

- Every scroll container is the shadcn `ScrollArea` (vertical lists, the horizontal print register). Never hand-roll `overflow-auto`.
- In a flex row, text that can grow gets `min-w-0` (and `truncate` where one line is right); amounts and buttons get `shrink-0`.
