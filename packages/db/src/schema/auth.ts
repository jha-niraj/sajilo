import { pgTable, text, timestamp, boolean, json, index, pgEnum, integer, bigint } from 'drizzle-orm/pg-core'

export const roleEnum = pgEnum('role', ['USER', 'ADMIN'])

// ─── Better Auth required tables ──────────────────────────────────────────────

export const user = pgTable('user', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    emailVerified: boolean('email_verified').notNull().default(false),
    image: text('image'),
    // Collectors sign in with phone + PIN (Better Auth phoneNumber plugin). Their email is a
    // placeholder until real email/OTP is added, so never send mail to `@phone.sajilo.app`.
    phoneNumber: text('phone_number').unique(),
    phoneNumberVerified: boolean('phone_number_verified').notNull().default(false),
    role: roleEnum('role').notNull().default('USER'),
    address: text('address'),
    isActive: boolean('is_active').notNull().default(true),
    bio: text('bio'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const session = pgTable('session', {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expires_at').notNull(),
    token: text('token').notNull().unique(),
    createdAt: timestamp('created_at').notNull(),
    updatedAt: timestamp('updated_at').notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
        .notNull()
        .references(() => user.id, { onDelete: 'cascade' }),
})

export const account = pgTable('account', {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
        .notNull()
        .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at'),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at').notNull(),
    updatedAt: timestamp('updated_at').notNull(),
})

export const verification = pgTable('verification', {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at'),
    updatedAt: timestamp('updated_at'),
})

// ─── User notifications ───────────────────────────────────────────────────────

export const notificationTypeEnum = pgEnum('notification_type', ['info', 'success', 'warning', 'error'])

export const notification = pgTable(
    'notification',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),
        userId: text('user_id')
            .notNull()
            .references(() => user.id, { onDelete: 'cascade' }),
        title: text('title').notNull(),
        message: text('message').notNull(),
        type: notificationTypeEnum('type').notNull().default('info'),
        isRead: boolean('is_read').notNull().default(false),
        readAt: timestamp('read_at'),
        actionUrl: text('action_url'),
        actionLabel: text('action_label'),
        metadata: json('metadata'),
        createdAt: timestamp('created_at').notNull().defaultNow(),
    },
    (table) => [
        index('notification_user_id_idx').on(table.userId),
        index('notification_is_read_idx').on(table.isRead),
        index('notification_created_at_idx').on(table.createdAt),
    ],
)

export const rateLimit = pgTable('rate_limit', {
    id: text('id').primaryKey(),
    key: text('key').notNull().unique(),
    count: integer('count').notNull(),
    lastRequest: bigint('last_request', { mode: 'number' }).notNull(),
})
