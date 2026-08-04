export default function DutySessionsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="h-7 w-44 rounded-md bg-muted animate-pulse" />
          <div className="h-4 w-56 rounded-md bg-muted animate-pulse" />
        </div>
        <div className="h-9 w-32 rounded-md bg-muted animate-pulse" />
      </div>

      <div className="h-24 rounded-xl bg-muted animate-pulse" />

      <div className="space-y-2">
        <div className="h-4 w-32 rounded-md bg-muted animate-pulse" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />
        ))}
      </div>

      <div className="space-y-2">
        <div className="h-4 w-24 rounded-md bg-muted animate-pulse" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 rounded-xl bg-muted animate-pulse" />
        ))}
      </div>
    </div>
  )
}
