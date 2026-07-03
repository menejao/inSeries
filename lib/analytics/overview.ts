import type { AnalyticsDataset, OverviewStats } from "@/lib/analytics/types";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * General counts (Fase 3). Everything here is derived purely from the two
 * arrays in `AnalyticsDataset` — no extra queries.
 *
 * Methodology notes:
 * - "series tracked" = any series with a `UserSeriesStatus` row, regardless
 *   of state (including WANT_TO_WATCH).
 * - "episodes remaining" only counts series the user is actively tracking
 *   (has a status row) — episodes of series never added to any list are
 *   not counted as "pending" for anyone.
 * - "seasons completed" requires the season to have a known, non-zero
 *   `episodeCount` (denormalized on `Season`) so a season whose episodes
 *   simply haven't been synced yet is never counted as complete by
 *   vacuity (0 watched === 0 total would otherwise look "done").
 * - "average episodes per series" and "average completion %" are averaged
 *   across tracked series (statuses), not across all series in the catalog.
 */
export function computeOverviewStats(dataset: AnalyticsDataset): OverviewStats {
  const { watchedEpisodes, seriesStatuses, memberSince } = dataset;

  const seriesCompleted = seriesStatuses.filter((s) => s.state === "COMPLETED").length;
  const seriesWatching = seriesStatuses.filter((s) => s.state === "WATCHING").length;
  const seriesPaused = seriesStatuses.filter((s) => s.state === "PAUSED").length;
  const seriesDropped = seriesStatuses.filter((s) => s.state === "DROPPED").length;
  const seriesPlanned = seriesStatuses.filter((s) => s.state === "WANT_TO_WATCH").length;

  const watchedCountBySeries = new Map<string, number>();
  for (const episode of watchedEpisodes) {
    watchedCountBySeries.set(episode.seriesId, (watchedCountBySeries.get(episode.seriesId) ?? 0) + 1);
  }

  const watchedCountBySeason = new Map<string, { watched: number; total: number }>();
  for (const episode of watchedEpisodes) {
    const entry = watchedCountBySeason.get(episode.seasonId) ?? { watched: 0, total: episode.seasonEpisodeCount };
    entry.watched += 1;
    watchedCountBySeason.set(episode.seasonId, entry);
  }

  const seasonsCompleted = [...watchedCountBySeason.values()].filter(
    (season) => season.total > 0 && season.watched >= season.total
  ).length;

  const episodesRemaining = seriesStatuses.reduce((sum, status) => {
    const watched = watchedCountBySeries.get(status.seriesId) ?? 0;
    return sum + Math.max(0, status.totalEpisodes - watched);
  }, 0);

  const averageCompletionPercent = seriesStatuses.length
    ? Math.round(seriesStatuses.reduce((sum, status) => sum + status.completionPercent, 0) / seriesStatuses.length)
    : 0;

  const averageEpisodesPerSeries = seriesStatuses.length
    ? Math.round(seriesStatuses.reduce((sum, status) => sum + status.totalEpisodes, 0) / seriesStatuses.length)
    : 0;

  const daysSinceSignup = Math.max(0, Math.floor((Date.now() - memberSince.getTime()) / MS_PER_DAY));

  return {
    seriesCompleted,
    seriesWatching,
    seriesPaused,
    seriesDropped,
    seriesPlanned,
    seriesTracked: seriesStatuses.length,
    seasonsCompleted,
    episodesWatched: watchedEpisodes.length,
    episodesRemaining,
    averageCompletionPercent,
    averageEpisodesPerSeries,
    daysSinceSignup
  };
}
