# Sajilo app (`apps/main`)

The collector's PWA. See the root `README.md` for setup and `CLAUDE.md` for architecture rules.

## Screens

| Route | What it does |
|---|---|
| `/login`, `/signup` | Phone number + 4-digit PIN |
| `/today` | Today's route list: tick, shop closed, no money, different amount (works offline) |
| `/today/finish` | Mark the rest, count cash, match, close the day |
| `/month` | BS month totals by customer and by day; print/PDF, share, CSV |
| `/print/month` | Print-ready bank report |
| `/customers/[id]` | One customer's month as a calendar: paid, paid late, missed |
| `/manage` | Add, edit, reorder (drag), stop customers; paste a list |
| `/scan` | Photo import for customer lists, old collection pages and old loan notes |
| `/loans`, `/loans/new`, `/loans/[id]` | Lending book, repayments, breakdown |
| `/loans/calculator`, `/cash` | "How much to take?" and cash in hand |
| `/settings` | Language, collection days, holidays, bank deposit day, lending defaults, PIN |

## Scripts

```bash
pnpm dev            # next dev on :3100
pnpm test           # vitest (lib/**/*.test.ts)
pnpm build          # next build
pnpm deploy:build   # OpenNext Cloudflare build
pnpm preview        # build + run in local workerd
pnpm deploy         # build + deploy to Cloudflare
```

## Key code

- `lib/money/ledger.ts` - dues, oldest-first catch-up, advance credit
- `lib/money/interest.ts` - Rs X per 100 per month on real BS months
- `lib/collection/` - day snapshots, sync of marks, holidays
- `lib/offline/` - IndexedDB store + outbox sync
- `public/sw.js` - service worker (app shell + pages)
