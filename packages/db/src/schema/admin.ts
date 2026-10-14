import { pgTable, text, timestamp, boolean, integer, json, index, pgEnum } from 'drizzle-orm/pg-core'
import { user } from './auth'

export const adminRoleEnum = pgEnum('admin_role', ['SUPER_ADMIN', 'TEAM_MEMBER'])
export const adminStatusEnum = pgEnum('admin_status', ['ACTIVE', 'INACTIVE', 'SUSPENDED'])
export const adminInviteStatusEnum = pgEnum('admin_invite_status', ['PENDING', 'USED', 'EXPIRED', 'REVOKED'])

export const adminAccess = pgTable(
    'admin_access',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),
        userId: text('user_id')
            .notNull()
            .unique()
            .references(() => user.id, { onDelete: 'cascade' }),
        adminRole: adminRoleEnum('admin_role').notNull().default('TEAM_MEMBER'),
        status: adminStatusEnum('status').notNull().default('ACTIVE'),
        permissions: json('permissions').$type<Record<string, string[]>>().default({}).notNull(),
        lastLoginAt: timestamp('last_login_at'),
        loginCount: integer('login_count').notNull().default(0),
        invitedBy: text('invited_by'),
        inviteCode: text('invite_code'),
        hashedPassword: text('hashed_password'),
        accessCode: text('access_code'),
        accessCodeExpiry: timestamp('access_code_expiry'),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at').notNull().defaultNow(),
    },
    (table) => [
        index('admin_access_role_idx').on(table.adminRole),
        index('admin_access_status_idx').on(table.status),
        index('admin_access_user_id_idx').on(table.userId),
    ],
)

export const adminInvitation = pgTable(
    'admin_invitation',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),
        code: text('code')
            .notNull()
            .unique()
            .$defaultFn(() => crypto.randomUUID()),
        email: text('email').notNull(),
        name: text('name'),
        adminRole: adminRoleEnum('admin_role').notNull(),
        permissions: json('permissions').$type<Record<string, string[]>>().default({}).notNull(),
        status: adminInviteStatusEnum('status').notNull().default('PENDING'),
        usedBy: text('used_by'),
        usedAt: timestamp('used_at'),
        expiresAt: timestamp('expires_at').notNull(),
        createdById: text('created_by_id')
            .notNull()
            .references(() => adminAccess.id, { onDelete: 'cascade' }),
        createdAt: timestamp('created_at').notNull().defaultNow(),
    },
    (table) => [
        index('admin_invitation_code_idx').on(table.code),
        index('admin_invitation_email_idx').on(table.email),
        index('admin_invitation_status_idx').on(table.status),
        index('admin_invitation_expires_at_idx').on(table.expiresAt),
        index('admin_invitation_created_by_id_idx').on(table.createdById),
    ],
)

export const adminAuditLog = pgTable(
    'admin_audit_log',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),
        adminId: text('admin_id')
            .notNull()
            .references(() => adminAccess.id, { onDelete: 'cascade' }),
        action: text('action').notNull(),
        module: text('module').notNull(),
        resourceType: text('resource_type'),
        resourceId: text('resource_id'),
        description: text('description'),
        changes: json('changes'),
        metadata: json('metadata'),
        ipAddress: text('ip_address'),
        userAgent: text('user_agent'),
        createdAt: timestamp('created_at').notNull().defaultNow(),
    },
    (table) => [
        index('admin_audit_log_admin_id_idx').on(table.adminId),
        index('admin_audit_log_module_idx').on(table.module),
        index('admin_audit_log_action_idx').on(table.action),
        index('admin_audit_log_created_at_idx').on(table.createdAt),
        index('admin_audit_log_resource_idx').on(table.resourceType, table.resourceId),
    ],
)

export const adminDashboardStats = pgTable(
    'admin_dashboard_stats',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),
        statType: text('stat_type').notNull().unique(),
        data: json('data').notNull(),
        lastUpdatedAt: timestamp('last_updated_at').notNull().defaultNow(),
    },
    (table) => [
        index('admin_dashboard_stats_stat_type_idx').on(table.statType),
        index('admin_dashboard_stats_last_updated_at_idx').on(table.lastUpdatedAt),
    ],
)

export const adminNotification = pgTable(
    'admin_notification',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),
        adminId: text('admin_id'),
        title: text('title').notNull(),
        message: text('message').notNull(),
        type: text('type').notNull().default('info'),
        actionUrl: text('action_url'),
        actionLabel: text('action_label'),
        isRead: boolean('is_read').notNull().default(false),
        readAt: timestamp('read_at'),
        metadata: json('metadata'),
        createdAt: timestamp('created_at').notNull().defaultNow(),
    },
    (table) => [
        index('admin_notification_admin_id_idx').on(table.adminId),
        index('admin_notification_is_read_idx').on(table.isRead),
        index('admin_notification_created_at_idx').on(table.createdAt),
    ],
)

export const adminSystemSettings = pgTable(
    'admin_system_settings',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),
        key: text('key').notNull().unique(),
        value: json('value').notNull(),
        description: text('description'),
        lastModifiedBy: text('last_modified_by'),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at').notNull().defaultNow(),
    },
    (table) => [index('admin_system_settings_key_idx').on(table.key)],
)

export const announcementStatusEnum = pgEnum('announcement_status', ['DRAFT', 'PUBLISHED', 'ARCHIVED'])

export const announcement = pgTable(
    'announcement',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),
        title: text('title').notNull(),
        content: text('content').notNull(),
        status: announcementStatusEnum('status').notNull().default('DRAFT'),
        priority: text('priority').notNull().default('normal'),
        authorId: text('author_id')
            .notNull()
            .references(() => adminAccess.id, { onDelete: 'cascade' }),
        publishedAt: timestamp('published_at'),
        expiresAt: timestamp('expires_at'),
        metadata: json('metadata'),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at').notNull().defaultNow(),
    },
    (table) => [
        index('announcement_status_idx').on(table.status),
        index('announcement_author_id_idx').on(table.authorId),
        index('announcement_created_at_idx').on(table.createdAt),
    ],
)

export const broadcastStatusEnum = pgEnum('broadcast_status', ['DRAFT', 'SENT', 'SCHEDULED', 'FAILED'])

export const broadcast = pgTable(
    'broadcast',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),
        subject: text('subject').notNull(),
        content: text('content').notNull(),
        status: broadcastStatusEnum('status').notNull().default('DRAFT'),
        recipientType: text('recipient_type').notNull().default('all'),
        recipientCount: integer('recipient_count').notNull().default(0),
        sentCount: integer('sent_count').notNull().default(0),
        authorId: text('author_id')
            .notNull()
            .references(() => adminAccess.id, { onDelete: 'cascade' }),
        scheduledAt: timestamp('scheduled_at'),
        sentAt: timestamp('sent_at'),
        metadata: json('metadata'),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at').notNull().defaultNow(),
    },
    (table) => [
        index('broadcast_status_idx').on(table.status),
        index('broadcast_author_id_idx').on(table.authorId),
        index('broadcast_created_at_idx').on(table.createdAt),
    ],
)
