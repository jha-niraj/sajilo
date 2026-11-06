import { Calculator, Camera, HandCoins, Settings, Users, Wallet } from "lucide-react"
import type { DictKey } from "@/lib/dict"

/** Everything behind "More": the bottom bar's menu and the More page list the same places. */
export const MORE_LINKS: { href: string; label: DictKey; icon: typeof Users }[] = [
    { href: "/loans", label: "navLoans", icon: HandCoins },
    { href: "/manage", label: "manageTitle", icon: Users },
    { href: "/scan", label: "scanTitle", icon: Camera },
    { href: "/cash", label: "cashOnHand", icon: Wallet },
    { href: "/loans/calculator", label: "calculator", icon: Calculator },
    { href: "/settings", label: "settingsTitle", icon: Settings },
]
