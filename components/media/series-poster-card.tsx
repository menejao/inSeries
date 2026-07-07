import Link from "next/link";
import { PosterImage } from "@/components/media/poster-image";
import { CollectionTagBadge } from "@/components/media/collection-tag-badge";
import { Badge } from "@/components/ui/badge";
import { StarIcon } from "@/components/ui/icons";
import { getStatusBadgeVariant, getStatusLabel } from "@/lib/catalog/status-labels";
import { cn } from "@/lib/utils";
import type { Series } from "@/lib/types";

export type PosterCardVariant = "default" | "rating" | "new" | "episodes" | "status" | "collection";

/**
 * Fase 3 — the poster tile every carousel (Landing shelves, Series semelhantes) uses.
 * Deliberately text-light at rest: title + year, nothing else — the poster does the selling.
 *
 * Fase 8/9 (INSERIES-LANDING-CINEMATIC-IMMERSION-01) — `variant` gives each carousel its
 * own identity (nota em destaque for "Mais Bem Avaliadas", badge NOVO for "Novidades",
 * temporadas/episódios for "Maratonas", status para "Em Exibição", "coleção completa" para
 * "Finalizadas") without duplicating the whole component per carousel. `large` widens the
 * tile for "Em Alta" ("poster grande"). Hover reveals genres — extra info without
 * permanently cluttering the tile.
 */
export function SeriesPosterCard({
  series,
  priority = false,
  variant = "default",
  large = false
}: {
  series: Series;
  priority?: boolean;
  variant?: PosterCardVariant;
  large?: boolean;
}) {
  const primaryTag = series.collectionTags[0];
  const seasonEpisodeLabel = [
    series.numberOfSeasons ? `${series.numberOfSeasons} temporada${series.numberOfSeasons === 1 ? "" : "s"}` : null,
    series.numberOfEpisodes ? `${series.numberOfEpisodes} episodios` : null
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Link href={`/series/${series.slug}`} className="group block">
      <div className="relative aspect-[2/3] overflow-hidden rounded-3xl border border-border shadow-card transition duration-300 ease-out group-hover:-translate-y-1.5 group-hover:border-border-strong group-hover:shadow-raised">
        <PosterImage
          src={series.posterUrl}
          alt={series.title}
          priority={priority}
          sizes={
            large
              ? "(min-width: 1024px) 260px, (min-width: 640px) 45vw, 55vw"
              : "(min-width: 1024px) 190px, (min-width: 640px) 33vw, 40vw"
          }
          imageClassName="transition duration-500 ease-out group-hover:scale-110"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-canvas/90 via-canvas/10 to-transparent opacity-0 transition duration-300 group-hover:opacity-100" />

        <div className="absolute left-2 top-2 flex flex-col items-start gap-1">
          {variant === "new" ? <Badge variant="danger">NOVO</Badge> : null}
          {variant === "status" ? <Badge variant={getStatusBadgeVariant(series.status)}>{getStatusLabel(series.status)}</Badge> : null}
          {variant === "collection" ? <Badge variant="secondary">Colecao completa</Badge> : null}
          {variant === "default" && primaryTag ? (
            <div className="opacity-0 transition duration-200 group-hover:opacity-100">
              <CollectionTagBadge tag={primaryTag} />
            </div>
          ) : null}
        </div>

        {typeof series.voteAverage === "number" ? (
          <div
            className={cn(
              "absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-canvas/70 font-semibold text-ink backdrop-blur",
              variant === "rating" ? "px-2.5 py-1 text-sm" : "px-2 py-0.5 text-xs"
            )}
          >
            <StarIcon className={cn("fill-current text-warning-text", variant === "rating" ? "h-3.5 w-3.5" : "h-3 w-3")} />
            {series.voteAverage.toFixed(1)}
          </div>
        ) : null}

        <div className="absolute inset-x-0 bottom-0 space-y-1 p-2.5">
          {variant === "episodes" && seasonEpisodeLabel ? (
            <p className="text-[11px] font-semibold text-ink opacity-0 transition duration-300 group-hover:opacity-100">
              {seasonEpisodeLabel}
            </p>
          ) : null}
          {series.genres.length ? (
            <div className="flex flex-wrap gap-1 opacity-0 transition duration-300 group-hover:opacity-100">
              {series.genres.slice(0, 2).map((genre) => (
                <span key={genre} className="rounded-full bg-surface-strong/80 px-2 py-0.5 text-[10px] text-ink backdrop-blur">
                  {genre}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      <p className={cn("mt-2 line-clamp-1 font-semibold text-ink", large ? "text-base" : "text-sm")}>{series.title}</p>
      <p className="text-xs text-muted">
        {series.year || "—"}
        {series.platform ? ` · ${series.platform}` : ""}
      </p>
    </Link>
  );
}
