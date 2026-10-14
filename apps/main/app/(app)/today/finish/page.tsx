import type { Metadata } from "next"
import { FinishClient } from "@/components/today/finish-client"

export const metadata: Metadata = { title: "Finish day" }

export default function FinishPage() {
    return <FinishClient />
}
