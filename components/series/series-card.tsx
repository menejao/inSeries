import Link from "next/link";
import { PosterImage } from "@/components/media/poster-image";
import { CollectionTagBadge } from "@/components/media/collection-tag-badge";
import { ProviderList } from "@/components/media/provider-badge";
import { Badge } from "@/components/ui/badge";
import { SparklesIcon, StarIcon } from "@/components/ui/icons";
import { getStatusBadgeVariant, getStatusLabel } from "@/lib/catalog/status-labels";
import type { Series } from "@/lib/types";

/**
 * Fase 5 — poster-first catalog card: poster, nota, status, ano, plataforma, generos (no hover).
 * Sinopse foi removida do card (fica na pagina da serie).
 *
 * Fase 4/5 (INSERIES-CATALOG-INTELLIGENCE-EXPERIENCE-01) — on hover, generos dao lugar a ate
 * duas Collection Tags (sinal editorial, mais util que repetir genero) e, quando sincronizados,
 * os provedores de streaming aparecem junto — nunca os dois grupos de chip disputando espaco
 * com o genero ao mesmo tempo.
 */
export function SeriesCard({ series }: { series: Series }) {
  return (
    <Link
      href={`/series/${series.slug}`}
      className="group block overflow-hidden rounded-3xl border border-border bg-surface/70 shadow-card transition duration-200 ease-out hover:-translate-y-1 hover:border-border-strong hover:shadow-raised"
    >
      <div className="relative aspect-[2/3] overflow-hidden">
        <PosterImage
          src={series.posterUrl}
          alt={series.title}
          sizes="(min-width: 1280px) 220px, (min-width: 1024px) 22vw, (min-width: 640px) 30vw, 45vw"
          imageClassName="transition duration-300 ease-out group-hover:scale-105"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-canvas/95 via-canvas/25 to-transparent" />
        <div className="absolute left-2 top-2">
          <Badge variant={getStatusBadgeVariant(series.status)}>{getStatusLabel(series.status)}</Badge>
        </div>
        <div className="absolute right-2 top-2 flex flex-col items-end gap-1">
          {typeof series.voteAverage === "number" ? (
            <div className="inline-flex items-center gap-1 rounded-full bg-canvas/70 px-2 py-0.5 text-xs font-semibold text-ink backdrop-blur">
              <StarIcon className="h-3 w-3 fill-current text-warning-text" />
              {series.voteAverage.toFixed(1)}
            </div>
          ) : null}
          {/* Fase 10 (INSERIES-CATALOG-INTELLIGENCE-EXPERIENCE-01) — Quality Score alongside the vote average, so catalog/search results carry the same signal as the Hero/detail page. */}
          {typeof series.qualityScore === "number" ? (
            <div className="inline-flex items-center gap-1 rounded-full bg-canvas/70 px-2 py-0.5 text-xs font-semibold text-ink backdrop-blur">
              <SparklesIcon className="h-3 w-3 text-primary-text" />
              {Math.round(series.qualityScore)}
            </div>
          ) : null}
        </div>
        <div className="absolute inset-x-0 bottom-0 space-y-1.5 p-3">
          <p className="line-clamp-1 text-base font-semibold text-ink">{series.title}</p>
          <p className="text-xs text-muted">
            {series.year || "—"} · {series.platform}
          </p>
          {series.collectionTags.length ? (
            <div className="flex flex-wrap gap-1 opacity-0 transition duration-200 group-hover:opacity-100">
              {series.collectionTags.slice(0, 2).map((tag) => (
                <CollectionTagBadge key={tag} tag={tag} />
              ))}
            </div>
          ) : series.genres.length ? (
            <div className="flex flex-wrap gap-1 opacity-0 transition duration-200 group-hover:opacity-100">
              {series.genres.slice(0, 2).map((genre) => (
                <span key={genre} className="rounded-full bg-surface-strong/80 px-2 py-0.5 text-[10px] text-ink backdrop-blur">
                  {genre}
                </span>
              ))}
            </div>
          ) : null}
          {series.watchProviders.length ? (
            <ProviderList
              providers={series.watchProviders}
              limit={3}
              className="flex flex-wrap gap-1 opacity-0 transition duration-200 group-hover:opacity-100"
            />
          ) : null}
        </div>
      </div>
    </Link>
  );
}
