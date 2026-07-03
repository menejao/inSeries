import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { StarIcon } from "@/components/ui/icons";
import { getStatusBadgeVariant, getStatusLabel } from "@/lib/catalog/status-labels";
import type { Series } from "@/lib/types";

export function SeriesCard({ series }: { series: Series }) {

  return (
    <Link
      href={`/series/${series.slug}`}
      className="group block overflow-hidden rounded-4xl border border-border bg-surface/70 shadow-card backdrop-blur-sm transition duration-200 ease-out hover:-translate-y-1 hover:border-border-strong hover:shadow-raised"
    >
      <div className="relative aspect-[5/3] overflow-hidden">
        <div
          className="h-full w-full scale-100 bg-surface-strong bg-cover bg-center transition duration-300 ease-out group-hover:scale-105"
          style={{ backgroundImage: series.backdropUrl ? `url(${series.backdropUrl})` : undefined }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-canvas/70 via-transparent to-transparent" />
        <div className="absolute left-3 top-3">
          <Badge variant={getStatusBadgeVariant(series.status)}>{getStatusLabel(series.status)}</Badge>
        </div>
        {typeof series.voteAverage === "number" ? (
          <div className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-canvas/70 px-2.5 py-1 text-xs font-semibold text-ink backdrop-blur">
            <StarIcon className="h-3.5 w-3.5 fill-current text-warning-text" />
            {series.voteAverage.toFixed(1)}
          </div>
        ) : null}
      </div>
      <div className="space-y-3 p-5">
        <div>
          <p className="line-clamp-1 text-lg font-semibold text-ink">{series.title}</p>
          <p className="text-sm text-muted">
            {series.year} · {series.platform}
          </p>
        </div>
        <p className="line-clamp-2 text-sm text-muted">{series.overview}</p>
        {series.genres.length ? (
          <div className="flex flex-wrap gap-1.5">
            {series.genres.slice(0, 3).map((genre) => (
              <span key={genre} className="rounded-full bg-surface-strong px-2.5 py-1 text-xs text-muted">
                {genre}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </Link>
  );
}
