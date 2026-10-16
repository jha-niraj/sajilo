"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { Camera, ChevronRight, ClipboardPaste, CloudUpload, GripVertical, Plus, Users } from "lucide-react"
import {
    DndContext,
    KeyboardSensor,
    PointerSensor,
    TouchSensor,
    closestCenter,
    useSensor,
    useSensors,
    type DragEndEvent,
} from "@dnd-kit/core"
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { cn } from "@repo/ui/lib/utils"
import { PageTop } from "@/components/shell/page-top"
import { BottomSheet } from "@/components/bottom-sheet"
import { useI18n } from "@/lib/i18n"
import { parseCustomerList } from "@/lib/parse-list"
import { newOpId, queueOp } from "@/lib/offline/sync"
import { usePendingCustomerOps, withPendingCustomers } from "@/lib/offline/pending-customers"
import type { CustomerRow } from "@/actions/customer.action"
import { CustomerEditSheet } from "@/components/customers/customer-edit-sheet"
import { Textarea } from "@repo/ui/components/ui/textarea"
import { ScrollArea } from "@repo/ui/components/ui/scroll-area"

export function ManageClient({ initial, today }: { initial: CustomerRow[]; today: string }) {
    const { t, money, num } = useI18n()
    const router = useRouter()
    const params = useSearchParams()
    const [base, setBase] = useState(initial)
    const ops = usePendingCustomerOps()
    const { rows: items, pendingIds } = useMemo(() => withPendingCustomers(base, ops, today), [base, ops, today])
    const [editing, setEditing] = useState<CustomerRow | "new" | null>(null)
    const [pasteOpen, setPasteOpen] = useState(false)
    const [pasteText, setPasteText] = useState("")
    const [busy, startTransition] = useTransition()

    useEffect(() => setBase(initial), [initial])

    useEffect(() => {
        const id = params.get("edit")
        if (id) {
            const c = initial.find((x) => x.id === id)
            if (c) setEditing(c)
        }
    }, [params, initial])

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    )

    const active = useMemo(() => items.filter((c) => c.isActive), [items])
    const stopped = useMemo(() => items.filter((c) => !c.isActive), [items])

    const afterChange = (synced: boolean, msg?: string) => {
        if (!synced) toast.success(t("savedOffline"))
        else if (msg) toast.success(msg)
        if (synced) router.refresh()
    }

    const onDragEnd = (e: DragEndEvent) => {
        const { active: a, over } = e
        if (!over || a.id === over.id) return
        const from = active.findIndex((c) => c.id === a.id)
        const to = active.findIndex((c) => c.id === over.id)
        const next = arrayMove(active, from, to)
        setBase((b) => {
            const pos = new Map(next.map((c, i) => [c.id, i + 1]))
            return b.map((c) => ({ ...c, routeOrder: pos.get(c.id) ?? c.routeOrder }))
        })
        void queueOp({ kind: "reorder", orderedIds: next.map((c) => c.id) })
    }

    const parsed = useMemo(() => parseCustomerList(pasteText), [pasteText])
    const pasteValid = parsed.filter((p) => p.defaultAmount && p.defaultAmount > 0)

    const savePaste = () =>
        startTransition(async () => {
            const customers = pasteValid.map((p) => ({ id: newOpId(), name: p.name, defaultAmount: p.defaultAmount!, phone: p.phone ?? null, bankAccountNo: p.bankAccountNo ?? null, startDate: today }))
            const res = await queueOp({ kind: "addCustomers", customers }, { wait: 5000 })
            setPasteOpen(false)
            setPasteText("")
            afterChange(res.synced, t("customersAdded", { count: customers.length }))
        })

    return (
        <>
            <PageTop title={t("manageTitle")} subtitle={`${num(active.length)} ${t("active")}`} backHref="/more" />

            <div className="space-y-4 px-4 pt-4">
                <div className="grid grid-cols-3 gap-2.5">
                    <ActionTile icon={<Plus className="h-6 w-6" />} label={t("addCustomer")} onClick={() => setEditing("new")} primary />
                    <ActionTile icon={<Camera className="h-6 w-6" />} label={t("importFromPhoto")} href="/scan?kind=customers" />
                    <ActionTile icon={<ClipboardPaste className="h-6 w-6" />} label={t("importPaste")} onClick={() => setPasteOpen(true)} />
                </div>

                {active.length > 1 && <p className="px-1 text-[14px] text-ink-3">{t("reorderHint")}</p>}

                {items.length === 0 && (
                    <div className="flex flex-col items-center rounded-[24px] bg-card px-6 py-10 text-center ring-1 ring-line">
                        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-saffron-soft text-saffron">
                            <Users className="h-7 w-7" />
                        </span>
                        <p className="mt-3 text-[15px] font-semibold text-ink">{t("noCustomersYet")}</p>
                        <p className="mt-1 max-w-xs text-[14px] text-ink-2">{t("manageEmptySub")}</p>
                    </div>
                )}

                <DndContext id="customer-route" sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                    <SortableContext items={active.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                        <ul className={cn("space-y-2", busy && "opacity-80")}>
                            {active.map((c, i) => (
                                <SortableRow key={c.id} c={c} index={i} pending={pendingIds.has(c.id)} onEdit={() => setEditing(c)} money={money} num={num} />
                            ))}
                        </ul>
                    </SortableContext>
                </DndContext>

                {stopped.length > 0 && (
                    <section>
                        <p className="mb-2 mt-6 px-1 text-[15px] font-semibold text-ink-3">{t("inactive")}</p>
                        <ul className="space-y-2">
                            {stopped.map((c) => (
                                <li key={c.id}>
                                    <Link
                                        href={`/customers/${c.id}`}
                                        className="flex w-full items-center justify-between gap-3 rounded-2xl bg-paper-2 px-4 py-3 text-left text-ink-3"
                                    >
                                        <span className="min-w-0 truncate text-[15px]">{c.name}</span>
                                        <span className="shrink-0 tabular">{money(c.defaultAmount)}</span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}
            </div>

            <CustomerEditSheet
                customer={editing}
                today={today}
                onClose={() => {
                    setEditing(null)
                    if (params.get("edit")) router.replace("/manage")
                }}
                onDone={(synced) => synced && router.refresh()}
            />

            <BottomSheet open={pasteOpen} onOpenChange={setPasteOpen} title={t("importPaste")} description={t("pasteHint")}>
                <Textarea
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    rows={7}
                    placeholder={"Ram Kirana, 200, 9841234567\nराम मेडिकल, ५००"}
                    className="w-full rounded-2xl border-line bg-card p-4 text-[15px] leading-relaxed text-ink focus-visible:ring-2 focus-visible:ring-saffron"
                />
                {parsed.length > 0 && (
                    <ScrollArea orientation="vertical" className="mt-3 rounded-2xl bg-card ring-1 ring-line" viewportClassName="max-h-56">
                    <ul className="divide-y divide-line">
                        {parsed.map((p, i) => (
                            <li key={i} className="flex items-center justify-between px-4 py-2.5 text-[16px]">
                                <span className="truncate text-ink">{p.name}</span>
                                <span className={cn("font-semibold tabular", p.defaultAmount ? "text-ink" : "text-miss")}>
                                    {p.defaultAmount ? money(p.defaultAmount) : t("unsure")}
                                </span>
                            </li>
                        ))}
                    </ul>
                    </ScrollArea>
                )}
                <button
                    type="button"
                    disabled={pasteValid.length === 0 || busy}
                    onClick={savePaste}
                    className="mt-4 flex h-12 w-full items-center justify-center rounded-2xl bg-ink text-[16px] font-semibold text-paper disabled:opacity-30"
                >
                    {t("saveAll")} {pasteValid.length > 0 && `(${num(pasteValid.length)})`}
                </button>
            </BottomSheet>
        </>
    )
}

function SortableRow({
    c,
    index,
    pending,
    onEdit,
    money,
    num,
}: {
    c: CustomerRow
    index: number
    pending?: boolean
    onEdit: () => void
    money: (n: number) => string
    num: (n: number) => string
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: c.id })
    const rowCls = "flex min-w-0 flex-1 items-center gap-3 text-left"
    const inner = (
        <>
            <span className="w-7 shrink-0 text-[14px] text-ink-3 tabular">{num(index + 1)}</span>
            <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-ink">{c.name}</span>
            {pending && <CloudUpload aria-label="Waiting to sync" className="h-4 w-4 shrink-0 text-[#b07a10]" />}
            <span className="shrink-0 text-[16px] font-semibold text-ink-2 tabular">{money(c.defaultAmount)}</span>
            {!pending && <ChevronRight className="h-4 w-4 shrink-0 text-ink-3" />}
        </>
    )
    return (
        <li
            ref={setNodeRef}
            style={{ transform: CSS.Transform.toString(transform), transition }}
            className={cn(
                "flex items-center gap-2 rounded-[20px] bg-card py-2 pl-1 pr-4 ring-1 ring-line",
                isDragging && "relative z-10 shadow-xl ring-2 ring-saffron",
            )}
        >
            <span
                {...attributes}
                {...listeners}
                className="flex h-12 w-10 touch-none items-center justify-center text-ink-3 active:text-saffron"
                aria-label="Drag"
            >
                <GripVertical className="h-6 w-6" />
            </span>
            {/* A customer still waiting to sync has no page on the server yet, so it opens the edit sheet. */}
            {pending ? (
                <button type="button" onClick={onEdit} className={rowCls}>
                    {inner}
                </button>
            ) : (
                <Link href={`/customers/${c.id}`} className={rowCls}>
                    {inner}
                </Link>
            )}
        </li>
    )
}

function ActionTile({
    icon,
    label,
    onClick,
    href,
    primary,
}: {
    icon: React.ReactNode
    label: string
    onClick?: () => void
    href?: string
    primary?: boolean
}) {
    const cls = cn(
        "flex min-h-[92px] flex-col items-center justify-center gap-2 rounded-[22px] px-2 py-3 text-center text-[14px] font-semibold leading-tight",
        primary ? "bg-ink text-paper" : "bg-card text-ink ring-1 ring-line",
    )
    if (href)
        return (
            <Link href={href} className={cls}>
                {icon}
                {label}
            </Link>
        )
    return (
        <button type="button" onClick={onClick} className={cls}>
            {icon}
            {label}
        </button>
    )
}
