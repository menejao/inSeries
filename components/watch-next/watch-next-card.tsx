import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PosterImage } from "@/components/media/poster-image";
import { WatchNextMarkButton } from "@/components/watch-next/watch-next-mark-button";
import { formatShortDate } from "@/lib/calendar/dates";
import type { WatchNextItem } from "@/lib/watch-next";

/** Fase 5's literal format: "T05 | E01" or, when more episodes are pending behind it, "T05 | E01 +7". */
function formatWatchNextCode(seasonNumber: number, episodeNumber: number, pendingAfterNext: number) {
  const base = `T${String(seasonNumber).padStart(2, "0")} | E${String(episodeNumber).padStart(2, "0")}`;
  return pendingAfterNext > 0 ? `${base} +${pendingAfterNext}` : base;
}

export function WatchNextCard({ item }: { item: WatchNextItem }) {
  const progressPercent = Math.round((1 / item.totalPending) * 100);

  return (
    <Card padding="none" className="flex overflow-hidden">
      <Link href={`/series/${item.series.slug}`} aria-label={`Abrir ${item.series.title}`} className="relative w-24 shrink-0 sm:w-32">
        <PosterImage src={item.series.posterUrl} alt={item.series.title} sizes="128px" />
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/series/${item.series.slug}`} className="font-semibold text-ink">
            {item.series.title}
          </Link>
          {item.isPremiere && item.isNew ? (
            <Badge variant="primary">PREMIERE</Badge>
          ) : item.isNew ? (
            <Badge variant="success">NOVO</Badge>
          ) : null}
        </div>
        <p className="text-sm font-semibold text-ink">
          {formatWatchNextCode(item.episode.seasonNumber, item.episode.number, item.pendingAfterNext)}
        </p>
        <p className="line-clamp-1 text-sm text-muted">{item.episode.title}</p>
        <p className="text-xs text-subtle">
          {formatShortDate(item.episode.airedAt)}
          {item.isOverdue ? " · atrasado" : ""}
        </p>
        <div className="mt-1 space-y-1">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-strong">
            <div className="h-full rounded-full bg-primary" style={{ width: `${progressPercent}%` }} />
          </div>
          <p className="text-xs text-subtle">
            {item.pendingAfterNext > 0 ? `${item.pendingAfterNext} episodio(s) restante(s) depois deste` : "Ultimo pendente desta serie"}
          </p>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <WatchNextMarkButton episodeId={item.episode.id} />
          <Link href={`/series/${item.series.slug}`} className="link-accent text-sm">
            Abrir serie
          </Link>
        </div>
      </div>
    </Card>
  );
}
