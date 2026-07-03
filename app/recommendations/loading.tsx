import { Skeleton, SkeletonGrid } from "@/components/ui/skeleton";

export default function RecommendationsLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-3 w-20 rounded-full" />
        <Skeleton className="h-8 w-56 rounded-full" />
      </div>
      <SkeletonGrid count={6} />
    </div>
  );
}
