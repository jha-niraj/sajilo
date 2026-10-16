import { pgTable, text, timestamp, jsonb, integer, index } from 'drizzle-orm/pg-core'
import { user } from './auth'

// One Munshi chat. Messages (with their confirm cards) live in one jsonb array: a chat is read
// and written whole, and keeping it in one row means one round trip on the HTTP driver.
export const munshiConversation = pgTable(
    'munshi_conversation',
    {
        id: text('id').primaryKey(),
        collectorId: text('collector_id')
            .notNull()
            .references(() => user.id, { onDelete: 'cascade' }),
        title: text('title').notNull().default(''),
        messages: jsonb('messages').$type<unknown[]>().notNull().default([]),
        messageCount: integer('message_count').notNull().default(0),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at').notNull().defaultNow(),
    },
    (t) => [index('munshi_conversation_collector_idx').on(t.collectorId, t.updatedAt)],
)

// One row per confirm card that has been saved. Saying "yes" and tapping Confirm can both reach the
// same card (and a slow phone can tap twice), so a commit first claims the card's id here; a second
// claim finds the row and saves nothing.
export const munshiCommit = pgTable('munshi_commit', {
    proposalId: text('proposal_id').primaryKey(),
    collectorId: text('collector_id')
        .notNull()
        .references(() => user.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
})
