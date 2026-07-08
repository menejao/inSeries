import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PosterImage } from "@/components/media/poster-image";
import { cn, formatEpisodeCode } from "@/lib/utils";
import type { Episode } from "@/lib/types";
import { EpisodeWatchButton } from "@/components/series/episode-watch-button";

/** Fase 5 (INSERIES-SERIES-PAGE-PREMIUM-01) — image always visible (mobile included, previously `hidden sm:block`), premium hover lift consistent with every other card in the app. */
export function EpisodeRow({
  episode,
  seasonNumber,
  authenticated = false
}: {
  episode: Episode;
  seasonNumber: number;
  authenticated?: boolean;
}) {
  return (
    <Card
      padding="sm"
      className={cn(
        "flex gap-3 transition duration-200 ease-out hover:-translate-y-1 hover:border-border-strong hover:shadow-raised sm:gap-4",
        episode.watched && "border-success/25 bg-success/[0.04]"
      )}
    >
      <div className="relative aspect-video w-24 shrink-0 overflow-hidden rounded-2xl sm:w-32">
        <PosterImage src={episode.stillUrl} alt={episode.title} sizes="128px" />
      </div>
      <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{formatEpisodeCode(seasonNumber, episode.number)}</Badge>
            <p className="font-semibold text-ink">{episode.title}</p>
            {episode.watched ? <Badge variant="success">Assistido</Badge> : null}
          </div>
          <p className="line-clamp-2 text-sm text-muted">{episode.overview || "Sinopse indisponivel."}</p>
          <p className="text-xs text-subtle">
            {episode.runtimeMinutes || "n/d"} min · {episode.airedOn || "n/d"}
          </p>
        </div>
        <EpisodeWatchButton episodeId={episode.id} initialWatched={episode.watched} authenticated={authenticated} size="sm" />
      </div>
    </Card>
  );
}
