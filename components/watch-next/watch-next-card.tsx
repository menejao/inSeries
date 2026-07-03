import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { WatchNextMarkButton } from "@/components/watch-next/watch-next-mark-button";
import { formatShortDate } from "@/lib/calendar/dates";
import type { WatchNextItem } from "@/lib/watch-next";

/** Fase 5's literal format: "T05 | E01" or, when more episodes are pending behind it, "T05 | E01 +7". */
function formatWatchNextCode(seasonNumber: number, episodeNumber: number, pendingAfterNext: number) {
  const base = `T${String(seasonNumber).padStart(2, "0")} | E${String(episodeNumber).padStart(2, "0")}`;
  return pendingAfterNext > 0 ? `${base} +${pendingAfterNext}` : base;
}

export function WatchNextCard({ item }: { item: WatchNextItem }) {
  return (
    <Card padding="none" className="flex flex-col overflow-hidden sm:flex-row sm:items-stretch">
      <Link href={`/series/${item.series.slug}`} aria-label={`Abrir ${item.series.title}`} className="flex h-32 shrink-0 sm:h-auto sm:w-40">
        <div
          className="h-full w-1/2 bg-surface-strong bg-cover bg-center"
          style={{ backgroundImage: item.series.posterUrl ? `url(${item.series.posterUrl})` : undefined }}
        />
        <div
          className="h-full w-1/2 bg-surface-strong bg-cover bg-center"
          style={{ backgroundImage: item.episode.stillUrl ? `url(${item.episode.stillUrl})` : undefined }}
        />
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
        <p className="text-sm text-muted">{item.episode.title}</p>
        <p className="text-xs text-subtle">
          {formatShortDate(item.episode.airedAt)}
          {item.isOverdue ? " · atrasado" : ""}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <WatchNextMarkButton episodeId={item.episode.id} />
          <Link href={`/series/${item.series.slug}`} className="link-accent text-sm">
            Abrir serie
          </Link>
        </div>
      </div>
    </Card>
  );
}
