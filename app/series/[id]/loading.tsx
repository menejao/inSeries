import { Skeleton, SkeletonText } from "@/components/ui/skeleton";

export default function SeriesDetailsLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-80 w-full rounded-4xl" />
      <section className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <Skeleton className="h-48 rounded-4xl" />
        <div className="space-y-4">
          <Skeleton className="h-40 rounded-4xl" />
          <Skeleton className="h-40 rounded-4xl" />
        </div>
      </section>
      <SkeletonText lines={3} />
    </div>
  );
}
