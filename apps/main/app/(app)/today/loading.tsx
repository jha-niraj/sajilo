export default function Loading() {
    return (
        <div className="space-y-3 px-4 pt-16">
            <div className="h-36 animate-pulse rounded-[22px] bg-paper-2" />
            {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-[78px] animate-pulse rounded-[22px] bg-paper-2" />
            ))}
        </div>
    )
}
