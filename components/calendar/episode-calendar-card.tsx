import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PosterImage } from "@/components/media/poster-image";
import { EpisodeWatchButton } from "@/components/series/episode-watch-button";
import { formatShortDate } from "@/lib/calendar/dates";
import { formatEpisodeCode } from "@/lib/utils";
import type { CalendarEpisode } from "@/lib/calendar/queries";

const stateLabels: Record<string, string> = {
  WATCHING: "Assistindo",
  WANT_TO_WATCH: "Quero assistir",
  PAUSED: "Pausada",
  DROPPED: "Abandonada",
  COMPLETED: "Concluida"
};

export function EpisodeCalendarCard({
  episode,
  authenticated
}: {
  episode: CalendarEpisode;
  authenticated: boolean;
}) {
  return (
    <Card className="flex flex-col gap-4 overflow-hidden p-0 sm:flex-row sm:items-stretch">
      <div className="relative h-28 w-20 shrink-0 sm:h-auto sm:w-32">
        <PosterImage src={episode.series.posterUrl || episode.series.backdropUrl} alt={episode.series.title} sizes="128px" />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-5 sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/series/${episode.series.slug}`} className="font-semibold text-ink">
            {episode.series.title}
          </Link>
          <Badge variant="secondary">{stateLabels[episode.userState] ?? episode.userState}</Badge>
        </div>
        <p className="text-sm text-muted">
          {formatEpisodeCode(episode.seasonNumber, episode.number)} · {episode.title}
        </p>
        <p className="text-xs text-subtle">{formatShortDate(episode.airedAt)}</p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <EpisodeWatchButton episodeId={episode.id} initialWatched={episode.watched} authenticated={authenticated} size="sm" />
          <Link href={`/series/${episode.series.slug}`} className="link-accent text-sm">
            Abrir serie
          </Link>
        </div>
      </div>
    </Card>
  );
}
