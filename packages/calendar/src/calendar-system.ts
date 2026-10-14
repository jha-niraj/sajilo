import NepaliDateModule from 'nepali-date-converter';
export type SchoolCalendarSystem = 'AD' | 'BS';

// Weekday labels are calendar-independent (a date falls on the same weekday in AD or BS).
export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
// Bikram Sambat month names (Baishakh is month 1).
export const BS_MONTHS_SHORT = [
	'Bai', 'Jes', 'Ash', 'Shr', 'Bha', 'Ash',
	'Kar', 'Man', 'Pou', 'Mag', 'Fal', 'Cha',
] as const;

export const BS_MONTHS_LONG = [
	'Baishakh', 'Jestha', 'Ashadh', 'Shrawan', 'Bhadra', 'Ashwin',
	'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra',
] as const;

export const AD_MONTHS_LONG = [
	'January', 'February', 'March', 'April', 'May', 'June',
	'July', 'August', 'September', 'October', 'November', 'December',
] as const;

/**
 * Four-letter Bikram Sambat abbreviations, for a gutter or a chip that cannot hold "Baishakh".
 *
 * NOT `BS_MONTHS_SHORT`, and the difference is load-bearing: that array is three letters, where
 * **Ashadh and Ashwin both become "Ash"** - two different months rendering identically in the same
 * column. Four letters separates them (Asha / Ashw) and every other month stays unique. The
 * three-letter array is left alone because its existing callers render one month at a time, where
 * the collision cannot be seen.
 */
export const BS_MONTHS_ABBR = [
	'Bais', 'Jest', 'Asha', 'Shra', 'Bhad', 'Ashw',
	'Kart', 'Mang', 'Pous', 'Magh', 'Falg', 'Chai',
] as const;

export const AD_MONTHS_SHORT = [
	'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
	'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

/**
 * The twelve months of the school's own year, in order, for a picker or a legend.
 *
 * Use this instead of writing a month array into a feature file. A hardcoded
 * `['January', ...]` is not a neutral default - on a Bikram Sambat school it names months the
 * school does not have, and when the label is what gets STORED (see the billing months picker)
 * the wrong word ends up on a record.
 */
export function schoolMonthNames(
	calendarSystem: SchoolCalendarSystem
): readonly string[] {
	return calendarSystem === 'BS' ? BS_MONTHS_LONG : AD_MONTHS_LONG;
}

/**
 * The twelve months abbreviated, for somewhere narrow.
 *
 * Reach for this when the container is fixed and small. Measured case: the student attendance
 * heatmap gives each month a 36px gutter on a phone, sized against AD's "Sep" at ~24px - and on a
 * Bikram Sambat school NINE of the twelve full names overflowed it, "Baishakh" by 17px. The
 * abbreviations fit in ~28px, so the fix is a shorter label rather than 20px stolen from the grid
 * of dots beside it.
 */
export function schoolMonthNamesShort(
	calendarSystem: SchoolCalendarSystem
): readonly string[] {
	return calendarSystem === 'BS' ? BS_MONTHS_ABBR : AD_MONTHS_SHORT;
}

/**
 * Name the Nth month of the school's year. `index` is 1-based, so 1 is Baishakh on BS and
 * January on AD. Out-of-range input returns '-' rather than throwing or wrapping, because the
 * callers are rendering stored data that may predate any validation.
 */
export function formatSchoolMonthByIndex(
	index: number,
	calendarSystem: SchoolCalendarSystem
): string {
	const names = schoolMonthNames(calendarSystem);
	return names[index - 1] ?? '-';
}

type NepaliDateStatic = {
	fromAD: (date: Date) => {
		format: (pattern: string, lang?: 'en' | 'np') => string;
		toJsDate: () => Date;
	};
	parse: (value: string) => {
		toJsDate: () => Date;
		format: (pattern: string, lang?: 'en' | 'np') => string;
	};
};

const NepaliDate = ((NepaliDateModule as unknown as { default?: NepaliDateStatic }).default ??
	(NepaliDateModule as unknown as NepaliDateStatic));

export function formatSchoolDate(
	value: Date | string | null | undefined,
	calendarSystem: SchoolCalendarSystem,
	options?: Intl.DateTimeFormatOptions
): string {
	if (!value) return '-';
	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) return '-';

	if (calendarSystem === 'BS') {
		const bs = NepaliDate.fromAD(date);
		// Most list/date UIs only need day-level readability.
		const pattern = options?.year || options?.month ? 'YYYY MMMM DD' : 'YYYY-MM-DD';
		return bs.format(pattern, 'en');
	}

	return date.toLocaleDateString('en-NP', options ?? {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
	});
}

