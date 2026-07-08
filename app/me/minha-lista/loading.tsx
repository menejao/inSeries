import { Skeleton } from "@/components/ui/skeleton";

export default function MinhaListaLoading() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-10 w-96 rounded-full" />
      <Skeleton className="h-40 rounded-4xl" />
      <Skeleton className="h-24 rounded-4xl" />
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-32 rounded-4xl" />
        ))}
      </div>
    </div>
  );
}
