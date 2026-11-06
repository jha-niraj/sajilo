import NepaliDateModule from 'nepali-date-converter';

// Day-level Bikram Sambat helpers keyed on 'YYYY-MM-DD' AD strings (Nepal-local calendar days).
//
// Every Date handed to the converter is built at LOCAL NOON from the string's parts. The
// converter reads local date fields, so a UTC-midnight Date (`new Date('2026-10-14')`) turns
// into the previous day on any device west of UTC. Noon keeps the day stable in every zone.

export interface BsDate {
	year: number;
	/** 1 = Baishakh ... 12 = Chaitra */
	month: number;
	day: number;
}

type NepaliDateInstance = {
	getYear: () => number;
	getMonth: () => number;
	getDate: () => number;
	toJsDate: () => Date;
};
type NepaliDateCtor = {
	new (year: number, monthIndex: number, day: number): NepaliDateInstance;
	new (date: Date): NepaliDateInstance;
};

const NepaliDate = ((NepaliDateModule as unknown as { default?: NepaliDateCtor }).default ??
	(NepaliDateModule as unknown as NepaliDateCtor));

export const BS_MONTHS_NE = [
	'बैशाख', 'जेठ', 'असार', 'साउन', 'भदौ', 'असोज',
	'कात्तिक', 'मंसिर', 'पुस', 'माघ', 'फागुन', 'चैत',
] as const;

export const BS_MONTHS_EN = [
	'Baishakh', 'Jestha', 'Asar', 'Shrawan', 'Bhadra', 'Asoj',
	'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra',
] as const;

export const WEEKDAYS_NE = ['आइत', 'सोम', 'मङ्गल', 'बुध', 'बिही', 'शुक्र', 'शनि'] as const;
export const WEEKDAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

const NE_DIGITS = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];

export function toNepaliDigits(value: string | number): string {
	return String(value).replace(/[0-9]/g, (d) => NE_DIGITS[Number(d)]!);
}

function pad(n: number): string {
	return String(n).padStart(2, '0');
}

function parseAd(ad: string): [number, number, number] {
	const [y, m, d] = ad.split('-').map(Number);
	if (!y || !m || !d) throw new Error(`Invalid AD date: ${ad}`);
	return [y, m, d];
}

function localNoon(ad: string): Date {
	const [y, m, d] = parseAd(ad);
	return new Date(y, m - 1, d, 12);
}

function fromLocalDate(date: Date): string {
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function adToBs(ad: string): BsDate {
	const nd = new NepaliDate(localNoon(ad));
	return { year: nd.getYear(), month: nd.getMonth() + 1, day: nd.getDate() };
}

export function bsToAd(bs: BsDate): string {
	return fromLocalDate(new NepaliDate(bs.year, bs.month - 1, bs.day).toJsDate());
}

export function addAdDays(ad: string, days: number): string {
	const date = localNoon(ad);
	date.setDate(date.getDate() + days);
	return fromLocalDate(date);
}

/** Whole days from `from` to `to` (positive when `to` is later). */
export function diffAdDays(from: string, to: string): number {
	return Math.round((localNoon(to).getTime() - localNoon(from).getTime()) / 86_400_000);
}

/** 0 = Sunday ... 6 = Saturday */
export function adDayOfWeek(ad: string): number {
	return localNoon(ad).getDay();
}

export function bsMonthDays(year: number, month: number): number {
	const first = bsToAd({ year, month, day: 1 });
	const next = month === 12 ? bsToAd({ year: year + 1, month: 1, day: 1 }) : bsToAd({ year, month: month + 1, day: 1 });
	return diffAdDays(first, next);
}

/** First and last AD day of a BS month, inclusive. */
export function bsMonthRange(year: number, month: number): { start: string; end: string; days: number } {
	const days = bsMonthDays(year, month);
	const start = bsToAd({ year, month, day: 1 });
	return { start, end: addAdDays(start, days - 1), days };
}

export function addBsMonths(bs: BsDate, months: number): BsDate {
	const total = bs.year * 12 + (bs.month - 1) + months;
	const year = Math.floor(total / 12);
	const month = (total % 12) + 1;
	return { year, month, day: Math.min(bs.day, bsMonthDays(year, month)) };
}

export function compareBs(a: BsDate, b: BsDate): number {
	return a.year - b.year || a.month - b.month || a.day - b.day;
}

export function bsMonthName(month: number, lang: 'ne' | 'en' | 'mai' = 'ne'): string {
	return (lang === 'ne' ? BS_MONTHS_NE : BS_MONTHS_EN)[month - 1] ?? '';
}

/** "२०८३ असोज २८" / "28 Asoj 2083" */
export function formatBs(bs: BsDate, lang: 'ne' | 'en' | 'mai' = 'ne', withYear = true): string {
	if (lang === 'ne') {
		const s = `${bsMonthName(bs.month, 'ne')} ${toNepaliDigits(bs.day)}`;
		return withYear ? `${toNepaliDigits(bs.year)} ${s}` : s;
	}
	const s = `${bs.day} ${bsMonthName(bs.month, 'en')}`;
	return withYear ? `${s} ${bs.year}` : s;
}

export function formatBsMonth(year: number, month: number, lang: 'ne' | 'en' | 'mai' = 'ne'): string {
	return lang === 'ne' ? `${bsMonthName(month, 'ne')} ${toNepaliDigits(year)}` : `${bsMonthName(month, 'en')} ${year}`;
}
