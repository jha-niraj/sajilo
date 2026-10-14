import { describe, expect, it } from 'vitest'
import { parseCustomerLine } from '../../parse-list'

describe('paste list parser', () => {
    it('comma separated', () => {
        expect(parseCustomerLine('Ram Kirana, 200, 9841234567')).toEqual({ name: 'Ram Kirana', defaultAmount: 200, phone: '9841234567', bankAccountNo: null })
    })
    it('nepali digits and words', () => {
        expect(parseCustomerLine('राम किराना २००')).toEqual({ name: 'राम किराना', defaultAmount: 200, phone: null, bankAccountNo: null })
    })
    it('numbered with rupee and account', () => {
        expect(parseCustomerLine('3. Sita Store - Rs 300 - A/c 0123456789012')).toEqual({
            name: 'Sita Store',
            defaultAmount: 300,
            phone: null,
            bankAccountNo: '0123456789012',
        })
    })
    it('skips empty', () => {
        expect(parseCustomerLine('   ')).toBeNull()
    })
})
