import { Skeleton, SkeletonPosterGrid } from "@/components/ui/skeleton";

export default function RecommendationsLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-3 w-20 rounded-full" />
        <Skeleton className="h-8 w-56 rounded-full" />
      </div>
      <SkeletonPosterGrid count={12} />
    </div>
  );
}
