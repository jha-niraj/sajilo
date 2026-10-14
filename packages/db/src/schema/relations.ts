import { relations } from 'drizzle-orm'
import { user, notification } from './auth'
import { adminAccess, adminInvitation, adminAuditLog, announcement, broadcast } from './admin'
import { customer, collectionDay, collectionEntry } from './collection'
import { collectorSettings, holiday } from './settings'
import { borrower, loan, loanRepayment } from './lending'
import { scanJob } from './scan'

export const userRelations = relations(user, ({ one, many }) => ({
    adminAccess: one(adminAccess, {
        fields: [user.id],
        references: [adminAccess.userId],
    }),
    notifications: many(notification),
    settings: one(collectorSettings, {
        fields: [user.id],
        references: [collectorSettings.userId],
    }),
    customers: many(customer),
    collectionDays: many(collectionDay),
    holidays: many(holiday),
    borrowers: many(borrower),
    loans: many(loan),
    scanJobs: many(scanJob),
}))
export const adminAccessRelations = relations(adminAccess, ({ one, many }) => ({
    user: one(user, {
        fields: [adminAccess.userId],
        references: [user.id],
    }),
    invitations: many(adminInvitation),
    auditLogs: many(adminAuditLog),
    announcements: many(announcement),
    broadcasts: many(broadcast),
}))

export const adminInvitationRelations = relations(adminInvitation, ({ one }) => ({
    createdBy: one(adminAccess, {
        fields: [adminInvitation.createdById],
        references: [adminAccess.id],
    }),
}))

export const adminAuditLogRelations = relations(adminAuditLog, ({ one }) => ({
    admin: one(adminAccess, {
        fields: [adminAuditLog.adminId],
        references: [adminAccess.id],
    }),
}))

export const announcementRelations = relations(announcement, ({ one }) => ({
    author: one(adminAccess, {
        fields: [announcement.authorId],
        references: [adminAccess.id],
    }),
}))

export const broadcastRelations = relations(broadcast, ({ one }) => ({
    author: one(adminAccess, {
        fields: [broadcast.authorId],
        references: [adminAccess.id],
    }),
}))

export const notificationRelations = relations(notification, ({ one }) => ({
    user: one(user, {
        fields: [notification.userId],
        references: [user.id],
    }),
}))

export const customerRelations = relations(customer, ({ one, many }) => ({
    collector: one(user, { fields: [customer.collectorId], references: [user.id] }),
    entries: many(collectionEntry),
}))

export const collectionDayRelations = relations(collectionDay, ({ one }) => ({
    collector: one(user, { fields: [collectionDay.collectorId], references: [user.id] }),
}))

export const collectionEntryRelations = relations(collectionEntry, ({ one }) => ({
    customer: one(customer, { fields: [collectionEntry.customerId], references: [customer.id] }),
}))

export const collectorSettingsRelations = relations(collectorSettings, ({ one }) => ({
    user: one(user, { fields: [collectorSettings.userId], references: [user.id] }),
}))

export const holidayRelations = relations(holiday, ({ one }) => ({
    collector: one(user, { fields: [holiday.collectorId], references: [user.id] }),
}))

export const borrowerRelations = relations(borrower, ({ one, many }) => ({
    collector: one(user, { fields: [borrower.collectorId], references: [user.id] }),
    loans: many(loan),
}))

export const loanRelations = relations(loan, ({ one, many }) => ({
    borrower: one(borrower, { fields: [loan.borrowerId], references: [borrower.id] }),
    repayments: many(loanRepayment),
}))

export const loanRepaymentRelations = relations(loanRepayment, ({ one }) => ({
    loan: one(loan, { fields: [loanRepayment.loanId], references: [loan.id] }),
}))

export const scanJobRelations = relations(scanJob, ({ one }) => ({
    collector: one(user, { fields: [scanJob.collectorId], references: [user.id] }),
}))
