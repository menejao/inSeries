import { Skeleton, SkeletonCarouselRow } from "@/components/ui/skeleton";

/**
 * "/" resolves to either the Landing (hero + carousels) or the Dashboard (card grid)
 * depending on auth, decided inside the page — this skeleton can't know which yet, so it
 * uses a shape that reads fine for either: a big banner up top, shelves of content below.
 */
export default function HomeLoading() {
  return (
    <div className="space-y-10">
      <Skeleton className="h-[70vh] w-full rounded-4xl sm:h-[80vh]" />
      <div className="space-y-4">
        <Skeleton className="h-8 w-56 rounded-full" />
        <SkeletonCarouselRow count={6} />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-8 w-56 rounded-full" />
        <SkeletonCarouselRow count={6} />
      </div>
    </div>
  );
}
