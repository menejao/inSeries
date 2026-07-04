import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PosterImage } from "@/components/media/poster-image";
import { formatEpisodeCode } from "@/lib/utils";
import type { Episode } from "@/lib/types";
import { EpisodeWatchButton } from "@/components/series/episode-watch-button";

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
      className={episode.watched ? "border-success/25 bg-success/[0.04] flex gap-4" : "flex gap-4"}
    >
      <div className="relative hidden h-20 w-32 shrink-0 overflow-hidden rounded-2xl sm:block">
        <PosterImage src={episode.stillUrl} alt={episode.title} sizes="128px" />
      </div>
      <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{formatEpisodeCode(seasonNumber, episode.number)}</Badge>
            <p className="font-semibold text-ink">{episode.title}</p>
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
