"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { Camera, ClipboardPaste, GripVertical, Plus } from "lucide-react"
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
import { refreshDay } from "@/lib/offline/sync"
import {
    createCustomers,
    reorderCustomers,
    setCustomerActive,
    updateCustomer,
    type CustomerInput,
    type CustomerRow,
} from "@/actions/customer.action"
import { CustomerForm } from "./customer-form"
import { Textarea } from "@repo/ui/components/ui/textarea"

export function ManageClient({ initial, today }: { initial: CustomerRow[]; today: string }) {
    const { t, money, num } = useI18n()
    const router = useRouter()
    const params = useSearchParams()
    const [items, setItems] = useState(initial)
    const [editing, setEditing] = useState<CustomerRow | "new" | null>(null)
    const [pasteOpen, setPasteOpen] = useState(false)
    const [pasteText, setPasteText] = useState("")
    const [busy, startTransition] = useTransition()

    useEffect(() => setItems(initial), [initial])

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

    const afterChange = (msg?: string) => {
        if (msg) toast.success(msg)
        void refreshDay()
        router.refresh()
    }

    const onDragEnd = (e: DragEndEvent) => {
        const { active: a, over } = e
        if (!over || a.id === over.id) return
        const from = active.findIndex((c) => c.id === a.id)
        const to = active.findIndex((c) => c.id === over.id)
        const next = arrayMove(active, from, to)
        setItems([...next, ...stopped])
        startTransition(async () => {
            await reorderCustomers(next.map((c) => c.id))
            afterChange()
        })
    }

    const save = (input: CustomerInput) =>
        startTransition(async () => {
            try {
                if (editing === "new") await createCustomers([input])
                else if (editing) await updateCustomer(editing.id, input)
                setEditing(null)
                afterChange(t("saved"))
            } catch {
                toast.error(t("somethingWrong"))
            }
        })

    const toggleActive = () =>
        startTransition(async () => {
            if (!editing || editing === "new") return
            await setCustomerActive(editing.id, !editing.isActive)
            setEditing(null)
            afterChange(t("saved"))
        })

    const parsed = useMemo(() => parseCustomerList(pasteText), [pasteText])
    const pasteValid = parsed.filter((p) => p.defaultAmount && p.defaultAmount > 0)

    const savePaste = () =>
        startTransition(async () => {
            const res = await createCustomers(
                pasteValid.map((p) => ({ name: p.name, defaultAmount: p.defaultAmount!, phone: p.phone, bankAccountNo: p.bankAccountNo, startDate: today })),
            )
            setPasteOpen(false)
            setPasteText("")
            afterChange(t("customersAdded", { count: res.count }))
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

                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                    <SortableContext items={active.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                        <ul className={cn("space-y-2", busy && "opacity-80")}>
                            {active.map((c, i) => (
                                <SortableRow key={c.id} c={c} index={i} onOpen={() => setEditing(c)} money={money} num={num} />
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
                                    <button
                                        type="button"
                                        onClick={() => setEditing(c)}
                                        className="flex w-full items-center justify-between rounded-2xl bg-paper-2 px-4 py-3 text-left text-ink-3"
                                    >
                                        <span className="truncate text-[17px]">{c.name}</span>
                                        <span className="tabular">{money(c.defaultAmount)}</span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}
            </div>

            <BottomSheet
                open={editing !== null}
                onOpenChange={(o) => {
                    if (!o) {
                        setEditing(null)
                        if (params.get("edit")) router.replace("/manage")
                    }
                }}
                title={editing === "new" ? t("addCustomer") : editing ? editing.name : ""}
            >
                {editing !== null && (
                    <CustomerForm
                        key={editing === "new" ? "new" : editing.id}
                        initial={editing === "new" ? undefined : editing}
                        today={today}
                        busy={busy}
                        onSubmit={save}
                        onToggleActive={toggleActive}
                    />
                )}
            </BottomSheet>

            <BottomSheet open={pasteOpen} onOpenChange={setPasteOpen} title={t("importPaste")} description={t("pasteHint")}>
                <Textarea
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    rows={7}
                    placeholder={"Ram Kirana, 200, 9841234567\nराम मेडिकल, ५००"}
                    className="w-full rounded-2xl border-line bg-card p-4 text-[17px] leading-relaxed text-ink focus-visible:ring-2 focus-visible:ring-saffron"
                />
                {parsed.length > 0 && (
                    <ul className="mt-3 max-h-56 divide-y divide-line overflow-auto rounded-2xl bg-card ring-1 ring-line">
                        {parsed.map((p, i) => (
                            <li key={i} className="flex items-center justify-between px-4 py-2.5 text-[16px]">
                                <span className="truncate text-ink">{p.name}</span>
                                <span className={cn("font-semibold tabular", p.defaultAmount ? "text-ink" : "text-miss")}>
                                    {p.defaultAmount ? money(p.defaultAmount) : t("unsure")}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
                <button
                    type="button"
                    disabled={pasteValid.length === 0 || busy}
                    onClick={savePaste}
                    className="mt-4 flex h-16 w-full items-center justify-center rounded-2xl bg-ink text-lg font-semibold text-paper disabled:opacity-30"
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
    onOpen,
    money,
    num,
}: {
    c: CustomerRow
    index: number
    onOpen: () => void
    money: (n: number) => string
    num: (n: number) => string
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: c.id })
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
            <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                <span className="w-7 text-[14px] text-ink-3 tabular">{num(index + 1)}</span>
                <span className="min-w-0 flex-1 truncate text-[17px] font-semibold text-ink">{c.name}</span>
                <span className="text-[16px] font-semibold text-ink-2 tabular">{money(c.defaultAmount)}</span>
            </button>
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
