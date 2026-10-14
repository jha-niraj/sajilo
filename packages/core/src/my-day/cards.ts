/**
 * My Day: the card, the lanes, and the rules that put one in the other.
 *
 * ## The idea this file encodes
 *
 * **There is no "teacher" on this page. Everyone is a user, and the board shows what THEIR
 * permissions let them act on.** A card is produced by a source query only when the caller holds
 * the permission that already guards that module, so an accountant and a class teacher open the
 * same page and see different work without either of them being a special case in the code.
 *
 * ## Why the lanes are TIME, not status
 *
 * To Do / Doing / Done is a developer's model of somebody's day. A person thinks in periods and
 * deadlines, and a card nobody dragged into "Doing" is not evidence of anything. So the lanes are
 * Today, This week, Waiting on me, and Asked for - and the first three are DERIVED from tables we
 * already have, never stored.
 *
 * That last part is the load-bearing decision. If derived cards were rows, we would have to keep
 * them in sync with the truth, and the day they drift the board is lying to somebody about their
 * own week. Deriving them means the board cannot be stale. The only thing that gets stored is what
 * a person typed themselves, plus their dismissals - and a dismissal is recorded against
 * `sourceKey`, so a derived card never has to be materialised just so it can be hidden.
 *
 * ## Why this file has no imports, and why it lives in `@repo/core`
 *
 * The action that builds a board is `'use server'` and pulls in `@repo/db`, so nothing in it can be
 * unit-tested. Everything here is a pure function of its arguments - `today` is passed IN as a
 * string rather than read from a clock, so the lane rules are testable and so that the caller is
 * forced to decide what "today" means. In Nepal that is `toNepalDateStr()`, not `new Date()`:
 * the school runs on UTC+5:45, and a board that flips over at midnight UTC changes day in the
 * middle of the afternoon.
 *
 * It sits in `@repo/core` rather than in `apps/main` because the STUDENT app has the same board,
 * and "a card in the past is waiting on you, not this week" must not be two implementations that
 * drift. The staff and student boards differ in their SOURCES, which are per-app, and in nothing
 * else. Same reason `@repo/core/permissions` exists: a second copy of a rule is the copy that
 * quietly disagrees.
 */

/** The four lanes, in the order they are shown. */
export const LANES = [
    {
        id: 'TODAY',
        label: 'Today',
        /** Shown when this lane is empty. Says what WOULD be here, not "nothing". */
        emptyHint: 'Nothing scheduled for you today.',
    },
    {
        id: 'THIS_WEEK',
        label: 'This week',
        emptyHint: 'Nothing else due before the week is out.',
    },
    {
        id: 'WAITING',
        label: 'Waiting on me',
        emptyHint: 'Nothing is waiting on you. This is the lane you want empty.',
    },
    {
        id: 'ASKED',
        label: 'Asked for',
        emptyHint: 'Anything you add yourself, or ask Saathi to make, lands here.',
    },
] as const;

export type MyDayLane = typeof LANES[number]['id'];

/**
 * Where a card came from. One value per source query, plus `TASK` for a row somebody wrote.
 *
 * The kind is what decides the icon and the wording; it is deliberately NOT a severity. A period
 * is not more or less urgent than a bill - that is what `urgency` is for.
 */
/**
 * The kinds the STAFF board can produce.
 *
 * Split from the student list, and the split is load-bearing rather than tidy. Each app builds
 * exhaustive `Record<Kind, ...>` maps - the icon table, the runner table - and a single shared
 * union would force every app to carry entries for kinds it can never produce, which is noise that
 * makes the exhaustiveness meaningless. With two lists, adding a kind fails to compile in exactly
 * the app that has to handle it, and nowhere else.
 *
 * `HOMEWORK_UNMARKED` and `TASK` appear in both on purpose. `HOMEWORK_UNMARKED` means a teacher's
 * marking queue on one side and a student's unsubmitted work on the other; it is the same card in
 * the same lane for the same reason ("this is waiting on you"), and two names would be two names
 * for one idea.
 */
export const STAFF_CARD_KINDS = [
    'PERIOD_TODAY', 'PERIOD_UNPLANNED', 'HOMEWORK_UNMARKED',
    'LEAVE_PENDING', 'BILL_OVERDUE', 'MEETING_TODAY', 'TASK',
] as const;

/** The kinds the STUDENT board can produce. */
export const STUDENT_CARD_KINDS = [
    'PERIOD_TODAY', 'HOMEWORK_UNMARKED', 'PRACTICE_TODAY', 'EXAM_UPCOMING', 'TASK',
] as const;

export type StaffCardKind = typeof STAFF_CARD_KINDS[number];
export type StudentCardKind = typeof STUDENT_CARD_KINDS[number];

/** Anything either board can carry. The lane rules below are written against this. */
export type MyDayCardKind = StaffCardKind | StudentCardKind;

