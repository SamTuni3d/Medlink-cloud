import { Skeleton } from '@/components/ui/skeleton'

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-44 rounded-lg" />
        <Skeleton className="h-9 w-32 rounded-lg" />
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-20 rounded" />
              <Skeleton className="h-8 w-8 rounded-full" />
            </div>
            <Skeleton className="mt-3 h-8 w-28 rounded" />
            <Skeleton className="mt-2 h-3 w-16 rounded" />
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Sales chart */}
        <div className="rounded-2xl bg-white p-6 shadow-sm lg:col-span-2">
          <Skeleton className="mb-4 h-5 w-32 rounded" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>

        {/* Insights panel */}
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <Skeleton className="mb-4 h-5 w-24 rounded" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl border p-3">
                <Skeleton className="mb-2 h-4 w-28 rounded" />
                <Skeleton className="h-3 w-full rounded" />
                <Skeleton className="mt-1 h-3 w-3/4 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
