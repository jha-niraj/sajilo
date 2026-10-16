"use client"

import { useTransition } from "react"
import { toast } from "sonner"
import { BottomSheet } from "@/components/bottom-sheet"
import { CustomerForm } from "@/components/manage/customer-form"
import { useI18n } from "@/lib/i18n"
import { newOpId, queueOp } from "@/lib/offline/sync"
import type { CustomerFields } from "@/lib/offline/ops"
import type { CustomerInput, CustomerRow } from "@/actions/customer.action"

/**
 * Add a customer (`customer` = "new") or edit one, in a bottom sheet. Works offline: the change is
 * queued and synced; `onDone(synced)` tells the caller whether it already reached the server.
 */
export function CustomerEditSheet({
    customer,
    today,
    onClose,
    onDone,
}: {
    customer: CustomerRow | "new" | null
    today: string
    onClose: () => void
    onDone: (synced: boolean) => void
}) {
    const { t } = useI18n()
    const [busy, startTransition] = useTransition()

    const finish = (synced: boolean) => {
        onClose()
        toast.success(synced ? t("saved") : t("savedOffline"))
        onDone(synced)
    }

    const save = (input: CustomerInput) =>
        startTransition(async () => {
            try {
                const fields = toFields(input)
                const res =
                    customer === "new"
                        ? await queueOp({ kind: "addCustomers", customers: [{ ...fields, startDate: fields.startDate ?? today, id: newOpId() }] }, { wait: 4000 })
                        : customer
                          ? await queueOp({ kind: "editCustomer", id: customer.id, fields }, { wait: 4000 })
                          : null
                if (res) finish(res.synced)
            } catch {
                toast.error(t("somethingWrong"))
            }
        })

    const toggleActive = () =>
        startTransition(async () => {
            if (!customer || customer === "new") return
            const res = await queueOp({ kind: "customerActive", id: customer.id, isActive: !customer.isActive }, { wait: 4000 })
            finish(res.synced)
        })

    return (
        <BottomSheet
            open={customer !== null}
            onOpenChange={(o) => !o && onClose()}
            title={customer === "new" ? t("addCustomer") : customer ? customer.name : ""}
        >
            {customer !== null && (
                <CustomerForm
                    key={customer === "new" ? "new" : customer.id}
                    initial={customer === "new" ? undefined : customer}
                    today={today}
                    busy={busy}
                    onSubmit={save}
                    onToggleActive={toggleActive}
                />
            )}
        </BottomSheet>
    )
}

function toFields(input: CustomerInput): CustomerFields {
    return {
        name: input.name.trim(),
        defaultAmount: Number(input.defaultAmount),
        phone: input.phone || null,
        bankAccountNo: input.bankAccountNo || null,
        startDate: input.startDate,
        note: input.note || null,
    }
}
