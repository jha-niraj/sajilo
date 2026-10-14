/**
 * The single funnel every AI call in the monorepo logs through.
 *
 * Before this existed, only apps/main and apps/shishya-main wrote `ai_usage_logs`; admin,
 * worker and public-api wrote nothing - so Gemini invoice drafts, WhatsApp Claude
 * replies, worker embeddings and gpt-4o vision grading were all invisible to the
 * admin cost panel. Route every call through `logAiUsage` and coverage is complete.
 *
 * Stores raw token counts only. Cost is derived at read time via ./models so a
 * pricing correction re-prices history instead of baking a stale number into rows.
 */
import { db } from '@repo/db/client';
import { aiUsageLogs } from '@repo/db/schema';

export type AiReferenceType =
	| 'AI_CHAT'
	| 'QUESTION_GENERATOR'
	| 'DOCUMENT_CHAT'
	| 'STUDY_ASSISTANT'
	| 'LESSON_PLAN'
	| 'REPORT_COMMENTS'
	| 'HOMEWORK_FEEDBACK'
	| 'ANNOUNCEMENT_DRAFT'
	| 'ATTENDANCE_NARRATIVE'
	| 'FEE_PREDICTION'
	| 'FINANCIAL_REPORT'
	| 'EXAM_NARRATIVE'
	| 'WEEKLY_PARENT_SUMMARY'
	| 'CURRICULUM_AI'
	// Added with @repo/ai so the previously-unlogged surfaces have a home.
	| 'EMBEDDING'
	| 'VISION_GRADING'
	| 'ANSWER_SHEET'
	| 'WHATSAPP_REPLY'
	| 'INVOICE_DRAFT'
	| 'VIDYA_VIDEO';

export type AiUserType = 'STUDENT' | 'STAFF' | 'PARENT' | 'PLATFORM_ADMIN';

export interface LogAiUsageParams {
	/** Null for platform-level calls and independent learners with no school. */
	schoolId?: string | null;
	referenceId: string;
	referenceType: AiReferenceType | string;
	inputTokens: number;
	outputTokens: number;
	modelId: string;
	userId?: string | null;
	userType?: AiUserType | null;
}

/**
 * Never throws and never rejects - a logging failure must not break the AI call that
 * produced it. Callers may `void logAiUsage(...)` when they do not want to await.
 */
export async function logAiUsage(params: LogAiUsageParams): Promise<void> {
	try {
		await db.insert(aiUsageLogs).values({
			schoolId: params.schoolId ?? null,
			referenceId: params.referenceId,
			referenceType: params.referenceType,
			inputTokens: Math.max(0, Math.round(params.inputTokens || 0)),
			outputTokens: Math.max(0, Math.round(params.outputTokens || 0)),
			modelId: params.modelId,
			userId: params.userId ?? null,
			userType: params.userType ?? null,
		} as typeof aiUsageLogs.$inferInsert);
	} catch (err) {
		console.error('[ai/usage] failed to log AI usage', {
			referenceType: params.referenceType,
			modelId: params.modelId,
			err,
		});
	}
}
