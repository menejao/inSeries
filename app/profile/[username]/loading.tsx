import { Skeleton, SkeletonGrid } from "@/components/ui/skeleton";

export default function ProfileLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-32 rounded-4xl" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-20 rounded-4xl" />
        ))}
      </div>
      <SkeletonGrid count={2} />
    </div>
  );
}
