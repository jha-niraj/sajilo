/**
 * What the lesson-plan AI features USED to cost, in fixed school credits.
 *
 * Retired as charges 2026-10-10: every lesson-plan AI call is now charged on the AI meter at its real
 * tokens (`@repo/billing/ai-meter`, plan/main/credits/ai-credit-metering.md). The writer no longer
 * reconciles against `WRITE_COST` / `FIGURE_CREDITS` - it settles a meter reservation - so those two
 * are gone. The two below are still read by button labels in apps/main until the credits UI pass
 * replaces them with the meter's own numbers; nothing charges them.
 */

/** @deprecated Display only - "Expand this" is charged at its real tokens. */
export const EXPAND_COST = 2;

/** @deprecated Display only - an outline is charged at its real tokens. */
export const OUTLINE_COST = 2;
