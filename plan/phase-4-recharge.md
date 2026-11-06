# Phase 4: Recharge (NTC and Ncell)

He also sells mobile recharge: mostly e-load from a retailer SIM, sometimes scratch cards. He buys stock in bulk below face value (Rs 20,000 for about Rs 19,300) and sells at face value. Recharge is a SEPARATE business: it never touches collection, Cash in hand or the bank deposit.

Decided with Niraj (2026-11-06):

- Providers: NTC and Ncell only, for now.
- Four separate stocks: NTC e-load, NTC card, Ncell e-load, Ncell card.
- A sale is ONE TAP on an amount chip. E-load chips: 50, 100, 150, 200, 300, 500, 1000, 2000 and Other (keypad, any amount). Card chips: 50, 100, 200, 500, 1000 and Other. Typing only where it cannot be avoided (Other, a new person's phone, what he paid for stock).
- Udharo (credit): to an existing collection customer (searched, same profile) or a new person. A new person needs a phone (required) and a name (asked, not marked optional). Paid back -> struck off.
- The day closes itself every night (cron). Counting is optional; a count that differs shows the gap.
- Munshi knows all of it (reads, sell, buy, paid back).

## Model

One event table and two small ones (`packages/db/src/schema/recharge.ts`):

| Table | What |
|---|---|
| `recharge_person` | Udharo profile: name, phone, optional `customer_id` (a collection customer). Customer-linked ids are `cust:<customerId>`, so the phone can make one offline without asking the server. |
| `recharge_entry` | Every event: `buy` (amount = face value, `paid`), `sell` (amount, `person_id` when on udharo), `count` (amount = stock counted), `payback` (person, amount). `at` = the phone's time, so offline events keep their order. |
| `recharge_day` | The nightly close: each stock's closing balance and cost, and the day's summary. A checkpoint so pages never replay all history. Deleted from a date onward when an older entry changes. |

Sold, profit, stock and cash are never stored per entry; they come from `lib/recharge/ledger.ts` (pure, tested):

- Buy: stock += face, cost += paid.
- Sell: profit = amount x (1 - cost/stock) (average cost, so a dealer rate that changes month to month still gives the right profit). Stock and cost go down. Stock may go below zero: the page asks him to add the purchase.
- Count: gap = expected - counted; stock becomes the count (cost scales with it). The gap is shown, not booked as profit.
- Cash from recharge = sold - udharo + paid back.

## Screens

`/recharge` (More menu): provider and stock-type switch, the stock card (in hand, sold today, profit), the chips, Udharo / Bought / Count, today's sales with remove, who owes, the month's profit. Any day can be opened from the date (BS) to look back or add a missed sale.

## Nightly close

`wrangler.jsonc` cron `20 18 * * *` (00:05 Nepal time) -> `worker.ts` `scheduled` -> `POST /api/cron/recharge` with the auth secret -> writes `recharge_day` for every day since the last close, up to yesterday, for every collector with recharge entries. If the cron ever misses, pages still compute from the last checkpoint (or from the start), so nothing is wrong, only slower.

## Offline

Every recharge write is a queued op (`rechargeSale`, `rechargeBuy`, `rechargeCount`, `rechargePayback`, `rechargeRemove`, ids made on the phone). The page runs the same ledger over server entries plus unsent ops, so a tap shows at once, with or without signal.
