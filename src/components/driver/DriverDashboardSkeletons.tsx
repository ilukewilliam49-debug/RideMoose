import { Skeleton } from "@/components/ui/skeleton";

export function DashboardStatsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3">
      {[1, 2].map((i) => (
        <div key={i} className="rounded-2xl bg-card ring-1 ring-border/50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-8 w-16" />
        </div>
      ))}
    </div>
  );
}

export function DispatchCardSkeleton() {
  return (
    <div className="rounded-2xl bg-card ring-1 ring-border/50 p-4 space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-9 rounded-xl" />
        <div className="space-y-1.5 flex-1">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-40" />
        </div>
        <Skeleton className="h-5 w-16" />
      </div>
      <div className="space-y-2">
        <div className="flex items-start gap-2">
          <Skeleton className="h-2 w-2 rounded-full mt-1.5" />
          <Skeleton className="h-4 w-full" />
        </div>
        <div className="flex items-start gap-2">
          <Skeleton className="h-2 w-2 rounded-full mt-1.5" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-14 flex-1 rounded-xl" />
        <Skeleton className="h-14 w-14 rounded-xl" />
      </div>
    </div>
  );
}

export function RecentTripsSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center justify-between rounded-2xl bg-card ring-1 ring-border/50 px-4 py-3">
          <div className="flex items-center gap-3 flex-1">
            <Skeleton className="h-5 w-12 rounded" />
            <Skeleton className="h-3 w-40" />
          </div>
          <Skeleton className="h-4 w-14" />
        </div>
      ))}
    </div>
  );
}
