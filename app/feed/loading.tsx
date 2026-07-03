import { Skeleton, SkeletonText } from "@/components/ui/skeleton";

export default function FeedLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-3 w-24 rounded-full" />
        <Skeleton className="h-8 w-40 rounded-full" />
      </div>
      <Skeleton className="h-10 w-64 rounded-full" />
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="flex gap-3 rounded-4xl border border-border bg-surface/70 p-5">
            <Skeleton className="h-9 w-9 shrink-0 rounded-2xl" />
            <div className="flex-1">
              <SkeletonText lines={2} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
