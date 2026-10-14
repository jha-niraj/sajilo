export default function Loading() {
    return (
        <div className="space-y-4 px-4 pt-20">
            <div className="grid grid-cols-2 gap-2.5">
                <div className="h-24 animate-pulse rounded-[22px] bg-paper-2" />
                <div className="h-24 animate-pulse rounded-[22px] bg-paper-2" />
            </div>
            <div className="h-80 animate-pulse rounded-[24px] bg-paper-2" />
        </div>
    )
}
