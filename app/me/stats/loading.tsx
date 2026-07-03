import { Skeleton } from "@/components/ui/skeleton";

export default function StatsLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-3 w-20 rounded-full" />
        <Skeleton className="h-8 w-48 rounded-full" />
      </div>
      <Skeleton className="h-10 w-96 rounded-full" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton key={index} className="h-20 rounded-4xl" />
        ))}
      </div>
      <Skeleton className="h-56 rounded-4xl" />
    </div>
  );
}
