import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { Series } from "@/lib/types";

export function SeriesCard({ series }: { series: Series }) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="aspect-[5/3] bg-cover bg-center" style={{ backgroundImage: `url(${series.backdropUrl})` }} />
      <div className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-lg font-semibold text-ink">{series.title}</p>
            <p className="text-sm text-slate-300">
              {series.year} · {series.status}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge>{series.platform}</Badge>
            {typeof series.voteAverage === "number" ? (
              <span className="text-xs text-slate-300">★ {series.voteAverage.toFixed(1)}</span>
            ) : null}
          </div>
        </div>
        <p className="line-clamp-3 text-sm text-slate-300">{series.overview}</p>
        <div className="flex flex-wrap gap-2">
          {series.genres.map((genre) => (
            <span key={genre} className="rounded-full bg-white/5 px-3 py-1 text-xs text-slate-200">
              {genre}
            </span>
          ))}
        </div>
        <Link href={`/series/${series.slug}`} className="text-sm font-semibold text-amber-200">
          Ver detalhes
        </Link>
      </div>
    </Card>
  );
}