export function formatSchoolDateTime(
	value: Date | string | null | undefined,
	calendarSystem: SchoolCalendarSystem
): string {
	if (!value) return '-';
	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) return '-';

	if (calendarSystem === 'BS') {
		const bsDate = NepaliDate.fromAD(date).format('YYYY-MM-DD', 'en');
		const time = date.toLocaleTimeString('en-NP', {
			hour: '2-digit',
			minute: '2-digit',
		});
		return `${bsDate} ${time}`;
	}

	return date.toLocaleString('en-NP', {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	});
}

/** Month-only label, e.g. "June 2026" (AD) or "Ashadh 2083" (BS). */
export function formatSchoolMonthLabel(
	value: Date | string,
	calendarSystem: SchoolCalendarSystem
): string {
	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) return '-';

	if (calendarSystem === 'BS') {
		try {
			return NepaliDate.fromAD(date).format('MMMM YYYY', 'en');
		} catch {
			// fall through to AD
		}
	}

	return date.toLocaleDateString('en-NP', { month: 'long', year: 'numeric' });
}

/**
 * A SHORT month label - "Bai" / "Jan" - for a compact chart axis.
 *
 * `formatSchoolMonthLabel` returns "MMMM YYYY", and in BS that is a long string: "Baisakh 2082" is
 * ~78px at 12px, so six of them is ~468px of labels competing for a ~276px plot on a 360px screen.
 * Recharts resolves that collision by silently DROPPING ticks, so months go unlabelled and the axis
 * misrepresents the series. Billing solves it with a two-line tick because its chart is tall enough
 * to spend a line on the year; a 140px panel is not, and there the short name is the right trade -
 * the panel's own title carries the window ("Last 6 months").
 *
 * Deliberately no year. A caller that needs one should use `formatSchoolMonthLabel` and give the
 * axis the vertical room for it, rather than making this string longer.
 */
export function formatSchoolMonthShort(
	value: Date | string | null | undefined,
	calendarSystem: SchoolCalendarSystem
): string {
	if (value === null || value === undefined) return '-';
	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) return '-';

	if (calendarSystem === 'BS') {
		try {
			// `M` is the 1-based BS month; BS_MONTHS_SHORT is 0-indexed.
			const m = Number(NepaliDate.fromAD(date).format('M', 'en'));
			const label = BS_MONTHS_SHORT[m - 1];
			if (label) return label;
		} catch {
			// fall through to AD
		}
	}

	return date.toLocaleDateString('en-NP', { month: 'short' });
}

/**
 * The BS month(s) that an AD MONTH BUCKET spans - "Ash/Shr" rather than "Ash".
 *
 * ## Why a span, and why `formatSchoolMonthShort` is not enough for a chart axis
 *
 * A chart that aggregates with `date_trunc('month', ...)` has AD buckets. A BS month starts around
 * the middle of an AD month, so naming an AD bucket after ONE BS month means sampling a point
 * inside it - and the sampling drifts. In the six months to September 2026, labelling each bucket
 * with the BS month containing its 15th produced:
 *
 *     Bai  Jes  Ash  Ash  Shr  Bha
 *
 * Two adjacent buckets called Ashadh, and Ashwin - the month the chart ends in - never shown at
 * all. Recharts then has two ticks with one name, which reads as a rendering fault rather than a
 * calendar one, and a reader cannot tell which bar is which month.
 *
 * Naming both months the bucket touches is unambiguous AND true: an AD month really does fall
 * across two BS months. The alternative is to bucket by BS month, which needs a BS-to-AD
 * conversion this package does not expose and changes every aggregate rather than its labels.
 *
 * `formatSchoolMonthShort` stays correct for a single DATE. Use this one for a month BUCKET.
 */
