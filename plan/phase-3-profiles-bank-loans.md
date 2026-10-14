# Sajilo - Phase 3: profiles, bank loans, search

Notes from the first long talk with father (15 Oct 2026). This is a plan only. Nothing is built
until the next talk fills the open questions and we have his real customer data to test with.

## Decisions (agreed 15 Oct 2026)

- **One person, separate books.** Each person has one profile (details and documents). A
  collection account and any loans hang off that profile as separate ledgers that never mix. A
  collection customer who takes a loan reuses their existing profile; nothing is typed twice.
- **Account numbers count up.** A new customer gets the last account number + 1 (141618, 141619,
  ...), filled in automatically and still editable. A reconcile screen catches gaps and duplicates.
- **Two kinds of loan.**
  - **Bank loan (CC loan):** the bank pays the money out; father arranges it and collects the
    repayments, then deposits them, like savings. The rate follows a rule set in Settings.
  - **Own loan:** father's own money. Keeps today's rule (Rs X per 100 per month, compounding
    switch). Shown and totalled apart from bank loans everywhere.
- **Bank loan rule (draft, to confirm):** the first 90 days at 18%. From day 91, 36% on the loan
  plus the interest still unpaid from the first 90 days. The unit (per year or per month) and exact
  wording come from the next talk.
- **Return by is optional** on a new loan.
- **Documents are photos only.** Take a picture or pick one, stored in R2, shown on the profile. No
  text reading for now.
- **Search wherever there is a list**, and on top of every long dropdown.

## 1. Today page

- Search box at the top of the list (sticky under the header). Typing filters the list in place
  by name, account number or phone. Tick, amount and catch-up still work on the filtered rows.
- Clear button, and the search empties itself after a tick so the next customer is one tap away
  (to confirm with father).
- Tapping the **name** opens the customer profile. Tapping the **rest of the card** opens the
  amount sheet as now. Tapping the circle still ticks.
- Works offline: it searches the saved day snapshot.

## 2. Customer profile

Today it shows only the name, the daily amount and a calendar. It becomes a full profile:

- **Header:** name, account number, phone, active/stopped.
- **Details:** account number, account opened date, collection start date, daily amount, address,
  citizenship number, father/spouse name, nominee, date of birth, note. *The final field list comes
  from father's sheet; these are placeholders.*
- **Documents:** photo grid (citizenship front/back, photo, others), add by camera or gallery, tap
  to view full size, delete with confirm.
- **Collection:** the existing collected/still due cards and month calendar.
- **Loans:** the person's bank and own loans with balance and status, and "New loan for this person".
- Edit opens a sheet with every field.

## 3. Account numbers

- `customer.accountNo` (text, unique per collector). The current `bankAccountNo` moves into it.
- New customer form: pre-filled with the highest existing number + 1; editable.
- Paste/bulk add numbers rows in order from that start.
- **Reconcile** (Manage > Account numbers): list sorted by number, flag gaps, duplicates and
  non-numbers; edit in place. Rarely needed, but ready for the real data import.
- Offline: suggest from the saved list; the server rejects a duplicate and the sync toast says so.

## 4. Loans

### New loan form
- **Kind:** Bank loan / Own loan (big two-option switch at the top).
- **Borrower picker:** fixed-height list (about 5 rows) inside a ScrollArea with a search box on
  top. Lists every profile (collection customers too). "New person" stays at the top of the list.
