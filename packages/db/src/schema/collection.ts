import { sql } from 'drizzle-orm'
import { pgTable, text, timestamp, boolean, integer, date, index, uniqueIndex, pgEnum } from 'drizzle-orm/pg-core'
import { user } from './auth'

// Dates are Nepal-local AD calendar days ('YYYY-MM-DD'). Bikram Sambat is derived in the app
// via @repo/calendar so BS month boundaries never have to be stored or migrated.

export const customer = pgTable(
    'customer',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),
        collectorId: text('collector_id')
            .notNull()
            .references(() => user.id, { onDelete: 'cascade' }),
        name: text('name').notNull(),
        phone: text('phone'),
        bankAccountNo: text('bank_account_no'),
        defaultAmount: integer('default_amount').notNull(),
        routeOrder: integer('route_order').notNull(),
        startDate: date('start_date', { mode: 'string' }).notNull(),
        isActive: boolean('is_active').notNull().default(true),
        note: text('note'),
        // Other ways he says this name, learned when he corrects Munshi ("Rajesh dukan" for Rajesh Kirana).
        aliases: text('aliases').array().notNull().default(sql`'{}'::text[]`),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at')
            .notNull()
            .defaultNow()
            .$onUpdate(() => new Date()),
    },
    (t) => [index('customer_collector_route_idx').on(t.collectorId, t.routeOrder)],
)

export const collectionDay = pgTable(
    'collection_day',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),
        collectorId: text('collector_id')
            .notNull()
            .references(() => user.id, { onDelete: 'cascade' }),
        date: date('date', { mode: 'string' }).notNull(),
        countedCash: integer('counted_cash'),
        lockedAt: timestamp('locked_at'),
        note: text('note'),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at')
            .notNull()
            .defaultNow()
            .$onUpdate(() => new Date()),
    },
    (t) => [uniqueIndex('collection_day_collector_date_uq').on(t.collectorId, t.date)],
)

// pending   - not marked yet (a past pending day is a missed day and counts as due)
// paid      - money received (amountReceived may be less or more than expected)
// shop_closed / no_money - labelled miss; still due
// holiday   - not a collection day for this customer; never due
export const entryStatusEnum = pgEnum('entry_status', ['pending', 'paid', 'shop_closed', 'no_money', 'holiday'])

export const collectionEntry = pgTable(
    'collection_entry',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),
        collectorId: text('collector_id')
            .notNull()
            .references(() => user.id, { onDelete: 'cascade' }),
        customerId: text('customer_id')
            .notNull()
            .references(() => customer.id, { onDelete: 'cascade' }),
        date: date('date', { mode: 'string' }).notNull(),
        expectedAmount: integer('expected_amount').notNull(),
        status: entryStatusEnum('status').notNull().default('pending'),
        // Cash actually handed over on this date. Anything above expectedAmount settles the
        // customer's oldest unpaid days (computed, see @/lib/collection/ledger in apps/main).
        amountReceived: integer('amount_received').notNull().default(0),
        // Phone-side timestamp of the mark; offline ops apply last-write-wins on this.
        markedAt: timestamp('marked_at'),
        clientOpId: text('client_op_id'),
        note: text('note'),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at')
            .notNull()
            .defaultNow()
            .$onUpdate(() => new Date()),
    },
    (t) => [
        uniqueIndex('collection_entry_customer_date_uq').on(t.customerId, t.date),
        index('collection_entry_collector_date_idx').on(t.collectorId, t.date),
    ],
)
