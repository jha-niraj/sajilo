"use client"

// The number this phone signs in with, so login is just the PIN after the first time.
const KEY = "sajilo.account"
const LEGACY_KEY = "sajilo.lastPhone"

export interface DeviceAccount {
    phone: string
    name?: string
}

export function readDeviceAccount(): DeviceAccount | null {
    try {
        const raw = localStorage.getItem(KEY)
        if (raw) return JSON.parse(raw) as DeviceAccount
        const legacy = localStorage.getItem(LEGACY_KEY)
        return legacy ? { phone: legacy } : null
    } catch {
        return null
    }
}

export function saveDeviceAccount(account: DeviceAccount) {
    try {
        localStorage.setItem(KEY, JSON.stringify(account))
        localStorage.removeItem(LEGACY_KEY)
    } catch {
        // storage blocked; the user will just type the number again next time
    }
}

export function clearDeviceAccount() {
    try {
        localStorage.removeItem(KEY)
        localStorage.removeItem(LEGACY_KEY)
    } catch {
        // nothing stored
    }
}
