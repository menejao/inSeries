import { Skeleton } from "@/components/ui/skeleton";

export default function MeLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-3 w-20 rounded-full" />
        <Skeleton className="h-8 w-48 rounded-full" />
      </div>
      <Skeleton className="h-10 w-80 rounded-full" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-24 rounded-4xl" />
        ))}
      </div>
      <Skeleton className="h-20 rounded-4xl" />
      <Skeleton className="h-40 rounded-4xl" />
    </div>
  );
}
