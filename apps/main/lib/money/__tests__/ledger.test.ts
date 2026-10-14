import { describe, expect, it } from 'vitest'
import { buildLedger, isPaidLate, type LedgerEntryInput } from '../ledger'

const day = (date: string, status: LedgerEntryInput['status'], received = 0, expected = 100): LedgerEntryInput => ({
    date,
    status,
    expectedAmount: expected,
    amountReceived: received,
})

describe('collection ledger', () => {
    it('7 missed days then Rs 800 settles everything, oldest first', () => {
        const entries = [
            day('2026-10-01', 'shop_closed'),
            day('2026-10-02', 'pending'),
            day('2026-10-03', 'no_money'),
            day('2026-10-04', 'pending'),
            day('2026-10-05', 'pending'),
            day('2026-10-06', 'pending'),
            day('2026-10-07', 'pending'),
            day('2026-10-08', 'paid', 800),
        ]
        const l = buildLedger(entries, '2026-10-08')
        expect(l.arrears).toBe(0)
        expect(l.todayDue).toBe(0)
        expect(l.days.slice(0, 7).every(isPaidLate)).toBe(true)
        expect(l.days[0]!.settlements).toEqual([{ byDate: '2026-10-08', amount: 100 }])
        expect(l.days[7]!.extraToOldDays).toHaveLength(7)
    })

    it('partial catch-up leaves the newest days owed', () => {
        const l = buildLedger(
            [day('2026-10-01', 'pending'), day('2026-10-02', 'pending'), day('2026-10-03', 'paid', 200)],
            '2026-10-03',
        )
        expect(l.arrears).toBe(100)
        expect(l.arrearsDays).toBe(1)
        expect(l.days[0]!.outstanding).toBe(0)
        expect(l.days[1]!.outstanding).toBe(100)
    })

    it('today pending is today due, not arrears', () => {
        const l = buildLedger([day('2026-10-01', 'pending'), day('2026-10-02', 'pending')], '2026-10-02')
        expect(l.arrears).toBe(100)
        expect(l.todayDue).toBe(100)
    })

    it('holidays are never due', () => {
        const l = buildLedger([day('2026-10-01', 'holiday'), day('2026-10-02', 'paid', 100)], '2026-10-02')
        expect(l.arrears).toBe(0)
        expect(l.totalExpected).toBe(100)
    })

    it('extra beyond all dues becomes advance and covers the next day', () => {
        const l = buildLedger([day('2026-10-01', 'paid', 300), day('2026-10-02', 'pending')], '2026-10-02')
        expect(l.todayDue).toBe(0)
        expect(l.advance).toBe(100)
        expect(l.days[1]!.settlements).toEqual([{ byDate: '2026-10-01', amount: 100 }])
    })

    it('less than today leaves the rest of today owed', () => {
        const l = buildLedger([day('2026-10-01', 'paid', 50)], '2026-10-01')
        expect(l.todayDue).toBe(50)
    })
})
