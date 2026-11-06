import "server-only"
import { getCustomerDef, getMonthTotalDef, getTodayStatusDef } from "./collection/collection-reads"
import { addCustomerDef, markPaymentDef } from "./collection/collection-writes"
import { getCashInHandDef, getLoanDef, getLoansDef } from "./lending/lending-reads"
import { addLoanDef, addRepaymentDef } from "./lending/lending-writes"
import { getRechargeDef } from "./recharge/recharge-reads"
import { rechargeBuyDef, rechargeCountDef, rechargePaidBackDef, rechargeSellDef } from "./recharge/recharge-writes"
import type { BuiltTool, MunshiToolContext, MunshiToolDef, MunshiWriteDef } from "./types"

/** Every Munshi tool. Add new ones here; the prompt's capability list is derived from this. */
export const MUNSHI_TOOLS: MunshiToolDef[] = [
    getTodayStatusDef,
    getCustomerDef,
    getMonthTotalDef,
    getLoansDef,
    getLoanDef,
    getCashInHandDef,
    markPaymentDef,
    addCustomerDef,
    addLoanDef,
    addRepaymentDef,
    getRechargeDef,
    rechargeSellDef,
    rechargeBuyDef,
    rechargeCountDef,
    rechargePaidBackDef,
]

export const WRITE_DEFS = MUNSHI_TOOLS.filter((d): d is MunshiWriteDef => d.isWrite)

export function buildTools(ctx: MunshiToolContext): Record<string, BuiltTool> {
    return Object.fromEntries(MUNSHI_TOOLS.map((d) => [d.name, d.build(ctx)]))
}

export function capabilityList(): string {
    return MUNSHI_TOOLS.map((d) => `- ${d.capability}${d.isWrite ? " (needs his confirmation)" : ""}`).join("\n")
}
