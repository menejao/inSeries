import { Skeleton } from "@/components/ui/skeleton";

export default function StatsLoading() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-56 rounded-4xl sm:h-48" />
      <Skeleton className="h-16 rounded-4xl" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-20 rounded-4xl" />
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton key={index} className="h-20 rounded-4xl" />
        ))}
      </div>
      <Skeleton className="h-56 rounded-4xl" />
    </div>
  );
}
