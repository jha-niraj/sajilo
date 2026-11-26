/**
 * Demo book for the voice prototype (plan/phase-5-voice-first.md), on the account with phone
 * DEMO_PHONE. Re-runnable: it first clears that account's customers, days and recharge, and
 * touches no other account. Run: pnpm --filter @repo/db db:seed-demo
 * With DEMO_PIN set (docker-compose.yml) it first creates the account if the number has none.
 */
import { db } from './client'
import { eq } from 'drizzle-orm'
import { hashPassword } from 'better-auth/crypto'
import { user, account, collectorSettings, customer, collectionEntry, collectionDay, rechargePerson, rechargeEntry, rechargeDay } from './schema'

const DEMO_PHONE = process.env.DEMO_PHONE ?? '+9779503517330'

const CUSTOMERS: [string, number][] = [
    ['Ram Bahadur', 500],
    ['Ram Babu', 200],
    ['Ramesh', 100],
    ['Sita Devi', 200],
    ['Sita Kumari', 300],
    ['Mohan', 100],
    ['Mohan Lal', 1000],
    ['Rajesh Kirana', 500],
    ['Gita Store', 200],
    ['Hari Prasad', 300],
    ['Laxmi Devi', 150],
    ['Sunil Tea Shop', 100],
]

/** Who missed which day (days back from today): shop closed, no money, or simply not marked. */
const MISSES: Record<string, Record<number, 'shop_closed' | 'no_money' | 'skip'>> = {
    'Ram Babu': { 2: 'shop_closed' },
    'Sita Kumari': { 1: 'no_money', 3: 'skip' },
    'Mohan Lal': { 1: 'skip' },
    'Hari Prasad': { 4: 'shop_closed' },
}

function nepalToday(): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kathmandu', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}
function addDays(ad: string, n: number): string {
    const [y, m, d] = ad.split('-').map(Number) as [number, number, number]
    return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}
const at = (ad: string, hour: number) => new Date(`${ad}T${String(hour).padStart(2, '0')}:00:00+05:45`)

/** Same rows the sign-up action makes: phone stored on the user, the PIN as the credential password. */
async function createDemoAccount(): Promise<{ id: string }[]> {
    const pin = process.env.DEMO_PIN
    const [existing] = await db.select({ id: user.id }).from(user).where(eq(user.phoneNumber, DEMO_PHONE))
    if (existing || !pin) return []
    const id = crypto.randomUUID()
    const now = new Date()
    await db.batch([
        db.insert(user).values({ id, name: process.env.DEMO_NAME ?? 'Demo Collector', email: `${DEMO_PHONE.replace(/\D/g, '')}@phone.sajilo.app`, phoneNumber: DEMO_PHONE }),
        db.insert(account).values({ id: crypto.randomUUID(), accountId: id, providerId: 'credential', userId: id, password: await hashPassword(pin), createdAt: now, updatedAt: now }),
        db.insert(collectorSettings).values({ userId: id, language: 'en' }),
    ])
    return [{ id }]
}

async function main() {
    const [u] = (await db.select({ id: user.id }).from(user).where(eq(user.phoneNumber, DEMO_PHONE))).concat(await createDemoAccount())
    if (!u) throw new Error(`No account with phone ${DEMO_PHONE} (set DEMO_PIN to create it)`)
    const me = u.id
    const today = nepalToday()

    await db.batch([
        db.delete(rechargeEntry).where(eq(rechargeEntry.collectorId, me)),
        db.delete(rechargeDay).where(eq(rechargeDay.collectorId, me)),
        db.delete(rechargePerson).where(eq(rechargePerson.collectorId, me)),
        db.delete(collectionDay).where(eq(collectionDay.collectorId, me)),
        db.delete(customer).where(eq(customer.collectorId, me)),
    ])

    const rows = CUSTOMERS.map(([name, amount], i) => ({
        id: crypto.randomUUID(),
        collectorId: me,
        name,
        defaultAmount: amount,
        routeOrder: i + 1,
        startDate: addDays(today, -30),
        aliases: name === 'Rajesh Kirana' ? ['rajesh dukan'] : [],
    }))
    await db.insert(customer).values(rows)

    const entries: (typeof collectionEntry.$inferInsert)[] = []
    for (let back = 5; back >= 1; back--) {
        const date = addDays(today, -back)
        for (const c of rows) {
            const miss = MISSES[c.name]?.[back]
            if (miss === 'skip') continue
            entries.push({
                collectorId: me,
                customerId: c.id,
                date,
                expectedAmount: c.defaultAmount,
                status: miss ?? 'paid',
                amountReceived: miss ? 0 : c.defaultAmount,
                markedAt: at(date, 11),
            })
        }
    }
    await db.insert(collectionEntry).values(entries)
    await db.insert(collectionDay).values(
        [5, 4, 3, 2].map((back) => ({ collectorId: me, date: addDays(today, -back), lockedAt: at(addDays(today, -back), 19) })),
    )

    const ramesh = rows.find((r) => r.name === 'Ramesh')!
    const rameshPerson = `cust:${ramesh.id}`
    const bikash = crypto.randomUUID()
    await db.insert(rechargePerson).values([
        { id: rameshPerson, collectorId: me, customerId: ramesh.id, name: 'Ramesh', phone: null },
        { id: bikash, collectorId: me, customerId: null, name: 'Bikash', phone: '+9779800000101' },
    ])
    const d3 = addDays(today, -3)
    const d2 = addDays(today, -2)
    const d1 = addDays(today, -1)
    const rc = (e: Omit<typeof rechargeEntry.$inferInsert, 'id' | 'collectorId'>) => ({ id: crypto.randomUUID(), collectorId: me, ...e })
    await db.insert(rechargeEntry).values([
        rc({ kind: 'buy', provider: 'ntc', stock: 'eload', date: d3, at: at(d3, 9), amount: 10000, paid: 9650 }),
        rc({ kind: 'buy', provider: 'ncell', stock: 'eload', date: d3, at: at(d3, 9), amount: 5000, paid: 4825 }),
        rc({ kind: 'sell', provider: 'ntc', stock: 'eload', date: d3, at: at(d3, 12), amount: 500, personId: null }),
        rc({ kind: 'sell', provider: 'ncell', stock: 'eload', date: d2, at: at(d2, 13), amount: 200, personId: null }),
        rc({ kind: 'sell', provider: 'ntc', stock: 'eload', date: d2, at: at(d2, 15), amount: 300, personId: bikash }),
        rc({ kind: 'sell', provider: 'ntc', stock: 'eload', date: d1, at: at(d1, 10), amount: 200, personId: rameshPerson }),
        rc({ kind: 'sell', provider: 'ncell', stock: 'eload', date: d1, at: at(d1, 16), amount: 100, personId: null }),
    ])

    console.log(`Seeded ${DEMO_PHONE}: ${rows.length} customers, ${entries.length} entries, 2 udharo people, today ${today}`)
}

main()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
