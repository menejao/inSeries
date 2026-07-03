import type { AnalyticsDataset, WatchTimeStats } from "@/lib/analytics/types";

/**
 * Watched-time stats (Fase 4). `Episode.runtimeMinutes` is nullable — when
 * it's missing we **exclude** that episode from every time-based number
 * rather than substituting an invented duration (e.g. "assume 42min").
 * `episodesWithoutRuntime` reports how many episodes were excluded so the
 * UI can be honest about the number being a lower bound.
 *
 * "Average minutes per series" is averaged over the distinct series that
 * contributed at least one minute of runtime — series watched entirely
 * without known runtimes don't participate and don't get counted as zero.
 */
export function computeWatchTimeStats(dataset: AnalyticsDataset): WatchTimeStats {
  const { watchedEpisodes } = dataset;

  const withRuntime = watchedEpisodes.filter(
    (episode): episode is typeof episode & { runtimeMinutes: number } => typeof episode.runtimeMinutes === "number"
  );

  const minutesWatched = withRuntime.reduce((sum, episode) => sum + episode.runtimeMinutes, 0);
  const minutesBySeries = new Map<string, number>();
  for (const episode of withRuntime) {
    minutesBySeries.set(episode.seriesId, (minutesBySeries.get(episode.seriesId) ?? 0) + episode.runtimeMinutes);
  }

  const averageMinutesPerEpisode = withRuntime.length ? Math.round(minutesWatched / withRuntime.length) : null;
  const averageMinutesPerSeries = minutesBySeries.size
    ? Math.round(minutesWatched / minutesBySeries.size)
    : null;

  return {
    minutesWatched,
    hoursWatched: Math.round((minutesWatched / 60) * 10) / 10,
    daysWatched: Math.round((minutesWatched / 60 / 24) * 100) / 100,
    averageMinutesPerEpisode,
    averageMinutesPerSeries,
    episodesWithoutRuntime: watchedEpisodes.length - withRuntime.length
  };
}
