import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
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
    <Card className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <Badge>{formatEpisodeCode(seasonNumber, episode.number)}</Badge>
          <p className="font-semibold text-ink">{episode.title}</p>
        </div>
        <p className="text-sm text-slate-300">{episode.overview}</p>
        <p className="text-xs text-slate-400">
          {episode.runtimeMinutes || "n/d"} min · {episode.airedOn || "n/d"}
        </p>
      </div>
      <EpisodeWatchButton episodeId={episode.id} initialWatched={episode.watched} authenticated={authenticated} />
    </Card>
  );
}