export function formatSchoolMonthSpan(
	value: Date | string | null | undefined,
	calendarSystem: SchoolCalendarSystem
): string {
	if (value === null || value === undefined) return '-';
	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) return '-';

	if (calendarSystem !== 'BS') {
		return date.toLocaleDateString('en-NP', { month: 'short' });
	}

	// First and last day of the AD month this date falls in.
	const start = new Date(date.getFullYear(), date.getMonth(), 1);
	const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
	const first = formatSchoolMonthShort(start, 'BS');
	const last = formatSchoolMonthShort(end, 'BS');
	if (first === '-' || last === '-') return first === '-' ? last : first;
	return first === last ? first : `${first}/${last}`;
}

export function parseSchoolDateInput(
	value: string,
	calendarSystem: SchoolCalendarSystem
): Date | null {
	if (!value.trim()) return null;

	try {
		if (calendarSystem === 'BS') {
			return NepaliDate.parse(value.trim()).toJsDate();
		}
		const date = new Date(value);
		return Number.isNaN(date.getTime()) ? null : date;
	} catch {
		return null;
	}
}

export function getBsPartsFromAd(value: Date | string): {
	year: number;
	month: number;
	day: number;
} | null {
	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) return null;

	try {
		const formatted = NepaliDate.fromAD(date).format('YYYY-MM-DD', 'en');
		const [year, month, day] = formatted.split('-').map(Number);
		if (!year || !month || !day) return null;
		return { year, month, day };
	} catch {
		return null;
	}
}

/**
 * Maps the AD start year of a school session to the dominant BS year.
 * A Nepali session that starts in AD `adStartYear` (Baishakh ~ mid-April)
 * sits inside the BS year that is current around mid-year (July) of that AD year.
 */
function adSessionToBsYear(adStartYear: number): number | null {
	const parts = getBsPartsFromAd(new Date(adStartYear, 6, 1));
	return parts?.year ?? null;
}

/**
 * Converts an academic-year label to the school's calendar system.
 * "2026-27" → BS "2083-84"; in AD the value is returned unchanged.
 * Accepts "YYYY", "YYYY-YY", "YYYY-YYYY", or "YYYY/YY" forms.
 */
export function formatAcademicYear(
	academicYear: string | null | undefined,
	calendarSystem: SchoolCalendarSystem
): string {
	if (!academicYear) return '-';
	if (calendarSystem !== 'BS') return academicYear;

	const range = academicYear.match(/^\s*(\d{4})\s*[-/–—]\s*(\d{2,4})\s*$/);
	if (range) {
		const bsStart = adSessionToBsYear(Number(range[1]));
		if (!bsStart) return academicYear;
		return `${bsStart}-${String(bsStart + 1).slice(-2)}`;
	}

	const single = academicYear.match(/^\s*(\d{4})\s*$/);
	if (single) {
		const bsStart = adSessionToBsYear(Number(single[1]));
		return bsStart ? String(bsStart) : academicYear;
	}

	return academicYear;
}

