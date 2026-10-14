import { pgTable, text, timestamp, integer, numeric, varchar, index, uniqueIndex } from 'drizzle-orm/pg-core'

// Shapes match gurukulhq so the copied @repo/ai (usage.ts, preferences.ts) works unchanged.
export const aiUsageLogs = pgTable(
    'ai_usage_logs',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),
        schoolId: text('schoolId'),
        referenceId: text('referenceId').notNull(),
        referenceType: text('referenceType').notNull(),
        inputTokens: integer('inputTokens').notNull().default(0),
        outputTokens: integer('outputTokens').notNull().default(0),
        cachedInputTokens: integer('cachedInputTokens').notNull().default(0),
        feature: text('feature'),
        costUsd: numeric('costUsd', { precision: 14, scale: 6, mode: 'number' }),
        costNpr: numeric('costNpr', { precision: 12, scale: 4, mode: 'number' }),
        credits: numeric('credits', { precision: 14, scale: 4, mode: 'number' }),
        chargedTo: text('chargedTo'),
        status: text('status'),
        reservationId: text('reservationId'),
        modelId: text('modelId').notNull(),
        userId: text('userId'),
        userType: text('userType'),
        createdAt: timestamp('createdAt', { precision: 3 }).defaultNow().notNull(),
    },
    (t) => [index('ai_usage_logs_referenceType_idx').on(t.referenceType), index('ai_usage_logs_createdAt_idx').on(t.createdAt)],
)

export const aiChatPreferences = pgTable(
    'ai_chat_preferences',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),
        userId: text('user_id').notNull(),
        chatLanguage: varchar('chat_language', { length: 16 }).default('EN').notNull(),
        createdAt: timestamp('created_at').defaultNow().notNull(),
        updatedAt: timestamp('updated_at')
            .defaultNow()
            .$onUpdate(() => new Date())
            .notNull(),
    },
    (t) => [uniqueIndex('ai_chat_preferences_user_unique_idx').on(t.userId)],
)
