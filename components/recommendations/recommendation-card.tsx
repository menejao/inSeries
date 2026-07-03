import Link from "next/link";
import { InfoIcon } from "@/components/ui/icons";
import type { ScoredRecommendation } from "@/lib/recommendations";

export function RecommendationCard({ recommendation }: { recommendation: ScoredRecommendation }) {
  const { series, primaryReason } = recommendation;

  return (
    <Link
      href={`/series/${series.slug}`}
      className="group block overflow-hidden rounded-4xl border border-border bg-surface/70 shadow-card backdrop-blur-sm transition duration-200 ease-out hover:-translate-y-1 hover:border-border-strong hover:shadow-raised"
    >
      <div className="relative aspect-[2/3] overflow-hidden">
        <div
          className="h-full w-full scale-100 bg-surface-strong bg-cover bg-center transition duration-300 ease-out group-hover:scale-105"
          style={{ backgroundImage: series.posterUrl ? `url(${series.posterUrl})` : undefined }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-canvas/90 via-canvas/10 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-3">
          <p className="line-clamp-1 text-sm font-semibold text-ink">{series.title}</p>
        </div>
      </div>
      <div className="flex items-start gap-1.5 p-3">
        <InfoIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-secondary-text" />
        <p className="line-clamp-2 text-xs text-muted">{primaryReason}</p>
      </div>
    </Link>
  );
}