export function getAdDateFromBs(year: number, month: number, day: number): Date | null {
	try {
		return NepaliDate.parse(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`).toJsDate();
	} catch {
		return null;
	}
}

/**
 * Compact display parts for a single date in the school's calendar system.
 * weekday is always the real weekday; day/monthShort/year switch to BS when needed.
 * Used by week/day grid headers (lesson plan schedule, "this week" panels).
 */
export function getSchoolDateParts(
	value: Date | string,
	calendarSystem: SchoolCalendarSystem,
): { weekday: string; day: number; monthShort: string; year: number } {
	const date = value instanceof Date ? value : new Date(value);
	const weekday = WEEKDAY_SHORT[date.getDay()] ?? 'Sun';

	if (calendarSystem === 'BS') {
		const bs = getBsPartsFromAd(date);
		if (bs) {
			return {
				weekday,
				day: bs.day,
				monthShort: BS_MONTHS_SHORT[bs.month - 1] ?? '',
				year: bs.year,
			};
		}
	}

	const AD_MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	return {
		weekday,
		day: date.getDate(),
		monthShort: AD_MONTHS_SHORT[date.getMonth()] ?? '',
		year: date.getFullYear(),
	};
}

/**
 * The month and year a date falls in, IN the school's calendar system.
 *
 * `getSchoolDateParts` deliberately returns the month as a NAME, which is what a date label needs
 * and useless to anything that has to page through months or query a range. This returns the
 * numbers, so "which month am I looking at" has one answer both a picker and a query can use.
 *
 * Pair it with `getMonthRangeForCalendar` to turn that pair back into an AD range: a BS month is
 * not a Gregorian month (Bhadra 2083 runs 2026-08-17 to 2026-09-16 and has 32 days), so the two
 * must always be converted together and never assumed to line up.
 */
export function getSchoolMonthYear(
	value: Date | string,
	calendarSystem: SchoolCalendarSystem,
): { month: number; year: number } {
	const date = value instanceof Date ? value : new Date(value);

	if (calendarSystem === 'BS') {
		const bs = getBsPartsFromAd(date);
		if (bs) return { month: bs.month, year: bs.year };
	}

	return { month: date.getMonth() + 1, year: date.getFullYear() };
}

/**
 * Most-recent week-start for the school's calendar system.
 * BS (Nepal) weeks begin Sunday; AD weeks begin Monday.
 */
export function getSchoolWeekStart(
	value: Date | string,
	calendarSystem: SchoolCalendarSystem,
): Date {
	const d = value instanceof Date ? new Date(value) : new Date(value);
	const day = d.getDay(); // 0=Sun … 6=Sat
	const diff = calendarSystem === 'BS' ? -day : (day === 0 ? -6 : 1 - day);
	d.setDate(d.getDate() + diff);
	d.setHours(0, 0, 0, 0);
	return d;
}

/**
 * Serialize a Date to a `YYYY-MM-DD` key using its LOCAL calendar day.
 *
 * Use this instead of `.toISOString().split('T')[0]` for any date that represents a school DAY
 * rather than an instant. The two disagree for every timezone ahead of UTC, and Nepal is +5:45:
 * `setHours(0,0,0,0)` produces local midnight, which `toISOString()` then renders as 18:15 UTC on
 * the PREVIOUS day, so the date key comes out one day early.
 *
 * That is not hypothetical. It shifted the whole lesson-plan schedule board by a day: the week
 * began on Saturday, which is the weekly holiday in Nepal, and the six-day grid ran Saturday to
 * Thursday. Friday is a teaching day, so any lesson scheduled on a Friday was rendered nowhere,
 * and paging by seven days never brought it back.
 */
export function toSchoolDateKey(value: Date): string {
	const y = value.getFullYear();
	const m = String(value.getMonth() + 1).padStart(2, '0');
	const d = String(value.getDate()).padStart(2, '0');
	return `${y}-${m}-${d}`;
}

export function getMonthRangeForCalendar(
	year: number,
	month: number,
	calendarSystem: SchoolCalendarSystem
): { startDate: Date; endDate: Date; daysInMonth: number; firstDay: number } | null {
	if (calendarSystem === 'AD') {
		const startDate = new Date(year, month - 1, 1);
		const endDate = new Date(year, month, 0, 23, 59, 59, 999);
		return {
			startDate,
			endDate,
			daysInMonth: endDate.getDate(),
			firstDay: startDate.getDay(),
		};
	}

	const startDate = getAdDateFromBs(year, month, 1);
	if (!startDate) return null;

	const nextMonth = month === 12 ? 1 : month + 1;
	const nextYear = month === 12 ? year + 1 : year;
	const nextMonthStart = getAdDateFromBs(nextYear, nextMonth, 1);
	if (!nextMonthStart) return null;

	const endDate = new Date(nextMonthStart);
	endDate.setDate(endDate.getDate() - 1);
	endDate.setHours(23, 59, 59, 999);

	const endParts = getBsPartsFromAd(endDate);
	if (!endParts) return null;

	return {
		startDate,
		endDate,
		daysInMonth: endParts.day,
		firstDay: startDate.getDay(),
	};
}
