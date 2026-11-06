import { pgTable, text, timestamp, date, numeric, index, uniqueIndex, pgEnum, json, primaryKey } from 'drizzle-orm/pg-core'
import { user } from './auth'
import { customer } from './collection'

// Recharge (NTC / Ncell e-load and scratch cards) is its own business: nothing here touches
// collection, Cash in hand or the bank deposit. See plan/phase-4-recharge.md.

export const rechargeProviderEnum = pgEnum('recharge_provider', ['ntc', 'ncell'])
export const rechargeStockEnum = pgEnum('recharge_stock', ['eload', 'card'])
export const rechargeEntryKindEnum = pgEnum('recharge_entry_kind', ['buy', 'sell', 'count', 'payback'])

/** Someone who takes recharge on udharo. A collection customer's profile has id `cust:<customerId>`. */
export const rechargePerson = pgTable(
    'recharge_person',
    {
        id: text('id').primaryKey(),
        collectorId: text('collector_id')
            .notNull()
            .references(() => user.id, { onDelete: 'cascade' }),
        customerId: text('customer_id').references(() => customer.id, { onDelete: 'set null' }),
        name: text('name'),
        phone: text('phone'),
        createdAt: timestamp('created_at').notNull().defaultNow(),
    },
    (t) => [
        index('recharge_person_collector_idx').on(t.collectorId),
        uniqueIndex('recharge_person_collector_phone_uq').on(t.collectorId, t.phone),
    ],
)

/**
 * Every recharge event. `amount` is the face value bought, the amount sold, the stock counted or the
 * amount paid back, by `kind`. `at` is when it happened on the phone, so offline events keep their order.
 */
export const rechargeEntry = pgTable(
    'recharge_entry',
    {
        id: text('id').primaryKey(),
        collectorId: text('collector_id')
            .notNull()
            .references(() => user.id, { onDelete: 'cascade' }),
        kind: rechargeEntryKindEnum('kind').notNull(),
        provider: rechargeProviderEnum('provider'),
        stock: rechargeStockEnum('stock'),
        date: date('date', { mode: 'string' }).notNull(),
        at: timestamp('at').notNull(),
        amount: numeric('amount', { precision: 14, scale: 2, mode: 'number' }).notNull(),
        paid: numeric('paid', { precision: 14, scale: 2, mode: 'number' }),
        personId: text('person_id').references(() => rechargePerson.id, { onDelete: 'set null' }),
        createdAt: timestamp('created_at').notNull().defaultNow(),
    },
    (t) => [index('recharge_entry_collector_date_idx').on(t.collectorId, t.date), index('recharge_entry_person_idx').on(t.personId)],
)

/** The nightly close: each stock's balance and cost at the end of `date`, plus that day's summary. */
export const rechargeDay = pgTable(
    'recharge_day',
    {
        collectorId: text('collector_id')
            .notNull()
            .references(() => user.id, { onDelete: 'cascade' }),
        date: date('date', { mode: 'string' }).notNull(),
        state: json('state').notNull(),
        summary: json('summary').notNull(),
        closedAt: timestamp('closed_at').notNull().defaultNow(),
    },
    (t) => [primaryKey({ columns: [t.collectorId, t.date] })],
)
