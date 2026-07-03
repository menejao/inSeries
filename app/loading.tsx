import { Skeleton, SkeletonGrid } from "@/components/ui/skeleton";

export default function HomeLoading() {
  return (
    <div className="space-y-14">
      <section className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        <Skeleton className="h-72 rounded-4xl" />
        <Skeleton className="h-72 rounded-4xl" />
      </section>
      <div className="space-y-4">
        <Skeleton className="h-8 w-56 rounded-full" />
        <SkeletonGrid count={3} />
      </div>
    </div>
  );
}