- New person: name, phone, and document photos right in the form.
- Amount, start date, **return by (optional)**.
- Rate: filled from Settings for the chosen kind. Bank loans show the rule ("18% for 90 days, then
  36%"), not a single number. Own loans keep the Rs per 100 field.
- Preview: what is owed at 30/60/90/120 days, so he can tell the borrower.

### Loans list and detail
- Tabs or a filter: Bank / Own, with separate totals.
- Bank loan detail shows the stage ("day 47 of 90", "past 90 days - 36%"), and a warning from
  day 80 or so (threshold to confirm).
- Repayments: interest first, as now.

### Settings
- **Bank loan rules:** base days (90), base rate (18), later rate (36), unit (year/month), whether
  the later rate also charges on unpaid interest. Kept as a list so a second bank product can be
  added later.
- **Own loans:** today's default rate, compounding and basis settings.

### Interest engine
- New pure function for the tiered bank rule beside `lib/money/interest.ts`, fully unit tested:
  day 90 vs 91, repayments before and after 90 days, partial payments, BS month lengths if the rate
  is monthly.
- The calculator gets the same Bank/Own switch.

## 5. Documents in R2

- Bucket is **private**. Photos are read through short-lived signed links (`getDownloadUrl`), never
  a public URL, because they are ID papers.
- Keys: `docs/<collectorId>/<personId>/<docId>.jpg`. Resize/compress on the phone before upload
  (about 1600px, JPEG ~80%).
- Table `person_document`: id, collector_id, person_id, kind (citizenship_front, citizenship_back,
  photo, other), r2_key, created_at.
- Offline: the photo waits in Dexie and uploads when back online (new outbox op `uploadDocument`).

### Getting the R2 credentials
1. Cloudflare dashboard > **R2 Object Storage**. Turn on R2 if asked (free tier: 10 GB).
2. **Create bucket** - name it `sajilo-docs`, location Automatic. Leave public access **off**.
   This is `R2_BUCKET_NAME`.
3. The **Account ID** is on the R2 overview page (right side). This is `R2_ACCOUNT_ID`.
4. R2 overview > **Manage R2 API Tokens** > **Create API token**. Permission: *Object Read & Write*,
   apply to the `sajilo-docs` bucket only, no expiry (or a long one). Create.
5. Copy the **Access Key ID** and **Secret Access Key** straight away (the secret is shown once).
   These are `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY`.
6. `R2_PUBLIC_URL` stays empty (private bucket).
7. Put them in `apps/main/.env` and `.env.production`, and on the Worker:
   `npx wrangler secret put R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY`. `R2_ACCOUNT_ID` and
   `R2_BUCKET_NAME` are not secret and can go in `wrangler.jsonc` `vars`.
8. Bucket > Settings > **CORS**: allow `PUT` and `GET` from
   `https://sajilo.shunyatechofficial.workers.dev` and `http://localhost:3100`, so the phone can
   upload straight to R2 with a signed link.

## 6. Search everywhere

One shared search component (big, always visible, clear button, works in Nepali and English, and
matches names typed in either script where possible). Used on: Today, Manage, Loans, the borrower
picker, Month, scan review, and every Select with more than about 8 options.

## 7. Cash page

He finds it hard to follow. Redo after the talk. Likely direction: three plain blocks - collection
money waiting for the bank, bank-loan money collected and waiting for the bank, own money lent and
in hand - each with one number and one line of explanation.

## 8. Bank deposit PDF

He likes the PDF but the bank uses a different layout. Get a photo of the real deposit slip or
register page and match it. Later.

## Task list

- [ ] Schema: `person` (profile) with fields from father's sheet; move customer and borrower
      details onto it; `customer.personId`, `borrower`/`loan.personId`; migration for existing rows
- [ ] `customer.accountNo` (unique per collector), next-number suggestion, reconcile screen
- [ ] Today: sticky search, name opens profile, card opens sheet
- [ ] Customer profile: details, documents, collection, loans sections; full edit sheet
- [ ] Loan kind (bank / own) on `loan`; list filter and separate totals
- [ ] Bank loan rules in Settings; tiered interest engine + tests
- [ ] New loan form: kind switch, searchable borrower picker (fixed height, ScrollArea), optional
      return by, rule preview
- [ ] Calculator: Bank/Own switch
- [ ] R2 bucket and credentials (user), `person_document` table, signed upload/download, photo
      compression, offline upload queue
- [ ] Shared search component and roll-out to every list and long Select
- [ ] Cash page redesign (after the talk)
- [ ] Bank deposit PDF in the bank's layout (after we get a sample)
- [ ] Munshi tools: search person, profile details, bank vs own loans, bank-loan stage
- [ ] Offline: new ops for profile edits and documents; snapshot carries account numbers
- [ ] Import father's real customer list (account numbers, opened dates) and test end to end

## Questions for the next talk with father

1. **Bank loan rule:** is 18% / 36% per year or per month? Exactly what does 36% apply to after 90
   days? Is the 90 days counted from the payout date? Any fees or a penalty on top?
2. Does the bank loan have a fixed term, an instalment amount, or a daily collection like savings?
   How often does he deposit loan collections at the bank, and does it go on the same deposit slip?
3. Is there more than one bank loan product (different rates or periods)?
4. **Profile fields:** the full list he keeps for each customer (account opened date, address,
   citizenship no., nominee, ...). Which are required?
5. **Documents:** which papers does he collect for a loan, and for a savings account?
6. **Account numbers:** the real current last number, and whether numbers ever skip (closed
   accounts, another collector's range).
7. **Cash page:** what does he want to see when he checks his cash? Which numbers matter at day end?
8. **Deposit PDF:** a photo of the bank's own slip or register.
9. Own loans: same as now (Rs per 100 per month)? Does he ever charge compound interest?
10. Search on Today: should it clear after each tick?
