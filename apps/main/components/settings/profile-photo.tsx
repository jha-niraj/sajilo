"use client"

import { useId, useState } from "react"
import { toast } from "sonner"
import { Camera, ImageIcon, Trash2 } from "lucide-react"
import { DotmSquare11 } from "@repo/ui/components/ui/dotm-square-11"
import { BottomSheet } from "@/components/bottom-sheet"
import { compressImage } from "@/components/scan/compress"
import { uploadProfilePhoto, removeProfilePhoto } from "@/actions/profile.action"
import { useI18n } from "@/lib/i18n"
import { isOnline } from "@/lib/offline/network"

/** Tappable round photo; falls back to initials. Opens camera / gallery / remove. */
export function ProfilePhoto({ name, initialUrl, size = 56 }: { name: string; initialUrl: string | null; size?: number }) {
    const { t } = useI18n()
    const [url, setUrl] = useState(initialUrl)
    const [broken, setBroken] = useState(false)
    const [open, setOpen] = useState(false)
    const [busy, setBusy] = useState(false)
    const cameraId = useId()
    const galleryId = useId()

    const initials = name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?"

    // The label opens the picker itself; close the sheet only after that has happened.
    const pick = (e: React.MouseEvent) => {
        if (!isOnline()) {
            e.preventDefault()
            toast.error(t("needsInternet"))
            return
        }
        setTimeout(() => setOpen(false), 0)
    }

    const pickFile = (input: HTMLInputElement) => {
        const file = input.files?.[0]
        input.value = ""
        void onFile(file)
    }

    const onFile = async (file: File | undefined) => {
        if (!file) return
        setBusy(true)
        try {
            const small = await compressImage(file, 512, 0.85)
            const fd = new FormData()
            fd.set("file", small)
            const res = await uploadProfilePhoto(fd)
            if ("error" in res) toast.error(t(res.error === "no_storage" ? "photoNoStorage" : "photoFailed"))
            else {
                setUrl(res.url)
                setBroken(false)
                toast.success(t("photoSaved"))
            }
        } catch {
            toast.error(t("photoFailed"))
        } finally {
            setBusy(false)
        }
    }

    const remove = async () => {
        if (!isOnline()) return toast.error(t("needsInternet"))
        setOpen(false)
        setBusy(true)
        try {
            await removeProfilePhoto()
            setUrl(null)
        } catch {
            toast.error(t("photoFailed"))
        } finally {
            setBusy(false)
        }
    }

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                disabled={busy}
                aria-label={t("changePhoto")}
                className="relative shrink-0 overflow-hidden rounded-full bg-saffron-soft ring-1 ring-line"
                style={{ width: size, height: size }}
            >
                {url && !broken ? (
                    // eslint-disable-next-line @next/next/no-img-element -- signed R2 link behind /api/avatar
                    <img src={url} alt="" className="h-full w-full object-cover" onError={() => setBroken(true)} />
                ) : (
                    <span className="flex h-full w-full items-center justify-center font-semibold text-saffron" style={{ fontSize: size * 0.36 }}>
                        {initials}
                    </span>
                )}
                {busy ? (
                    <span className="absolute inset-0 flex items-center justify-center bg-ink/40 text-white">
                        <DotmSquare11 size={20} dotSize={3} />
                    </span>
                ) : (
                    <span className="absolute bottom-0 right-0 flex h-5 w-5 items-center justify-center rounded-full bg-ink text-paper ring-2 ring-card">
                        <Camera className="h-3 w-3" />
                    </span>
                )}
            </button>

            {/* Opened by labels: iPhone home-screen apps ignore input.click() on a hidden input. */}
            <input id={cameraId} type="file" accept="image/*" capture="user" className="sr-only" tabIndex={-1} onChange={(e) => pickFile(e.currentTarget)} />
            <input id={galleryId} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1} onChange={(e) => pickFile(e.currentTarget)} />

            <BottomSheet open={open} onOpenChange={setOpen} title={t("profilePhoto")}>
                <div className="space-y-2">
                    <SheetAction icon={Camera} label={t("takePhoto")} htmlFor={cameraId} onClick={pick} />
                    <SheetAction icon={ImageIcon} label={t("choosePhoto")} htmlFor={galleryId} onClick={pick} />
                    {url && <SheetAction icon={Trash2} label={t("removePhoto")} onClick={() => void remove()} danger />}
                </div>
            </BottomSheet>
        </>
    )
}

function SheetAction({
    icon: Icon,
    label,
    onClick,
    htmlFor,
    danger,
}: {
    icon: typeof Camera
    label: string
    onClick: (e: React.MouseEvent) => void
    htmlFor?: string
    danger?: boolean
}) {
    const cls = `flex w-full cursor-pointer items-center gap-3 rounded-2xl bg-card px-4 py-3.5 text-left text-[15px] font-medium ring-1 ring-line active:bg-paper-2 ${danger ? "text-miss" : "text-ink"}`
    if (htmlFor) {
        return (
            <label htmlFor={htmlFor} onClick={onClick} className={cls}>
                <Icon className="h-5 w-5" />
                {label}
            </label>
        )
    }
    return (
        <button type="button" onClick={onClick} className={cls}>
            <Icon className="h-5 w-5" />
            {label}
        </button>
    )
}
