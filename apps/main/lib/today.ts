import { toNepalDateStr } from "@repo/calendar"

/** Nepal-local calendar day, 'YYYY-MM-DD'. Same on server (UTC) and phone. */
export function nepalToday(): string {
    return toNepalDateStr()
}
