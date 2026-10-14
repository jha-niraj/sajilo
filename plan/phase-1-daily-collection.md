# Sajilo - Phase 1: Daily collection

A PWA for a bank savings collector (40-50 customers, same route every day). Open the app, tick each shop as money is received, come home, count cash, see it match. Monthly BS totals for the bank.

## Decisions (agreed 14 Oct 2026)

| Topic | Decision |
|---|---|
| App name | Sajilo (सजिलो) |
| Login | Phone number + 4-digit PIN. No OTP now; real OTP added later on the same phone field |
| Language | English by default, Nepali toggle (changed 14 Oct) |
| Calendar | Bikram Sambat everywhere. Day boundary = Nepal time (UTC+5:45) |
| Amounts | Each customer has a default daily amount. One tap = paid default. Tap amount to change |
| Missed days | Badges: "दोकान बन्द" (shop closed), "पैसा छैन" (no money today). Missed days become dues |
| Catch-up payments | Extra money fills the oldest missed days first, automatically, with a reason and a distinct colour on those days |
| Past days | Not edited by hand. Only filled through catch-up allocation |
| Order flag | If a later customer is ticked and an earlier one is not, the earlier one is highlighted "बिर्सनुभयो?" |
| End of day | Finish-day screen: list of unticked, cash counted input, matched / short / over, then lock the day (unlock possible) |
| Working days | Every day by default. Configurable in Settings, plus one-off holidays |
| Offline | Must work offline. Ticks save on the phone instantly, sync when online |
| Customer management | Route inside `main` (`/manage`). Data scoped per collector so more collectors can be added later |
| Import | Photo (camera or gallery) -> Sarvam Doc AI (ne-IN) -> gpt-4o-mini -> review screen -> save. Photo + raw text kept |
| Bank report | On-screen monthly summary, printable PDF, share to WhatsApp/Viber, CSV export |
| Existing template | Replace main app's landing, email signup, Google and forgot-password UI. Admin app untouched |
| UI | Warm, clean, big tap targets, no technical screens or jargon. No native form controls: shadcn Select/Textarea, InputOTP for PINs, NepaliDatePicker |
| Framework | Next.js 16.3.8 (16.4.0 not yet supported by OpenNext on Workers). Keep `middleware.ts` (edge) |
| Hosting | Cloudflare Workers via OpenNext, `placement.mode = smart`. Neon Postgres in `ap-southeast-1` (Singapore; Mumbai wasn't offered) |
| DB connection | Neon HTTP (`drizzle-orm/neon-http`) with the Gurukul retry wrapper. No Hyperdrive until scale needs it (see `plan/database-hyperdrive-vs-neon.pdf`). Multi-row money writes use `db.batch([...])`, calculated first, then written in one batch |
| Schema layout | `packages/db/src/schema/` - `auth.ts` (Better Auth), `admin.ts` (all admin tables, kept), `collection.ts`, `lending.ts`, `scan.ts`, `settings.ts` |
| Admin app | Kept as is |
| UI package | `packages/ui` copied from Gurukul, kept whole; missing `@repo/guides` copied too |
| Bank report | Grand total, per-customer totals with bank account numbers, day-by-day totals |
| Bank deadline | BS day set in Settings. In-app banner from N days before (N in Settings) + app-icon badge (Badging API) |
| Env | Sarvam key from Gurukul; OpenAI, R2, Resend as placeholders for now |

## Data model (new tables in `packages/db/src/schema.ts`)

- `user` - add `phone` (unique), PIN stored as Better Auth credential password (hashed)
- `customer` - id, collectorId, name, phone, bankAccountNo, defaultAmount, routeOrder, startDate, isActive, note
- `collectionDay` - collectorId, bsDate, adDate, isHoliday, countedCash, expectedTotal, collectedTotal, lockedAt
- `collectionEntry` - customerId, date, expectedAmount, status (`pending` | `paid` | `shop_closed` | `no_money` | `holiday`), amountPaid, tickedAt, clientOpId (offline idempotency)
- Catch-up allocation is computed, not stored: `lib/money/ledger.ts` matches each customer's cash to their oldest unpaid days, so "paid late on <date>" can never drift from the money
- `collectorSettings` - language, workingDays, holidays, bankDeadlineDay, deadlineReminderDays (Phase 2 adds interest settings here)
- `scanJob` - kind (`customers` | `collections` | `loans`), r2Key, sarvamJobId, rawText, aiResult (json), status, appliedAt

Dues for a customer = expected on every working, non-holiday day since `startDate` minus all money received. All money in one transaction: today's entry + oldest-first allocations.

## Screens

1. **Login** - phone, then a big PIN keypad. Stays signed in on the phone.
2. **आजको संकलन (Today)** - customers in route order. Each row: name, today's amount, a large tick. Under the name, in a soft colour: "बाँकी Rs 700 (7 दिन)" when there are dues. Long-press / swipe for badges (shop closed, no money) or a different amount. A flagged row glows amber if a later row is ticked. Sticky bottom bar: "आज Rs 18,400 / Rs 20,000 · 46/50".
3. **Different amount sheet** - number pad. If more than today's amount: shows "Rs 100 आज + Rs 700 बाँकी (7 दिन)" before confirming.
4. **दिन बन्द (Finish day)** - unticked list, "गन्नुभएको पैसा" input, Matched / Rs X short / Rs X over, Lock button.
5. **महिना (Month)** - BS month dropdown, grand total, per-customer totals, days collected, dues. Buttons: Print/PDF, Share, CSV.
6. **Customer history** - a calendar strip of one customer's month: paid, late-paid (filled by catch-up, different colour, reason), closed, pending.
7. **व्यवस्थापन (Manage)** - customers list, add/edit, drag to reorder, deactivate. "फोटोबाट थप्नुहोस्" import.
8. **Scan review** - rows from the photo with unsure fields highlighted, edit inline, Save.
9. **Settings** - language, working days, holidays, change PIN.

## Task list

### 0. Foundation
- [x] Upgrade Next.js (and React, eslint-config-next) to latest across `apps/main` and `apps/admin`; keep `middleware.ts` name; fix breaking changes
- [x] Add OpenNext Cloudflare (`@opennextjs/cloudflare`), `wrangler.jsonc` (smart placement), `open-next.config.ts`
- [x] Switch `@repo/db` to Neon HTTP + retry wrapper; split schema into files (admin tables -> `admin.ts`)
- [x] Make copied `packages/ui`, `ai`, `pdf`, `core`, `calendar`, `errors`, `sarvamai` compile here (copy `@repo/guides`)
- [x] `.env` for main + admin: Sarvam key, BETTER_AUTH_URL etc., placeholders for OpenAI / R2 / Resend
- [x] Copy from gurukulhq: `@repo/calendar` (BS dates, Nepal time), `@repo/errors`, `@repo/ai`, `@repo/doc-ai`, PDF layout helpers from `@repo/pdf`
- [x] Verify BS month lengths for 2082-2084 in `nepali-date-converter` against the official Nepal calendar; add a test that fails if they drift
- [x] i18n: small dictionary (`ne`, `en`) + Nepali digit formatting + Rs formatting
- [x] PWA: real manifest (name Sajilo, icons, theme), hand-written service worker (`public/sw.js`), offline app shell, install prompt

### 1. Auth
- [x] Phone + PIN sign-in via Better Auth (check `phoneNumber` plugin password sign-in, else username/credential with phone as identifier); designed so OTP can be switched on later
- [x] Long-lived session on device; middleware protects everything except `/login`
- [x] Remove email/Google/forgot-password UI from `main`
- [x] Sign-up screen creates the collector account + settings (seed not needed)

### 2. Customers + import
- [x] Customer CRUD server actions + `/manage` screen with drag reorder
- [x] Photo capture (`<input type="file" accept="image/*" capture="environment">`) + gallery upload to R2
- [x] Sarvam digitise job (ne-IN) -> poll -> raw text stored
- [x] gpt-4o-mini structured output for 3 kinds: customers, past collections, (Phase 2) loans
- [x] Review screen with confidence highlighting, then apply

### 3. Daily collection
- [x] Day generation: today's entries created lazily for active customers on working days
- [x] Tick / badge / different amount actions with oldest-first allocation in one transaction
- [x] Offline store (IndexedDB) of today's list + outbox of ops with `clientOpId`; background sync; gentle "saved on phone / synced" indicator
- [x] Out-of-order flag
- [x] Finish day: unticked list, cash match, lock/unlock

### 4. Reports
- [x] Month summary by BS month (grand total, per customer with account no., day-by-day, dues)
- [x] Bank deadline banner + app icon badge
- [x] Printable PDF for the bank
- [x] Web Share API (WhatsApp/Viber) with text summary + PDF file
- [x] CSV export
- [x] Past collection import (scan kind `collections`) to backfill the current month

### 5. Polish + ship
- [x] Warm visual design pass, big touch targets, Nepali typography check
- [ ] Test on a low-end Android phone, offline in airplane mode, install to home screen
- [ ] Deploy to Cloudflare; parallel run with the paper notebook for 1-2 weeks

## Open questions

- A photo of the bank's current monthly sheet, to match the PDF layout exactly.
