import type { Metadata } from "next"
import { fetchSettings } from "@/actions/settings.action"
import { SettingsClient } from "@/components/settings/settings-client"
import { nepalToday } from "@/lib/today"

export const metadata: Metadata = { title: "Settings" }

export default async function SettingsPage() {
    const settings = await fetchSettings()
    return <SettingsClient initial={settings} today={nepalToday()} />
}
