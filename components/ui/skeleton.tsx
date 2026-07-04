import { cn } from "@/lib/utils";

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={cn("skeleton-shimmer animate-shimmer rounded-2xl", className)} />;
}

export function SkeletonText({ lines = 1, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)} aria-hidden="true">
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton key={index} className={cn("h-3.5 rounded-full", index === lines - 1 && lines > 1 ? "w-2/3" : "w-full")} />
      ))}
    </div>
  );
}

export function SkeletonAvatar({ className }: { className?: string }) {
  return <Skeleton className={cn("h-12 w-12 rounded-2xl", className)} />;
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-4xl border border-border bg-surface/70", className)} aria-hidden="true">
      <Skeleton className="aspect-[5/3] w-full rounded-none" />
      <div className="space-y-3 p-5">
        <Skeleton className="h-5 w-2/3 rounded-full" />
        <SkeletonText lines={2} />
        <div className="flex gap-2">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonGrid({ count = 6, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-3", className)}>
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonCard key={index} />
      ))}
    </div>
  );
}

/** Poster-shaped grid (2:3), used by catalog/recomendacoes loading states — mirrors SeriesCard/SeriesPosterCard aspect ratio. */
export function SkeletonPosterGrid({ count = 10, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5", className)}>
      {Array.from({ length: count }).map((_, index) => (
        <Skeleton key={index} className="aspect-[2/3] w-full rounded-3xl" />
      ))}
    </div>
  );
}

/** Horizontal shelf skeleton for carousel sections (Landing, Series semelhantes). */
export function SkeletonCarouselRow({ count = 6 }: { count?: number }) {
  return (
    <div className="flex gap-4 overflow-hidden" aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="w-40 shrink-0 space-y-2 sm:w-44 lg:w-48">
          <Skeleton className="aspect-[2/3] w-full rounded-3xl" />
          <Skeleton className="h-3.5 w-4/5 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2" aria-hidden="true">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex gap-4">
          {Array.from({ length: cols }).map((_, colIndex) => (
            <Skeleton key={colIndex} className={cn("h-4 flex-1 rounded-full", colIndex === 0 && "max-w-40")} />
          ))}
        </div>
      ))}
    </div>
  );
}