/**
 * How loudly a card should read.
 *
 * Three values and no colour. The colour is the consumer's decision and the root CLAUDE.md is
 * explicit that a card surface stays neutral whatever its state - the state is carried by the
 * words in it. `urgency` exists to ORDER cards and to pick a chip, not to tint a panel.
 */
export type MyDayUrgency = 'NORMAL' | 'ATTENTION' | 'OVERDUE';

export type MyDayCard = {
    /**
     * Stable across reloads and unique per user, e.g. `homework-unmarked:cmt123`.
     *
     * This is the whole mechanism behind dismissal. A derived card is not a row, so "I do not want
     * to see that again" cannot be a flag on it; it is a `user_tasks` row carrying this key with
     * status DISMISSED, which the derivation filters against. The key must therefore be derived
     * from something durable - a record id - and never from a title or a position.
     */
    sourceKey: string;
    kind: MyDayCardKind;
    /** One line. What the thing IS. */
    title: string;
    /** One line. What about it needs the user. Optional - a period needs no explanation. */
    detail?: string;
    /** Where the work actually happens. A card with nowhere to go is a notification, not a task. */
    href?: string;
    /**
     * The timetable slot this card is about, when it is a period. A card with a slot opens the
     * Period sheet in place rather than navigating - the sheet is where a period is acted on.
     */
    slot?: { date: string; periodNumber: number };
    /**
     * The school day this card belongs to, `YYYY-MM-DD` in Nepal time, when it has one.
     *
     * Absent means "no date" - an unmarked script does not become due, it simply waits - and an
     * undated card always lands in Waiting on me.
     */
    onDate?: string;
    /** Period number, so Today sorts the way the day actually runs. */
    period?: number;
    urgency: MyDayUrgency;
    /** For a card that stands in for many things: "22 scripts". */
    count?: number;
};

export type MyDayBoard = {
    /** `YYYY-MM-DD` in Nepal time - the day the board was built for. */
    today: string;
    cards: MyDayCard[];
    /**
     * Sources that were skipped because the caller lacks the permission. Not an error, and not
     * shown as one: it is why an accountant's board has no periods on it, and the empty state
     * needs to be able to say so rather than implying something is broken.
     */
    skipped: MyDayCardKind[];
    /**
     * Sources that threw. Named rather than swallowed, because "your homework lane is empty" and
     * "we could not read your homework" are different facts and a board must not present the
     * second as the first.
     */
    failed: MyDayCardKind[];
    /**
     * How many derived cards this person has hidden.
     *
     * Surfaced so the board can offer a way back. A dismissal is invisible by design, and an
     * invisible pile with no undo is how somebody quietly empties their own board and then cannot
     * work out why it is always empty.
     */
    dismissedCount: number;
};

/** Build a `sourceKey` from a card kind and a durable record id. */
export function sourceKey(kind: MyDayCardKind, id: string): string {
    return `${kind.toLowerCase().replace(/_/g, '-')}:${id}`;
}

/**
 * Which lane a card belongs in.
 *
 * Total by construction - every card lands somewhere, and the order of the checks is the whole
 * rule. A dated card in the past is NOT "this week" and it is not silently dropped either; it is
 * waiting on you, which is exactly what an overdue bill or an unheld meeting is.
 */
export function laneFor(card: MyDayCard, today: string): MyDayLane {
    if (card.kind === 'TASK') return 'ASKED';
    if (!card.onDate) return 'WAITING';
    if (card.onDate === today) return 'TODAY';
    if (card.onDate > today) return 'THIS_WEEK';
    return 'WAITING';
}

const URGENCY_ORDER: Record<MyDayUrgency, number> = { OVERDUE: 0, ATTENTION: 1, NORMAL: 2 };

/**
 * Sort within a lane: the day as it runs, then what is loudest, then something stable.
 *
 * Date before period before urgency, because inside Today the only order a person recognises is
 * the timetable - a loud card floating above period 1 would be reordering their morning to make a
 * point. Across the undated lanes there is no timetable, so urgency leads.
 *
 * The final tiebreak is the title, never the array order, so two runs of the same board cannot
 * come back in a different sequence.
 */
export function compareCards(a: MyDayCard, b: MyDayCard): number {
    if (a.onDate && b.onDate && a.onDate !== b.onDate) return a.onDate < b.onDate ? -1 : 1;
    if (a.onDate && !b.onDate) return -1;
    if (!a.onDate && b.onDate) return 1;

    const ap = a.period ?? Number.MAX_SAFE_INTEGER;
    const bp = b.period ?? Number.MAX_SAFE_INTEGER;
    if (ap !== bp) return ap - bp;

    const au = URGENCY_ORDER[a.urgency];
    const bu = URGENCY_ORDER[b.urgency];
    if (au !== bu) return au - bu;

    return a.title.localeCompare(b.title);
}

/** The cards for one lane, in order. */
export function cardsInLane(board: MyDayBoard, lane: MyDayLane): MyDayCard[] {
    return board.cards
        .filter((c) => laneFor(c, board.today) === lane)
        .sort(compareCards);
}
