export default function Loading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 w-48 rounded bg-muted" />
      <div className="grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-32 rounded-xl bg-muted" />
        ))}
      </div>
      <div className="h-64 rounded-xl bg-muted" />
    </div>
  )
}
