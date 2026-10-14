import { pgTable, text, timestamp, boolean, date, numeric, index, pgEnum } from 'drizzle-orm/pg-core'
import { user } from './auth'

// Borrowers are their own portfolio. A borrower who is also a collection customer is still a
// separate record here, so the two ledgers never mix.
export const borrower = pgTable(
    'borrower',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),
        collectorId: text('collector_id')
            .notNull()
            .references(() => user.id, { onDelete: 'cascade' }),
        name: text('name').notNull(),
        phone: text('phone'),
        address: text('address'),
        note: text('note'),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at')
            .notNull()
            .defaultNow()
            .$onUpdate(() => new Date()),
    },
    (t) => [index('borrower_collector_idx').on(t.collectorId)],
)

export const loanStatusEnum = pgEnum('loan_status', ['active', 'closed'])

export const loan = pgTable(
    'loan',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),
        collectorId: text('collector_id')
            .notNull()
            .references(() => user.id, { onDelete: 'cascade' }),
        borrowerId: text('borrower_id')
            .notNull()
            .references(() => borrower.id, { onDelete: 'cascade' }),
        principal: numeric('principal', { precision: 14, scale: 2, mode: 'number' }).notNull(),
        ratePer100: numeric('rate_per_100', { precision: 8, scale: 2, mode: 'number' }).notNull(),
        startDate: date('start_date', { mode: 'string' }).notNull(),
        dueDate: date('due_date', { mode: 'string' }),
        // null = follow collector settings
        compounding: boolean('compounding'),
        status: loanStatusEnum('status').notNull().default('active'),
        closedAt: date('closed_at', { mode: 'string' }),
        note: text('note'),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at')
            .notNull()
            .defaultNow()
            .$onUpdate(() => new Date()),
    },
    (t) => [index('loan_collector_status_idx').on(t.collectorId, t.status), index('loan_borrower_idx').on(t.borrowerId)],
)

// Split into interest/principal is computed by the interest engine (interest first), not stored,
// so a settings change re-prices history consistently.
export const loanRepayment = pgTable(
    'loan_repayment',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),
        collectorId: text('collector_id')
            .notNull()
            .references(() => user.id, { onDelete: 'cascade' }),
        loanId: text('loan_id')
            .notNull()
            .references(() => loan.id, { onDelete: 'cascade' }),
        date: date('date', { mode: 'string' }).notNull(),
        amount: numeric('amount', { precision: 14, scale: 2, mode: 'number' }).notNull(),
        note: text('note'),
        clientOpId: text('client_op_id'),
        createdAt: timestamp('created_at').notNull().defaultNow(),
    },
    (t) => [index('loan_repayment_loan_idx').on(t.loanId, t.date)],
)
