// Lesson Plan 2.0 - period-budget engine (Phase 0). Pure, deterministic, NO AI.
// srs/lessonplan/03-period-budget-and-pacing-math.md. Every number here is quoted to a principal,
// so every number is derived in code and itemised - never a language model's guess.
//
// Date math uses explicit ISO strings only (new Date(iso) is allowed; Date.now()/argless new Date
// are not, and are never used here). All AD storage; BS is a display concern for the caller.

import type {
    BudgetInput, BudgetResult, TeachableDate, UnitAllocation, Subtraction, Collision,
    RepaceOption, BudgetWarning, Feasibility, DemandMethod, UnitDemandInput,
} from './types';

const DEFAULT_PAGES_PER_PERIOD = 1.4;
const DEFAULT_PERIODS_PER_LESSON = 1.6;

// ── date helpers (UTC, ISO 'YYYY-MM-DD') ─────────────────────────────────────

function ymd(d: Date): string {
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/** Inclusive list of ISO date strings from startISO to endISO. Guards against inverted ranges. */
function eachDateISO(startISO: string, endISO: string): string[] {
    const out: string[] = [];
    const start = new Date(`${startISO}T00:00:00Z`);
    const end = new Date(`${endISO}T00:00:00Z`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return out;
    const cur = new Date(start);
    // Bound the loop so a bad input can never spin forever (>5 years of days).
    for (let i = 0; i < 2000 && cur <= end; i++) {
        out.push(ymd(cur));
        cur.setUTCDate(cur.getUTCDate() + 1);
    }
    return out;
}

function dowOfISO(iso: string): number {
    return new Date(`${iso}T00:00:00Z`).getUTCDay(); // 0=Sun..6=Sat
}

/** ISO week key 'YYYY-Www' for counting distinct teaching weeks. */
function weekKey(iso: string): string {
    const d = new Date(`${iso}T00:00:00Z`);
    // Shift to Thursday of the week (ISO week rule) then take the year+week ordinal.
    const day = (d.getUTCDay() + 6) % 7; // Mon=0..Sun=6
    d.setUTCDate(d.getUTCDate() - day + 3);
    const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
    const week = 1 + Math.round(((d.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
    return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

// ── STEP 1: teachable dates ──────────────────────────────────────────────────
// Every real teachable date-slot in the year: a date that (a) is a weekday this subject has a
// period on, and (b) is not inside any subtract range. Counted PER SLOT, not per day.
export function expandTeachableDates(input: BudgetInput): TeachableDate[] {
    if (input.weeklySlots.length === 0) return [];

    const subtracted = new Set<string>();
    for (const r of input.subtractRanges) {
        for (const iso of eachDateISO(r.startISO, r.endISO)) subtracted.add(iso);
    }

    const slotsByDow = new Map<number, { periodNumber: number }[]>();
    for (const s of input.weeklySlots) {
        const arr = slotsByDow.get(s.dayOfWeek) ?? [];
        arr.push({ periodNumber: s.periodNumber });
        slotsByDow.set(s.dayOfWeek, arr);
    }

    const out: TeachableDate[] = [];
    for (const iso of eachDateISO(input.yearStartISO, input.yearEndISO)) {
        if (subtracted.has(iso)) continue;
        const slots = slotsByDow.get(dowOfISO(iso));
        if (!slots) continue;
        for (const slot of slots) out.push({ dateISO: iso, dayOfWeek: dowOfISO(iso), periodNumber: slot.periodNumber });
    }
    // Deterministic order: by date, then period.
    out.sort((a, b) => (a.dateISO < b.dateISO ? -1 : a.dateISO > b.dateISO ? 1 : a.periodNumber - b.periodNumber));
    return out;
}

// ── STEP 2: reserved periods (itemised, never folded into one number) ────────
export function computeReserved(
    periodsAvailable: number,
    reserved: BudgetInput['reserved'],
): { revision: number; assessment: number; slack: number; total: number } {
    const revision = Math.max(0, Math.round(reserved.revisionPeriods));
    const assessment = Math.max(0, Math.round(reserved.assessmentPeriods));
    const slack = Math.max(0, Math.round((periodsAvailable * reserved.slackPercent) / 100));
    return { revision, assessment, slack, total: revision + assessment + slack };
}

// ── STEP 3: unit demand estimate (blend of available signals; honest even-split fallback) ──
export function estimateUnitDemand(
    unit: UnitDemandInput,
    medianPagesPerPeriod: number,
    medianPeriodsPerLesson: number,
    totalUnits: number,
    forNewTeaching: number | null,
): UnitAllocation['weightBasis'] {
    const signals: { value: number; weight: number }[] = [];
    const pages = unit.pages ?? null;
    const lessons = unit.lessonCount ?? null;
    const pastPaperPct = unit.pastPaperMarkPct ?? null;

    if (pages != null && pages > 0 && medianPagesPerPeriod > 0) {
        signals.push({ value: pages / medianPagesPerPeriod, weight: 0.4 });
    }
    if (lessons != null && lessons > 0 && medianPeriodsPerLesson > 0) {
        signals.push({ value: lessons * medianPeriodsPerLesson, weight: 0.3 });
    }
    if (pastPaperPct != null && pastPaperPct > 0 && forNewTeaching != null && forNewTeaching > 0) {
        signals.push({ value: pastPaperPct * forNewTeaching, weight: 0.3 });
    }

    let method: DemandMethod;
    let estimate: number;

    if (signals.length === 0) {
        // No signal at all: honest even split, flagged. Never a confident wrong number.
        method = 'even_split';
        estimate = forNewTeaching != null && totalUnits > 0
            ? Math.max(1, Math.round(forNewTeaching / totalUnits))
            : 1;
    } else {
        const wsum = signals.reduce((a, s) => a + s.weight, 0);
        estimate = Math.max(1, Math.round(signals.reduce((a, s) => a + s.value * s.weight, 0) / wsum));
        method = signals.length >= 2 ? 'blend'
            : pages != null ? 'pages_only'
            : lessons != null ? 'lessons_only'
            : 'exam_only';
    }

    return { pages, lessons, pastPaperPct, method, estimatePeriods: estimate };
}

// ── STEP 4: walk units onto teachable dates (an ordered consume, not an optimisation) ────────
function allocate(
    units: UnitDemandInput[],
    basisByUnit: Map<string, UnitAllocation['weightBasis']>,
    teachableDates: TeachableDate[],
): UnitAllocation[] {
    const ordered = [...units].sort((a, b) => a.orderIndex - b.orderIndex);
    let cursor = 0;
    const result: UnitAllocation[] = [];

    for (const u of ordered) {
        const basis = basisByUnit.get(u.unitId)!;
        const want = basis.estimatePeriods;
        const slice = teachableDates.slice(cursor, cursor + want);
        cursor += want;
        result.push({
            unitId: u.unitId,
            title: u.title,
            orderIndex: u.orderIndex,
            estimatePeriods: want,
            weightBasis: basis,
            allocatedPeriods: slice.length,       // fewer than `want` when the calendar runs out
            targetStartISO: slice[0]?.dateISO ?? null,
            targetEndISO: slice[slice.length - 1]?.dateISO ?? null,
        });
    }
    return result;
}

// ── STEP 5: collision check ("examined before taught") ───────────────────────
// Cumulative model (no explicit unit->term map exists in the data): a term examines the units the
// plan intends to have taught by its start date. A unit collides when its teaching window straddles
// or falls after a term start it is meant to be examined in. periodsShort = its periods on/after the
// term start (or all of them when the unit could not be placed at all).
function checkCollisions(units: UnitAllocation[], input: BudgetInput): Collision[] {
    const out: Collision[] = [];
    const terms = [...input.examTerms].sort((a, b) => (a.startISO < b.startISO ? -1 : 1));

    for (const term of terms) {
        for (const u of units) {
            // A unit is "in scope" for this term if it starts on/before the term start (teaching has
            // begun) or it could not be placed at all (it is somewhere in the syllabus before later work).
            const startsBefore = u.targetStartISO != null && u.targetStartISO <= term.startISO;
            const unplaceable = u.targetStartISO == null;
            const finishesAfter = u.targetEndISO == null || u.targetEndISO > term.startISO;
            if ((startsBefore || unplaceable) && finishesAfter) {
                // periods on/after the term start (its full estimate when unplaceable).
                const short = unplaceable
                    ? u.estimatePeriods
                    : Math.max(1, u.allocatedPeriods - periodsBefore(u, term.startISO, input, units));
                out.push({
                    unitId: u.unitId,
                    unitTitle: u.title,
                    examTermId: term.termId,
                    termName: term.name,
                    unitEndISO: u.targetEndISO,
                    termStartISO: term.startISO,
                    periodsShort: short,
                    sentence: unplaceable
                        ? `${u.title} does not fit before ${term.name} (starts ${term.startISO}). Its ${u.estimatePeriods} periods would be examined before being taught.`
                        : `${u.title} finishes ${u.targetEndISO}. ${term.name} starts ${term.startISO}. ${short} period${short === 1 ? '' : 's'} of ${u.title} will be examined before being taught.`,
                });
            }
        }
    }
    return out;
}

/** How many of a unit's allocated dates fall strictly before a term start. */
function periodsBefore(u: UnitAllocation, termStartISO: string, _input: BudgetInput, _units: UnitAllocation[]): number {
    if (u.targetStartISO == null) return 0;
    if (u.targetStartISO >= termStartISO) return 0;
    if (u.targetEndISO != null && u.targetEndISO < termStartISO) return u.allocatedPeriods;
    // Straddling: approximate by proportion of the window before the term (dates are contiguous slots).
    const total = daysBetween(u.targetStartISO, u.targetEndISO ?? u.targetStartISO) + 1;
    const before = daysBetween(u.targetStartISO, termStartISO); // exclusive of termStart
    const frac = total > 0 ? Math.max(0, Math.min(1, before / total)) : 0;
    return Math.round(u.allocatedPeriods * frac);
}

function daysBetween(aISO: string, bISO: string): number {
    const a = new Date(`${aISO}T00:00:00Z`).getTime();
    const b = new Date(`${bISO}T00:00:00Z`).getTime();
    return Math.round((b - a) / 86400000);
}

// ── STEP 6: the five options (shown, never auto-applied), with real recovery counts ──────────
function buildOptions(deficit: number, reserved: { slack: number }, units: UnitAllocation[], teachableDates: TeachableDate[]): RepaceOption[] {
    if (deficit <= 0) return [];
    const tail = [...units].sort((a, b) => b.orderIndex - a.orderIndex)[0];
    const trimmable = units.filter((u) => u.estimatePeriods > 3).length;
    const weeks = new Set(teachableDates.map((d) => weekKey(d.dateISO))).size;

    const options: RepaceOption[] = [
        {
            key: 'reduce_slack',
            label: 'Reduce the slack buffer (e.g. 8% to 4%)',
            recoversPeriods: Math.round(reserved.slack / 2),
            cost: 'Less room for periods lost to real life.',
        },
        {
            key: 'flat_trim',
            label: `Trim one period from each larger unit (${trimmable} units)`,
            recoversPeriods: Math.min(deficit, trimmable),
            cost: 'A little less depth spread across several units.',
        },
    ];
    if (tail) {
        options.push({
            key: 'reschedule_tail',
            label: `Move ${tail.title} to a later term`,
            recoversPeriods: tail.estimatePeriods,
            cost: `${tail.title} is taught later in the year.`,
        });
        options.push({
            key: 'self_study_tail',
            label: `Make ${tail.title} guided self-study + homework`,
            recoversPeriods: tail.estimatePeriods,
            cost: `Costs teaching depth on ${tail.title}.`,
        });
    }
    options.push({
        key: 'add_period',
        label: 'Add one period per week for this subject',
        recoversPeriods: weeks,
        cost: 'Needs a timetable change (takes a slot from elsewhere).',
    });
    return options;
}

// ── The whole budget ─────────────────────────────────────────────────────────
export function computeBudget(input: BudgetInput): BudgetResult {
    const warnings: BudgetWarning[] = [];
    if (input.weeklySlots.length === 0) warnings.push('NO_TIMETABLE');
    if (!input.hasHolidays) warnings.push('NO_HOLIDAYS');
    if (!input.hasSyllabus) warnings.push('NO_SYLLABUS');
    if (input.examTerms.length === 0) warnings.push('NO_EXAM_TERMS');

    const teachableDates = expandTeachableDates(input);
    const periodsPerWeek = input.weeklySlots.length > 0 ? input.weeklySlots.length : null;

    // No timetable => the budget is UNKNOWN, never "0 periods" (which reads as "not taught").
    if (periodsPerWeek == null) {
        return {
            periodsPerWeek: null, teachableDates: [], periodsAvailable: null,
            reserved: { revision: 0, assessment: 0, slack: 0, total: 0 },
            periodsForNewTeaching: null, units: [], demandTotal: null, deficit: null,
            feasibility: 'UNKNOWN', tailUnitId: null, collisions: [], options: [],
            subtractions: [], warnings,
        };
    }

    const periodsAvailable = teachableDates.length;
    const reserved = computeReserved(periodsAvailable, input.reserved);
    const periodsForNewTeaching = Math.max(0, periodsAvailable - reserved.total);

    // Itemised subtractions (each links to its source rows).
    const subtractions: Subtraction[] = [];
    const holidayRefs = input.subtractRanges.filter((r) => r.kind === 'holiday');
    const examRefs = input.subtractRanges.filter((r) => r.kind === 'exam_term');
    if (holidayRefs.length) {
        subtractions.push({
            label: 'Holidays',
            periods: holidayPeriods(input, teachableDates, 'holiday'),
            source: 'holiday',
            refIds: holidayRefs.map((r) => r.refId),
        });
    }
    if (examRefs.length) {
        subtractions.push({
            label: 'Exam windows',
            periods: holidayPeriods(input, teachableDates, 'exam_term'),
            source: 'exam_term',
            refIds: examRefs.map((r) => r.refId),
        });
    }
    subtractions.push({ label: 'Revision', periods: reserved.revision, source: 'reserved_revision' });
    subtractions.push({ label: 'Assessment / class tests', periods: reserved.assessment, source: 'reserved_assessment' });
    subtractions.push({ label: `Slack buffer (${input.reserved.slackPercent}%)`, periods: reserved.slack, source: 'slack' });

    // Demand side (skipped when there is no syllabus - budget still useful).
    if (!input.hasSyllabus || input.units.length === 0) {
        return {
            periodsPerWeek, teachableDates, periodsAvailable, reserved, periodsForNewTeaching,
            units: [], demandTotal: null, deficit: null, feasibility: 'UNKNOWN',
            tailUnitId: null, collisions: [], options: [], subtractions, warnings,
        };
    }

    const medianPages = input.medianPagesPerPeriod ?? DEFAULT_PAGES_PER_PERIOD;
    const medianLessons = input.medianPeriodsPerLesson ?? DEFAULT_PERIODS_PER_LESSON;
    const basisByUnit = new Map<string, UnitAllocation['weightBasis']>();
    for (const u of input.units) {
        basisByUnit.set(u.unitId, estimateUnitDemand(u, medianPages, medianLessons, input.units.length, periodsForNewTeaching));
    }
    const demandTotal = [...basisByUnit.values()].reduce((a, b) => a + b.estimatePeriods, 0);
    const deficit = demandTotal - periodsForNewTeaching;

    const units = allocate(input.units, basisByUnit, teachableDates.slice(0, periodsForNewTeaching));
    const collisions = checkCollisions(units, input);
    const options = buildOptions(deficit, reserved, units, teachableDates);

    // Feasibility. UNKNOWN only when there is no timetable (handled above).
    let feasibility: Feasibility;
    if (deficit <= 0) feasibility = 'FITS';
    else if (deficit <= Math.max(2, Math.round(periodsAvailable * 0.05))) feasibility = 'TIGHT';
    else feasibility = 'DOES_NOT_FIT';

    // The tail is the last unit that overruns (could not be fully placed).
    const tail = units.find((u) => u.allocatedPeriods < u.estimatePeriods) ?? null;

    return {
        periodsPerWeek, teachableDates, periodsAvailable, reserved, periodsForNewTeaching,
        units, demandTotal, deficit, feasibility, tailUnitId: tail?.unitId ?? null,
        collisions, options, subtractions, warnings,
    };
}

/** Count how many teachable slots a set of subtract ranges of a kind removed - by re-expanding the
 * pre-subtraction calendar for that kind only and diffing against the actual teachable dates. */
function holidayPeriods(input: BudgetInput, teachableDates: TeachableDate[], kind: 'holiday' | 'exam_term'): number {
    const otherKinds = input.subtractRanges.filter((r) => r.kind !== kind);
    const withoutThisKind = expandTeachableDates({ ...input, subtractRanges: otherKinds });
    return Math.max(0, withoutThisKind.length - teachableDates.length);
}
