import Link from "next/link";
import { PosterImage } from "@/components/media/poster-image";
import { CollectionTagBadge } from "@/components/media/collection-tag-badge";
import { PosterBadge } from "@/components/media/poster-badge";
import { ProviderList } from "@/components/media/provider-badge";
import { InfoIcon, SparklesIcon } from "@/components/ui/icons";
import type { ScoredRecommendation } from "@/lib/recommendations";

/**
 * Fase 9 (INSERIES-CATALOG-INTELLIGENCE-EXPERIENCE-01) — the card now also shows the
 * Quality Score, the single highest-signal Collection Tag, and synced providers.
 * Purely visual: `recommendation.score`/`primaryReason` (the actual ranking) are
 * untouched — lib/recommendations/scoring.ts and engine.ts were not modified.
 */
export function RecommendationCard({ recommendation }: { recommendation: ScoredRecommendation }) {
  const { series, primaryReason } = recommendation;
  const primaryTag = series.collectionTags[0];

  return (
    <Link
      href={`/series/${series.slug}`}
      className="group block overflow-hidden rounded-4xl border border-border bg-surface/70 shadow-card backdrop-blur-sm transition duration-200 ease-out hover:-translate-y-1 hover:border-border-strong hover:shadow-raised"
    >
      <div className="relative aspect-[2/3] overflow-hidden">
        <PosterImage
          src={series.posterUrl}
          alt={series.title}
          sizes="(min-width: 1280px) 200px, (min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
          imageClassName="transition duration-300 ease-out group-hover:scale-105"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-canvas/90 via-canvas/10 to-transparent" />
        {typeof series.qualityScore === "number" ? (
          <div className="absolute right-2 top-2">
            <PosterBadge>
              <SparklesIcon className="h-3 w-3 text-primary-text" />
              {Math.round(series.qualityScore)}
            </PosterBadge>
          </div>
        ) : null}
        {primaryTag ? (
          <div className="absolute left-2 top-2">
            <CollectionTagBadge tag={primaryTag} overlay />
          </div>
        ) : null}
        <div className="absolute inset-x-0 bottom-0 p-3">
          <p className="line-clamp-1 text-sm font-semibold text-ink">{series.title}</p>
        </div>
      </div>
      <div className="space-y-2 p-3">
        <div className="flex items-start gap-1.5">
          <InfoIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-secondary-text" />
          <p className="line-clamp-2 text-xs text-muted">{primaryReason}</p>
        </div>
        <ProviderList providers={series.watchProviders} limit={2} />
      </div>
    </Link>
  );
}
