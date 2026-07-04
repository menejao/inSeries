import { Skeleton, SkeletonPosterGrid } from "@/components/ui/skeleton";

export default function SeriesLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-3 w-20 rounded-full" />
        <Skeleton className="h-8 w-56 rounded-full" />
        <Skeleton className="h-4 w-40 rounded-full" />
      </div>
      <Skeleton className="h-32 w-full rounded-4xl sm:h-24" />
      <SkeletonPosterGrid count={10} />
    </div>
  );
}
