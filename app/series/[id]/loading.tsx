import { Skeleton, SkeletonCarouselRow, SkeletonText } from "@/components/ui/skeleton";

export default function SeriesDetailsLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <Skeleton className="aspect-[16/7] w-full rounded-4xl" />
        <div className="flex gap-4 px-2">
          <Skeleton className="hidden h-48 w-32 shrink-0 rounded-3xl sm:block" />
          <div className="flex-1 space-y-3 pt-2">
            <Skeleton className="h-8 w-2/3 rounded-full" />
            <SkeletonText lines={2} />
          </div>
        </div>
      </div>
      <Skeleton className="h-24 rounded-4xl" />
      <section className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="space-y-4">
          <Skeleton className="h-48 rounded-4xl" />
          <Skeleton className="h-40 rounded-4xl" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-32 rounded-4xl" />
          <Skeleton className="h-32 rounded-4xl" />
        </div>
      </section>
      <SkeletonCarouselRow count={6} />
      <SkeletonCarouselRow count={4} />
    </div>
  );
}
