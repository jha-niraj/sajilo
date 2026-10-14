// Per-customer collection ledger. Pure: no DB, no dates beyond string compares.
//
// Every working day creates an expected amount. Cash received on a day first covers that day,
// then anything extra settles the customer's OLDEST unpaid days. So Rs 800 after seven missed
// Rs 100 days pays today plus all seven, and those seven show as "paid late on <date>".
// If there is still money left after every old day is settled, it becomes advance credit that
// covers the next days automatically.

export type EntryStatus = 'pending' | 'paid' | 'shop_closed' | 'no_money' | 'holiday';

export interface LedgerEntryInput {
	date: string;
	expectedAmount: number;
	status: EntryStatus;
	amountReceived: number;
}

export interface Settlement {
	/** The day whose cash paid this amount */
	byDate: string;
	amount: number;
}

export interface LedgerDay {
	date: string;
	status: EntryStatus;
	expected: number;
	received: number;
	/** Covered by cash given on the same day */
	paidSameDay: number;
	/** Covered later (catch-up) or earlier (advance) by another day's cash */
	settlements: Settlement[];
	/** Still owed for this day */
	outstanding: number;
	/** This day's cash that went to other (older) days */
	extraToOldDays: Settlement[];
}

export interface CustomerLedger {
	days: LedgerDay[];
	/** Owed for days before `today` */
	arrears: number;
	arrearsDays: number;
	/** Owed for `today` itself */
	todayDue: number;
	/** Money given beyond everything owed so far */
	advance: number;
	totalExpected: number;
	totalReceived: number;
}

export function buildLedger(entries: LedgerEntryInput[], today: string): CustomerLedger {
	const sorted = entries.filter((e) => e.date <= today).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
	const days: LedgerDay[] = [];
	const open: LedgerDay[] = [];
	let credit = 0;
	let creditFrom: string | null = null;
	let totalExpected = 0;
	let totalReceived = 0;

	for (const e of sorted) {
		const expected = e.status === 'holiday' ? 0 : Math.max(0, e.expectedAmount);
		const received = Math.max(0, e.amountReceived);
		totalExpected += expected;
		totalReceived += received;

		const day: LedgerDay = {
			date: e.date,
			status: e.status,
			expected,
			received,
			paidSameDay: 0,
			settlements: [],
			outstanding: expected,
			extraToOldDays: [],
		};

		const own = Math.min(received, day.outstanding);
		day.paidSameDay = own;
		day.outstanding -= own;
		let leftover = received - own;

		while (leftover > 0 && open.length > 0) {
			const oldest = open[0]!;
			const pay = Math.min(leftover, oldest.outstanding);
			oldest.outstanding -= pay;
			oldest.settlements.push({ byDate: day.date, amount: pay });
			day.extraToOldDays.push({ byDate: oldest.date, amount: pay });
			leftover -= pay;
			if (oldest.outstanding === 0) open.shift();
		}

		if (leftover > 0) {
			credit += leftover;
			creditFrom = day.date;
		}

		if (day.outstanding > 0 && credit > 0) {
			const pay = Math.min(credit, day.outstanding);
			day.outstanding -= pay;
			day.settlements.push({ byDate: creditFrom ?? day.date, amount: pay });
			credit -= pay;
		}

		if (day.outstanding > 0) open.push(day);
		days.push(day);
	}

	let arrears = 0;
	let arrearsDays = 0;
	let todayDue = 0;
	for (const d of open) {
		if (d.date < today) {
			arrears += d.outstanding;
			arrearsDays += 1;
		} else {
			todayDue += d.outstanding;
		}
	}

	return { days, arrears, arrearsDays, todayDue, advance: credit, totalExpected, totalReceived };
}

/** A day that was missed and later settled by another day's cash */
export function isPaidLate(day: LedgerDay): boolean {
	return day.expected > 0 && day.settlements.some((s) => s.byDate > day.date);
}
