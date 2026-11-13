import { describe, expect, it } from "vitest"
import type { DaySnapshot } from "@/lib/collection/types"
import { applyOpToSnapshot, type QueuedOp } from "./ops"

const day = (over: Partial<DaySnapshot> = {}): DaySnapshot => ({
    date: "2026-10-14",
    isWorkingDay: true,
    lockedAt: null,
    countedCash: null,
    customers: [
        { id: "a", name: "Ram", phone: null, bankAccountNo: null, defaultAmount: 100, routeOrder: 1 },
        { id: "b", name: "Sita", phone: null, bankAccountNo: null, defaultAmount: 200, routeOrder: 2 },
    ],
    entries: [],
    carry: [],
    fetchedAt: "",
    ...over,
})

describe("applyOpToSnapshot", () => {
    it("ticks a customer on that day only", () => {
        const op: QueuedOp = { kind: "mark", opId: "1", customerId: "a", date: "2026-10-14", status: "paid", amountReceived: 100, markedAt: "x" }
        expect(applyOpToSnapshot(day(), op).entries).toHaveLength(1)
        expect(applyOpToSnapshot(day({ date: "2026-10-13" }), op).entries).toHaveLength(0)
    })

    it("treats old outbox rows without a kind as ticks", () => {
        const op = { opId: "1", customerId: "b", date: "2026-10-14", status: "paid", amountReceived: 200, markedAt: "x" } as QueuedOp
        expect(applyOpToSnapshot(day(), op).entries[0]?.amountReceived).toBe(200)
    })

    it("closes and reopens the day with the counted cash", () => {
        const closed = applyOpToSnapshot(day(), { kind: "closeDay", opId: "1", date: "2026-10-14", countedCash: 300 })
        expect(closed.lockedAt).not.toBeNull()
        expect(closed.countedCash).toBe(300)
        expect(applyOpToSnapshot(closed, { kind: "reopenDay", opId: "2", date: "2026-10-14" }).lockedAt).toBeNull()
    })

    it("adds a new shop at the end of the route, but not to days before it started", () => {
        const op: QueuedOp = { kind: "addCustomers", opId: "1", customers: [{ id: "c", name: "Hari", defaultAmount: 50, startDate: "2026-10-14" }] }
        const today = applyOpToSnapshot(day(), op)
        expect(today.customers.map((c) => c.id)).toEqual(["a", "b", "c"])
        expect(today.customers[2]?.routeOrder).toBe(3)
        expect(applyOpToSnapshot(day({ date: "2026-10-13" }), op).customers).toHaveLength(2)
    })

    it("stopping a shop removes it unless money was already taken that day", () => {
        const stop: QueuedOp = { kind: "customerActive", opId: "1", id: "a", isActive: false }
        expect(applyOpToSnapshot(day(), stop).customers.map((c) => c.id)).toEqual(["b"])
        const paid = day({ entries: [{ customerId: "a", date: "2026-10-14", expectedAmount: 100, status: "paid", amountReceived: 100, markedAt: "x", note: null }] })
        expect(applyOpToSnapshot(paid, stop).customers).toHaveLength(2)
    })

    it("reorders the route", () => {
        const next = applyOpToSnapshot(day(), { kind: "reorder", opId: "1", orderedIds: ["b", "a"] })
        expect(next.customers.map((c) => c.id)).toEqual(["b", "a"])
    })

    it("edits name and daily amount", () => {
        const next = applyOpToSnapshot(day(), { kind: "editCustomer", opId: "1", id: "b", fields: { name: "Sita Store", defaultAmount: 250 } })
        expect(next.customers[1]).toMatchObject({ name: "Sita Store", defaultAmount: 250 })
    })
})

describe("customerAlias", () => {
    it("adds a spoken name once, newest last", async () => {
        const { withAlias } = await import("./ops")
        expect(withAlias([], " Rajesh Dukan ")).toEqual(["rajesh dukan"])
        expect(withAlias(["a", "b"], "a")).toEqual(["b", "a"])
        expect(withAlias(Array.from({ length: 10 }, (_, i) => `n${i}`), "x")).toHaveLength(10)
    })
})
