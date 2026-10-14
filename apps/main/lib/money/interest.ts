// Village-style loan interest: "Rs X per 100 per month" (सयकडा मासिक), on real BS months.
//
// - A month runs from the lend day to the same BS day next month (Baisakh 10 -> Jestha 10),
//   whatever its length, and earns exactly one month's interest.
// - Days inside a month earn monthlyInterest x days / daysInThatMonthPeriod, so a partial
//   month of 5 days in a 32-day period earns 5/32 of a month.
// - Repayments clear unpaid interest first, then principal.
// - Compounding (optional): at each monthly anniversary, unpaid interest joins the principal.
// - Basis 'balance' charges on what is still owed; 'principal' charges on the original amount.

import { addBsMonths, adToBs, bsToAd, diffAdDays, type BsDate } from '@repo/calendar';

export interface LoanInput {
	principal: number;
	ratePer100: number;
	startDate: string;
	compounding: boolean;
	basis: 'balance' | 'principal';
}

export interface RepaymentInput {
	date: string;
	amount: number;
}

export interface InterestSegment {
	kind: 'interest';
	from: string;
	to: string;
	days: number;
	periodDays: number;
	base: number;
	interest: number;
	fullMonth: boolean;
}

export interface CompoundRow {
	kind: 'compound';
	date: string;
	amount: number;
}

export interface RepaymentRow {
	kind: 'repayment';
	date: string;
	amount: number;
	toInterest: number;
	toPrincipal: number;
	/** Paid beyond everything owed */
	excess: number;
}

export type LoanRow = InterestSegment | CompoundRow | RepaymentRow;

export interface LoanStatement {
	asOf: string;
	principalLeft: number;
	interestDue: number;
	total: number;
	totalInterestCharged: number;
	totalRepaid: number;
	/** Whole months + leftover days since the start */
	elapsed: { months: number; days: number };
	rows: LoanRow[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function anniversary(start: BsDate, k: number): string {
	return bsToAd(addBsMonths(start, k));
}

export function calculateLoan(loan: LoanInput, repayments: RepaymentInput[], asOf: string): LoanStatement {
	const start = adToBs(loan.startDate);
	const rate = loan.ratePer100 / 100;
	const pays = repayments
		.filter((r) => r.date >= loan.startDate && r.date <= asOf && r.amount > 0)
		.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

	let principalLeft = loan.principal;
	let interestDue = 0;
	let totalInterestCharged = 0;
	let totalRepaid = 0;
	const rows: LoanRow[] = [];

	let k = 0;
	let periodStart = loan.startDate;
	let periodEnd = anniversary(start, 1);
	let cursor = loan.startDate;
	let payIdx = 0;
	let fullMonths = 0;

	const accrue = (to: string, fullMonth: boolean) => {
		const days = diffAdDays(cursor, to);
		if (days <= 0) return;
		const periodDays = diffAdDays(periodStart, periodEnd);
		const base = loan.basis === 'principal' ? (principalLeft > 0 ? loan.principal : 0) : principalLeft;
		const interest = round2((base * rate * days) / periodDays);
		if (base > 0) {
			rows.push({ kind: 'interest', from: cursor, to, days, periodDays, base: round2(base), interest, fullMonth });
		}
		interestDue = round2(interestDue + interest);
		totalInterestCharged = round2(totalInterestCharged + interest);
		cursor = to;
	};

	const applyRepayment = (r: RepaymentInput) => {
		const toInterest = Math.min(r.amount, interestDue);
		interestDue = round2(interestDue - toInterest);
		const rest = round2(r.amount - toInterest);
		const toPrincipal = Math.min(rest, principalLeft);
		principalLeft = round2(principalLeft - toPrincipal);
		totalRepaid = round2(totalRepaid + r.amount);
		rows.push({
			kind: 'repayment',
			date: r.date,
			amount: r.amount,
			toInterest: round2(toInterest),
			toPrincipal: round2(toPrincipal),
			excess: round2(rest - toPrincipal),
		});
	};

	while (cursor < asOf) {
		const stop = periodEnd <= asOf ? periodEnd : asOf;

		while (payIdx < pays.length && pays[payIdx]!.date <= stop) {
			const p = pays[payIdx]!;
			accrue(p.date, false);
			applyRepayment(p);
			payIdx++;
		}

		const segmentsBefore = rows.length;
		accrue(stop, stop === periodEnd);
		// A month with no repayment in it shows as one clean "full month" row.
		if (stop === periodEnd && rows.length === segmentsBefore + 1) {
			const last = rows[rows.length - 1] as InterestSegment;
			last.fullMonth = last.from === periodStart;
		}

		if (stop === periodEnd) {
			fullMonths++;
			if (loan.compounding && interestDue > 0 && principalLeft > 0) {
				rows.push({ kind: 'compound', date: periodEnd, amount: interestDue });
				principalLeft = round2(principalLeft + interestDue);
				interestDue = 0;
			}
			k++;
			periodStart = periodEnd;
			periodEnd = anniversary(start, k + 1);
		}

		if (principalLeft <= 0 && interestDue <= 0) break;
	}

	while (payIdx < pays.length) applyRepayment(pays[payIdx++]!);

	const leftoverDays = diffAdDays(periodStart, cursor < asOf ? cursor : asOf);

	return {
		asOf,
		principalLeft: round2(principalLeft),
		interestDue: round2(interestDue),
		total: round2(principalLeft + interestDue),
		totalInterestCharged,
		totalRepaid,
		elapsed: { months: fullMonths, days: Math.max(0, leftoverDays) },
		rows,
	};
}
