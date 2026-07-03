import { Skeleton, SkeletonGrid } from "@/components/ui/skeleton";

export default function ListsLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-40 rounded-full" />
      <SkeletonGrid count={4} />
    </div>
  );
}
