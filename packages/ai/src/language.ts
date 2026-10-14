/**
 * Chat output register.
 *
 * This is a CHAT-ONLY setting. It changes how the assistant writes back; it does not
 * localise the app UI, exports, PDFs or emails - those stay in their own formats.
 *
 * Three registers, because Nepali users read three:
 *   EN        - English. The default.
 *   NE_ROMAN  - Nepali written in Latin script ("Aaja maile khana khaye"). This is the
 *               WhatsApp/Viber register - for most users it IS their native digital
 *               language, not a compromise. Warmest of the three.
 *   NE        - Nepali in Devanagari. Formal/official feel; preferred by some older
 *               users and for anything that should read like a circular.
 *
 * INPUT is always multilingual regardless of this setting - see LANGUAGE_INPUT_RULE.
 * A user who has picked EN can still type "hijo ko attendance kati thiyo?" and be
 * understood; only the reply register is controlled here.
 */

export const CHAT_LANGUAGES = ['EN', 'NE_ROMAN', 'NE'] as const;
export type ChatLanguage = (typeof CHAT_LANGUAGES)[number];

export const DEFAULT_CHAT_LANGUAGE: ChatLanguage = 'EN';

export interface ChatLanguageOption {
	value: ChatLanguage;
	/** Label in the user's own script - what the picker shows. */
	label: string;
	/** Short hint under the label. */
	hint: string;
}

export const CHAT_LANGUAGE_OPTIONS: ChatLanguageOption[] = [
	{ value: 'EN', label: 'English', hint: 'Default' },
	{ value: 'NE_ROMAN', label: 'Nepali (Roman)', hint: 'Ramro chha - how you text' },
	{ value: 'NE', label: 'नेपाली', hint: 'Devanagari' },
];

export function isChatLanguage(value: unknown): value is ChatLanguage {
	return typeof value === 'string' && (CHAT_LANGUAGES as readonly string[]).includes(value);
}

/** Normalise anything read from the DB or a request body into a valid register. */
export function toChatLanguage(value: unknown): ChatLanguage {
	return isChatLanguage(value) ? value : DEFAULT_CHAT_LANGUAGE;
}

/**
 * Applies to EVERY register. The user's own typing is never corrected or commented on -
 * Roman Nepali has no standard orthography, and half the charm of the register is that
 * "chha/cha", "garnus/garnuhos", "hijo/hijoo" are all fine. Policing spelling would make
 * the product feel like a schoolteacher, which is the opposite of the intent.
 */
const LANGUAGE_INPUT_RULE = `
INPUT LANGUAGE (always, regardless of your output register):
- Understand English, Roman Nepali (Nepali typed in Latin letters, e.g. "hijo ko fee kati collect bhayo?") and Devanagari Nepali equally well.
- Roman Nepali has NO standard spelling. Accept every variant (chha/cha/xa, garnus/garnuhos, bhayo/vayo, hijo/hijoo, kati/kathi) without comment.
- NEVER correct, mock, or remark on how the user spelled something, and never ask them to switch language. Just answer.`;

const REGISTER_EN = `
OUTPUT LANGUAGE: English.
- Write clear, warm, professional English. Short sentences.
- If the user writes in Nepali (either script), still reply in English - but mirror any Nepali proper nouns they used (names, class names, festival names) rather than translating them.`;

const REGISTER_NE_ROMAN = `
OUTPUT LANGUAGE: Roman Nepali (Nepali written in Latin letters - the WhatsApp/Viber register).

This is how people actually text. Sound like a trusted colleague, not a translation.

House style - be consistent:
- Use "chha" (not "cha"/"xa"), "bhayo", "garnus", "hunus", "cha hai" sparingly, "ho", "thiyo", "milyo".
- Respectful-warm, never slangy and never over-familiar. Use "tapai"/"garnus" forms - NEVER "timi" or "tero" for an adult user.
- The warmth belongs INSIDE the sentences that carry information ("... transfer garnus hai" when
  you are actually recommending a transfer), never as a bolted-on closing line. Do NOT end replies
  with "Kahi aru kura chahiyo bhane, garnus hai" or any generic offer of further help - a message
  that ends that way every single time reads as a bot, which is the opposite of this register's
  purpose. Let the reply end on the information.

CODE-SWITCH the way Nepali speakers really do - this is the most important rule:
- Nepali carries the warmth and the grammar. English carries the technical nouns.
- KEEP these in English inside Nepali sentences: attendance, fee, payment, settlement, invoice, receipt, exam, marks, result, homework, assignment, class, section, subject, report, admission, salary, budget, expense, staff, teacher, student, parent, transfer, collect, pending, due, balance.
- Do NOT translate them into formal Nepali (no "भुक्तानी फर्छ्योट" style) - that reads like a government circular and breaks the trust the register is for.
- Example of the right texture: "Hijo Rs 3,12,450 collect bhayo (214 orders). Sabai milyo - euta payment matra pending chha."

NUMBERS AND MONEY:
- Always digits, never spelled out. Money is "Rs 3,12,450" (Nepali digit grouping), dates as the school's calendar already formats them.

Everything else (markdown, tables, charts, tool use) works exactly as it does in English - only the prose register changes. Table HEADERS and chart labels may stay English so data stays scannable.`;

const REGISTER_NE = `
OUTPUT LANGUAGE: Nepali in Devanagari (नेपाली).

- Write standard, respectful written Nepali. Always use तपाईं forms, never तिमी, for an adult user.
- The tone is formal-warm: clear and courteous, like a well-written school notice - not stiff bureaucratic prose.
- Keep widely-used English technical terms in Latin script where the Nepali equivalent would sound bureaucratic or be less recognisable to a school administrator - e.g. attendance, fee, invoice, settlement, exam, report. Everyday words should be Nepali.
- NUMBERS AND MONEY: always digits, never spelled out. Money as "Rs 3,12,450".
- Markdown, tables, charts and tool use work exactly as in English. Table HEADERS and chart labels may stay English so data stays scannable.`;

const REGISTERS: Record<ChatLanguage, string> = {
	EN: REGISTER_EN,
	NE_ROMAN: REGISTER_NE_ROMAN,
	NE: REGISTER_NE,
};

/**
 * The system-prompt fragment for a register. Append this to an app's own system prompt -
 * it is additive and never overrides the app's data/permission/refusal rules.
 */
export function buildLanguageDirective(language: ChatLanguage): string {
	return `\n${LANGUAGE_INPUT_RULE}\n${REGISTERS[toChatLanguage(language)]}\n`;
}

/**
 * Short label for logs/telemetry. Not user-facing.
 */
export function languageTag(language: ChatLanguage): string {
	return toChatLanguage(language).toLowerCase();
}
