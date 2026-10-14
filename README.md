# Sajilo (सजिलो)

An offline-first PWA for a bank **daily-savings collector** in Nepal, and for the small loans he gives from collected cash before the monthly bank deposit.

- **Phase 1 - Daily collection.** Customers in route order, one tap per shop, "forgot this one?" flags, missed days that become dues, catch-up payments that settle the oldest days first, a finish-day cash match, and monthly Bikram Sambat reports (print/PDF, share, CSV).
- **Phase 2 - Lending.** Loans at "Rs X per 100 per month" on real BS month lengths, optional monthly compounding, interest-first repayments, a "how much to take?" calculator, overdue alerts and cash in hand.
- **Photo import.** Snap a notebook page: Sarvam Doc AI reads it (Nepali, handwritten), GPT turns it into rows, he checks and saves.

English by default, Nepali at a tap.

## Monorepo

```
apps/
  main/    Sajilo PWA (port 3100)
  admin/   Admin dashboard (port 3001)
packages/
  auth/      @repo/auth      Better Auth (phone + PIN for collectors, email for admins)
  db/        @repo/db        Drizzle schema + Neon HTTP client
  calendar/  @repo/calendar  Bikram Sambat helpers (tested)
  ui/        @repo/ui        shadcn/ui component library
  ai/        @repo/ai        OpenAI client + usage logging
  sarvamai/  @repo/sarvamai  Sarvam Doc AI client
  storage/   @repo/storage   Cloudflare R2 helpers
  core, errors, pdf, guides  shared utilities
plan/
  phase-1-daily-collection.md, phase-2-lending.md    decisions + task lists
  database-hyperdrive-vs-neon.pdf                    why Neon HTTP (no Hyperdrive yet)
```

## Stack

Next.js 16.3 (App Router, React 19) · Drizzle ORM on Neon (HTTP driver) · Better Auth · Tailwind CSS v4 + shadcn/ui · Dexie (IndexedDB) for offline · Cloudflare Workers via OpenNext · Turborepo + pnpm · TypeScript 5.9 · Vitest

## Quick start

```bash
pnpm install

cp apps/main/.env.example apps/main/.env      # fill DATABASE_URL, BETTER_AUTH_SECRET, SARVAM_API_KEY
cp apps/admin/.env.example apps/admin/.env

pnpm --filter @repo/db db:push                # create tables
pnpm --filter @repo/db db:seed                # admin: superadmin@admin.com / Admin@1234

pnpm dev                                      # main :3100, admin :3001
```

Open http://localhost:3100, create an account with a phone number and a 4-digit PIN, then add customers (type, paste a list, or scan a photo).

## Tests

```bash
pnpm test        # BS calendar, collection ledger, interest engine, paste parser
```

## Deploy (Cloudflare Workers)

```bash
cd apps/main
# set your domain in wrangler.jsonc "vars"
npx wrangler secret put DATABASE_URL          # also BETTER_AUTH_SECRET, SARVAM_API_KEY, OPENAI_API_KEY, R2_*
pnpm deploy                                   # opennextjs-cloudflare build && deploy
```

Check a production build in the real Workers runtime first with `pnpm deploy:build && npx wrangler dev --local` (reads `apps/main/.dev.vars`).

## Notes

- `middleware.ts` keeps its name on purpose: OpenNext on Workers runs edge middleware, not Node "proxy".
- Next is pinned to 16.3.x until OpenNext supports 16.4.
- All money and calendar logic is pure and unit-tested in `apps/main/lib/money` and `packages/calendar`.
