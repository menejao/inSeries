import Link from "next/link";
import { PosterImage } from "@/components/media/poster-image";
import { PosterBadge } from "@/components/media/poster-badge";
import { StarIcon, HeartIcon } from "@/components/ui/icons";
import { getStatusBadgeVariant, getStatusLabel } from "@/lib/catalog/status-labels";
import { WATCH_STATE_LABELS } from "@/lib/progress/labels";
import { SeriesCardActions } from "@/components/series/series-card-actions";
import type { Series } from "@/lib/types";

const WATCH_STATE_BADGE_CLASSES: Record<string, string> = {
  WANT_TO_WATCH: "bg-info/20 text-info-text",
  WATCHING: "bg-success/20 text-success-text",
  PAUSED: "bg-warning/20 text-warning-text",
  DROPPED: "bg-error/20 text-error-text",
  COMPLETED: "bg-primary/20 text-primary-text"
};

/**
 * Fase 8 (INSERIES-CATALOG-SERIES-EXPERIENCE-V2) — card reduzido ao minimo exigido: poster,
 * titulo, ano, nota, status, sempre visiveis. No hover: so sinopse curta + "Abrir". Removidos
 * (excesso visual, fora da lista da Fase 8): Quality Score, Collection Tags/generos e
 * provedores de streaming no card — essas informacoes continuam disponiveis na pagina da
 * serie, que e onde o usuario decide "assistir onde".
 */
export function SeriesCard({ series, showQuickActions = false }: { series: Series; showQuickActions?: boolean }) {
  return (
    <div className="group relative overflow-hidden rounded-3xl border border-border bg-surface/70 shadow-card transition duration-200 ease-out hover:-translate-y-1 hover:border-border-strong hover:shadow-raised">
      <Link href={`/series/${series.slug}`} className="block">
        <div className="relative aspect-[2/3] overflow-hidden">
          <PosterImage
            src={series.posterUrl}
            alt={series.title}
            sizes="(min-width: 1280px) 220px, (min-width: 1024px) 22vw, (min-width: 640px) 30vw, 45vw"
            imageClassName="transition duration-300 ease-out group-hover:scale-105"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-canvas/95 via-canvas/25 to-transparent" />
          <div className="absolute left-2 top-2">
            <PosterBadge variant={getStatusBadgeVariant(series.status)}>{getStatusLabel(series.status)}</PosterBadge>
          </div>
          {!showQuickActions && typeof series.voteAverage === "number" ? (
            <div className="absolute right-2 top-2">
              <PosterBadge>
                <StarIcon className="h-3 w-3 fill-current text-warning-text" />
                {series.voteAverage.toFixed(1)}
              </PosterBadge>
            </div>
          ) : null}
          <div className="absolute inset-x-0 bottom-0 space-y-1.5 p-3">
            <p className="line-clamp-1 text-base font-semibold text-ink">{series.title}</p>
            <div className="flex items-center gap-2">
              <p className="text-xs text-muted">{series.year || "—"}</p>
              {showQuickActions && typeof series.voteAverage === "number" ? (
                <span className="flex items-center gap-0.5 text-xs text-muted">
                  <StarIcon className="h-3 w-3 fill-current text-warning-text" />
                  {series.voteAverage.toFixed(1)}
                </span>
              ) : null}
            </div>
            {series.userState ? (
              <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${WATCH_STATE_BADGE_CLASSES[series.userState] ?? ""}`}>
                {WATCH_STATE_LABELS[series.userState]}
              </span>
            ) : null}
            <div className="hidden opacity-0 transition duration-200 group-hover:opacity-100 sm:block">
              <p className="line-clamp-2 text-xs text-ink/85">{series.overview}</p>
              <span className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-primary-text">Abrir</span>
            </div>
          </div>
        </div>
      </Link>
      {showQuickActions ? (
        <div className="absolute right-2 top-2 z-10">
          <SeriesCardActions seriesId={series.id} initialState={series.userState} initialFavorite={series.isFavorite} />
        </div>
      ) : null}
      {series.isFavorite && !showQuickActions ? (
        <div className="absolute right-2 top-2">
          <HeartIcon className="h-4 w-4 fill-current text-error-text drop-shadow" />
        </div>
      ) : null}
    </div>
  );
}
