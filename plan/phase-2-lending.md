# Sajilo - Phase 2: Lending (borrower portfolio)

During the month he holds collected cash until the bank deadline. Sometimes he lends part of it and earns interest. Today this lives in long handwritten notes and is hard to search or calculate. Phase 2 tracks every loan and does the maths.

## Decisions (agreed 14 Oct 2026)

| Topic | Decision |
|---|---|
| Portfolio | Borrowers are a **separate portfolio** from collection customers. Even if the same person is in both, the records never mix |
| Rate | "Rs X per 100 per month" (सयकडा मासिक). Default in Settings, override per loan |
| Month length | Real BS month lengths (29-32 days) |
| Partial month | Full BS months counted from the lend date (Baisakh 10 -> Jestha 10 = 1 month). Leftover days = monthly interest x days / days in that BS month |
| Compounding | Monthly compounding of unpaid interest, as a Settings toggle (on/off). Option to charge interest on monthly balance or on total |
| Features | Partial repayments, due date + overdue alerts, cash-on-hand view, per-loan rate override |
| Calculator | Built-in "कति लिनु पर्छ?" calculator: pick a loan and a return date, get the exact amount with a breakdown. AI chat later |
| Old records | Scan old loan notes with the same photo -> Sarvam -> AI -> review flow |

## Data model

- `borrower` - id, collectorId, name, phone, note
- `loan` - id, borrowerId, principal, ratePer100PerMonth, startBsDate, dueBsDate, compounding (inherits setting, can override), status (`active` | `closed`)
- `loanRepayment` - loanId, bsDate, amount, appliedToInterest, appliedToPrincipal, note
- `collectorSettings` additions - defaultRatePer100, compoundingEnabled, interestBasis

## Interest engine (pure function in a shared package, fully unit tested)

`calculateLoan(loan, repayments, asOfBsDate, settings) -> { principalLeft, interestDue, total, breakdown[] }`

- Walk month anniversaries from the start date using real BS month lengths
- At each anniversary: add one month's interest; if compounding is on and interest is unpaid, roll it into the principal
- Leftover days after the last anniversary: pro-rated by the length of the BS month they fall in
- Repayments clear interest first, then principal
- The breakdown is shown to him in plain words: "Baisakh 10 - Jestha 10: Rs 200 ब्याज"
- Test cases come from real examples his father has done by hand

## Screens

1. **ऋण (Loans)** - active loans: borrower, amount, days running, amount owed today. Overdue in red, due-this-week in amber.
2. **New loan** - borrower (pick or add), amount, rate (prefilled), start date (today), due date.
3. **Loan detail** - running total, monthly breakdown, repayment history, "Add repayment", "Close loan".
4. **Calculator** - loan + return date -> amount to collect, with the breakdown.
5. **हातमा पैसा (Cash on hand)** - this month: collected - lent out + returned = should have; plus amount due to the bank and days left until the deadline.

## Task list

- [x] Schema + server actions for borrowers, loans, repayments
- [x] Interest engine + unit tests (BS month lengths, partial months, compounding on/off, partial repayments)
- [x] Settings: default rate, compounding toggle, interest basis
- [x] Loans list, new loan, loan detail, repayment sheet
- [x] Calculator screen
- [x] Cash-on-hand view linked to Phase 1 monthly totals
- [x] Overdue / due-soon highlighting on the home screen
- [x] Scan import for old loan notes (scan kind `loans`)
- [ ] Offline: read-only cache of loans; new loans/repayments queue like ticks
- [ ] Later: AI assistant ("Ram ले कति तिर्नु पर्छ?") on top of the same engine

## Open questions

- "Interest on monthly or total money": confirm with a real example from your father so the setting matches how he calculates.
- Bank deadline comes from the Phase 1 Settings value.
