import { Skeleton, SkeletonCarouselRow } from "@/components/ui/skeleton";

export default function RecommendationsLoading() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-3 w-20 rounded-full" />
        <Skeleton className="h-8 w-56 rounded-full" />
      </div>
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="space-y-3">
          <Skeleton className="h-6 w-48 rounded-full" />
          <SkeletonCarouselRow />
        </div>
      ))}
    </div>
  );
}
