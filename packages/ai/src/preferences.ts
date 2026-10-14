/**
 * Per-user chat preferences, shared by every app.
 *
 * Lives here rather than in each app so main, student, admin and the future Expo client
 * read and write the setting identically - a register picked on the web must be the one
 * the phone uses.
 */
import { db } from '@repo/db/client';
import { aiChatPreferences } from '@repo/db/schema';
import { eq } from 'drizzle-orm';
import { DEFAULT_CHAT_LANGUAGE, toChatLanguage, type ChatLanguage } from './language';

/**
 * The user's chat register, or the default when they have never chosen one.
 *
 * Never throws: a preferences lookup failing must not take the chat down with it. A read
 * error degrades to English, which is always a safe register to answer in.
 */
export async function getChatLanguage(userId: string): Promise<ChatLanguage> {
	try {
		const [row] = await db
			.select({ chatLanguage: aiChatPreferences.chatLanguage })
			.from(aiChatPreferences)
			.where(eq(aiChatPreferences.userId, userId))
			.limit(1);
		return toChatLanguage(row?.chatLanguage);
	} catch (err) {
		console.error('[ai/preferences] failed to read chat language, defaulting to EN', err);
		return DEFAULT_CHAT_LANGUAGE;
	}
}

/**
 * Upsert the user's register. Relies on the unique index on `user_id`
 * (ai_chat_preferences_user_unique_idx) rather than a transaction - the db client is
 * drizzle neon-http, where `db.transaction()` throws at runtime.
 *
 * Throws on failure so the caller's action boundary can surface it: unlike a read, a
 * silent no-op here would leave the user staring at a setting that did not stick.
 */
export async function setChatLanguage(userId: string, language: ChatLanguage): Promise<ChatLanguage> {
	const value = toChatLanguage(language);
	await db
		.insert(aiChatPreferences)
		.values({ userId, chatLanguage: value } as typeof aiChatPreferences.$inferInsert)
		.onConflictDoUpdate({
			target: aiChatPreferences.userId,
			set: { chatLanguage: value, updatedAt: new Date() },
		});
	return value;
}
