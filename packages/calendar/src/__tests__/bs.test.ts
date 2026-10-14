import { describe, expect, it } from 'vitest';
import { adToBs, bsToAd, bsMonthDays, bsMonthRange, addBsMonths, addAdDays, diffAdDays, formatBs } from '../bs';

describe('BS calendar', () => {
	// Baishakh-Magh 2083 checked against vedicmarga.com and merokalam.com (Oct 2026).
	// Falgun/Chaitra 2083 not yet published there; values are the library's.
	it('2083 month lengths', () => {
		const lens = Array.from({ length: 12 }, (_, i) => bsMonthDays(2083, i + 1));
		expect(lens).toEqual([31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30]);
	});

	it('2082 month lengths', () => {
		const lens = Array.from({ length: 12 }, (_, i) => bsMonthDays(2082, i + 1));
		expect(lens).toEqual([31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30]);
	});

	it('anchors', () => {
		expect(bsToAd({ year: 2083, month: 1, day: 1 })).toBe('2026-04-14');
		expect(adToBs('2026-04-14')).toEqual({ year: 2083, month: 1, day: 1 });
		expect(adToBs('2026-07-16')).toEqual({ year: 2083, month: 3, day: 32 });
		expect(adToBs('2026-07-17')).toEqual({ year: 2083, month: 4, day: 1 });
	});

	it('round trips every day of 2083', () => {
		let ad = '2026-04-14';
		for (let i = 0; i < 365; i++) {
			expect(bsToAd(adToBs(ad))).toBe(ad);
			ad = addAdDays(ad, 1);
		}
	});

	it('month range and month arithmetic', () => {
		expect(bsMonthRange(2083, 3)).toEqual({ start: '2026-06-15', end: '2026-07-16', days: 32 });
		expect(addBsMonths({ year: 2083, month: 3, day: 32 }, 1)).toEqual({ year: 2083, month: 4, day: 31 });
		expect(addBsMonths({ year: 2083, month: 12, day: 10 }, 1)).toEqual({ year: 2084, month: 1, day: 10 });
		expect(diffAdDays('2026-04-14', '2026-05-15')).toBe(31);
	});

	it('formats', () => {
		expect(formatBs({ year: 2083, month: 6, day: 28 }, 'ne')).toBe('२०८३ असोज २८');
		expect(formatBs({ year: 2083, month: 6, day: 28 }, 'en')).toBe('28 Asoj 2083');
	});
});
