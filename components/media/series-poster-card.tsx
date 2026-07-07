import Link from "next/link";
import { PosterImage } from "@/components/media/poster-image";
import { CollectionTagBadge } from "@/components/media/collection-tag-badge";
import { StarIcon } from "@/components/ui/icons";
import type { Series } from "@/lib/types";

/**
 * Fase 3 — the poster tile every carousel (Landing shelves, Series semelhantes) uses.
 * Deliberately text-light: title + year, nothing else — the poster does the selling.
 *
 * Fase 4 (INSERIES-CATALOG-INTELLIGENCE-EXPERIENCE-01) — the single highest-signal
 * Collection Tag appears on hover (not always-on, to keep the tile as text-light as
 * before at rest) — never more than one, so the tile never gets noisy.
 */
export function SeriesPosterCard({ series, priority = false }: { series: Series; priority?: boolean }) {
  const primaryTag = series.collectionTags[0];

  return (
    <Link href={`/series/${series.slug}`} className="group block">
      <div className="relative aspect-[2/3] overflow-hidden rounded-3xl border border-border shadow-card transition duration-200 ease-out group-hover:-translate-y-1 group-hover:border-border-strong group-hover:shadow-raised">
        <PosterImage
          src={series.posterUrl}
          alt={series.title}
          priority={priority}
          sizes="(min-width: 1024px) 190px, (min-width: 640px) 33vw, 40vw"
          imageClassName="transition duration-300 ease-out group-hover:scale-105"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-canvas/80 via-transparent to-transparent opacity-0 transition duration-200 group-hover:opacity-100" />
        {typeof series.voteAverage === "number" ? (
          <div className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-canvas/70 px-2 py-0.5 text-xs font-semibold text-ink backdrop-blur">
            <StarIcon className="h-3 w-3 fill-current text-warning-text" />
            {series.voteAverage.toFixed(1)}
          </div>
        ) : null}
        {primaryTag ? (
          <div className="absolute left-2 top-2 opacity-0 transition duration-200 group-hover:opacity-100">
            <CollectionTagBadge tag={primaryTag} />
          </div>
        ) : null}
      </div>
      <p className="mt-2 line-clamp-1 text-sm font-semibold text-ink">{series.title}</p>
      <p className="text-xs text-muted">{series.year || "—"}</p>
    </Link>
  );
}
