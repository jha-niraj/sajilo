import { pgTable, text, timestamp, json, index, pgEnum } from 'drizzle-orm/pg-core'
import { user } from './auth'

export const scanKindEnum = pgEnum('scan_kind', ['customers', 'collections', 'loans'])
export const scanStatusEnum = pgEnum('scan_status', ['reading', 'structuring', 'review', 'applied', 'failed'])

// One photo of a notebook page. Raw OCR text and the AI's rows are both kept, so a page can be
// re-structured later without re-reading the photo.
export const scanJob = pgTable(
    'scan_job',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),
        collectorId: text('collector_id')
            .notNull()
            .references(() => user.id, { onDelete: 'cascade' }),
        kind: scanKindEnum('kind').notNull(),
        status: scanStatusEnum('status').notNull().default('reading'),
        r2Key: text('r2_key'),
        imageMime: text('image_mime'),
        sarvamJobId: text('sarvam_job_id'),
        rawText: text('raw_text'),
        result: json('result'),
        error: text('error'),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        appliedAt: timestamp('applied_at'),
    },
    (t) => [index('scan_job_collector_idx').on(t.collectorId, t.createdAt)],
)
