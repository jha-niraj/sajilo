import { describe, expect, it } from 'vitest'
import { bsToAd } from '@repo/calendar'
import { calculateLoan } from '../interest'

const bs = (year: number, month: number, day: number) => bsToAd({ year, month, day })

describe('interest engine', () => {
    const base = { principal: 10000, ratePer100: 2, compounding: false, basis: 'balance' as const }

    it('one full month = Rs 2 per 100', () => {
        const s = calculateLoan({ ...base, startDate: bs(2083, 1, 10) }, [], bs(2083, 2, 10))
        expect(s.interestDue).toBe(200)
        expect(s.elapsed).toEqual({ months: 1, days: 0 })
    })

    it('1 month + 5 days uses the real length of that month period (Jestha 2083 = 31)', () => {
        const s = calculateLoan({ ...base, startDate: bs(2083, 1, 10) }, [], bs(2083, 2, 15))
        expect(s.interestDue).toBe(232.26)
        expect(s.elapsed).toEqual({ months: 1, days: 5 })
        expect(s.total).toBe(10232.26)
    })

    it('20 days inside Asar 2083 (32-day period)', () => {
        const s = calculateLoan({ ...base, startDate: bs(2083, 3, 1) }, [], bs(2083, 3, 21))
        expect(s.interestDue).toBe(125)
    })

    it('repayment clears interest first, then principal', () => {
        const s = calculateLoan({ ...base, startDate: bs(2083, 1, 10) }, [{ date: bs(2083, 2, 10), amount: 5200 }], bs(2083, 2, 10))
        const r = s.rows.find((x) => x.kind === 'repayment')!
        expect(r).toMatchObject({ toInterest: 200, toPrincipal: 5000 })
        expect(s.principalLeft).toBe(5000)
        expect(s.interestDue).toBe(0)
    })

    it('after a part repayment, interest runs on what is left (balance basis)', () => {
        const s = calculateLoan({ ...base, startDate: bs(2083, 1, 10) }, [{ date: bs(2083, 2, 10), amount: 5200 }], bs(2083, 3, 10))
        expect(s.interestDue).toBe(100)
    })

    it('principal basis keeps charging on the original amount', () => {
        const s = calculateLoan(
            { ...base, basis: 'principal', startDate: bs(2083, 1, 10) },
            [{ date: bs(2083, 2, 10), amount: 5200 }],
            bs(2083, 3, 10),
        )
        expect(s.interestDue).toBe(200)
    })

    it('compounding adds unpaid interest to principal each month', () => {
        const s = calculateLoan({ ...base, compounding: true, startDate: bs(2083, 1, 10) }, [], bs(2083, 3, 10))
        expect(s.principalLeft).toBe(10404)
        expect(s.interestDue).toBe(0)
    })

    it('simple interest over 2 months', () => {
        const s = calculateLoan({ ...base, startDate: bs(2083, 1, 10) }, [], bs(2083, 3, 10))
        expect(s.interestDue).toBe(400)
        expect(s.principalLeft).toBe(10000)
    })

    it('full payoff stops interest', () => {
        const s = calculateLoan({ ...base, startDate: bs(2083, 1, 10) }, [{ date: bs(2083, 2, 10), amount: 10200 }], bs(2083, 5, 10))
        expect(s.total).toBe(0)
    })
})
