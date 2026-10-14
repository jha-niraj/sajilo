import { fetchDeadline } from "@/actions/report.action"
import { DeadlineBanner } from "@/components/shell/deadline-banner"

export async function DeadlineSlot() {
    const info = await fetchDeadline().catch(() => null)
    return <DeadlineBanner info={info} />
}
