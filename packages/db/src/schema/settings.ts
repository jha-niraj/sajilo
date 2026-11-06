import { pgTable, text, timestamp, boolean, integer, date, numeric, json, uniqueIndex } from 'drizzle-orm/pg-core'
import { user } from './auth'

export const collectorSettings = pgTable('collector_settings', {
    userId: text('user_id')
        .primaryKey()
        .references(() => user.id, { onDelete: 'cascade' }),
    language: text('language').$type<'ne' | 'en' | 'mai'>().notNull().default('en'),
    // 0 = Sunday ... 6 = Saturday. Default: every day.
    workingDays: json('working_days').$type<number[]>().notNull().default([0, 1, 2, 3, 4, 5, 6]),
    // BS day of month the bank expects the money by. null = last day of the BS month.
    bankDeadlineDay: integer('bank_deadline_day'),
    reminderDaysBefore: integer('reminder_days_before').notNull().default(3),
    defaultRatePer100: numeric('default_rate_per_100', { precision: 8, scale: 2, mode: 'number' })
        .notNull()
        .default(2),
    compoundingEnabled: boolean('compounding_enabled').notNull().default(false),
    // 'balance' = interest on what is still owed (after repayments); 'principal' = on the original amount
    interestBasis: text('interest_basis').$type<'balance' | 'principal'>().notNull().default('balance'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at')
        .notNull()
        .defaultNow()
        .$onUpdate(() => new Date()),
})

export const holiday = pgTable(
    'holiday',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),
        collectorId: text('collector_id')
            .notNull()
            .references(() => user.id, { onDelete: 'cascade' }),
        date: date('date', { mode: 'string' }).notNull(),
        label: text('label'),
        createdAt: timestamp('created_at').notNull().defaultNow(),
    },
    (t) => [uniqueIndex('holiday_collector_date_uq').on(t.collectorId, t.date)],
)
