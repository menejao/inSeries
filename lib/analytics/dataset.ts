import { prisma } from "@/lib/db/prisma";
import type { AnalyticsDataset, SeriesStatusRecord, WatchedEpisodeRecord } from "@/lib/analytics/types";

/**
 * The only place in the analytics layer that touches the database. Every
 * calculator (overview, watch-time, genres, timeline, streaks) is a pure
 * function over the two arrays returned here — so computing a full
 * `UserStats` snapshot never costs more than these two queries, no matter
 * how many individual numbers get derived from them (see service.ts).
 */
export async function fetchAnalyticsDataset(userId: string): Promise<AnalyticsDataset> {
  const [user, progressRows, statusRows] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { createdAt: true } }),
    prisma.userEpisodeProgress.findMany({
      where: { userId, watched: true },
      select: {
        episodeId: true,
        watchedAt: true,
        episode: {
          select: {
            number: true,
            title: true,
            runtimeMinutes: true,
            season: {
              select: {
                id: true,
                number: true,
                episodeCount: true,
                series: { select: { id: true, title: true, genres: true } }
              }
            }
          }
        }
      },
      orderBy: { watchedAt: "asc" }
    }),
    prisma.userSeriesStatus.findMany({
      where: { userId },
      select: {
        state: true,
        completionPercent: true,
        startedAt: true,
        completedAt: true,
        lastActivityAt: true,
        series: {
          select: {
            id: true,
            title: true,
            genres: true,
            watchProviders: true,
            seasons: { select: { episodeCount: true } }
          }
        }
      }
    })
  ]);

  const watchedEpisodes: WatchedEpisodeRecord[] = progressRows
    // `watchedAt` is always set alongside `watched: true` by toggleEpisodeProgress,
    // but the type is nullable at the schema level — skip the (unexpected) edge case
    // rather than inventing a timestamp for it.
    .filter((row) => row.watchedAt !== null)
    .map((row) => ({
      episodeId: row.episodeId,
      episodeTitle: row.episode.title,
      seriesId: row.episode.season.series.id,
      seriesTitle: row.episode.season.series.title,
      seriesGenres: row.episode.season.series.genres,
      seasonId: row.episode.season.id,
      seasonNumber: row.episode.season.number,
      seasonEpisodeCount: row.episode.season.episodeCount,
      episodeNumber: row.episode.number,
      runtimeMinutes: row.episode.runtimeMinutes,
      watchedAt: row.watchedAt as Date
    }));

  const seriesStatuses: SeriesStatusRecord[] = statusRows.map((row) => ({
    seriesId: row.series.id,
    seriesTitle: row.series.title,
    seriesGenres: row.series.genres,
    seriesWatchProviders: row.series.watchProviders,
    state: row.state,
    completionPercent: row.completionPercent,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    lastActivityAt: row.lastActivityAt,
    totalEpisodes: row.series.seasons.reduce((sum, season) => sum + season.episodeCount, 0)
  }));

  return {
    userId,
    memberSince: user.createdAt,
    watchedEpisodes,
    seriesStatuses
  };
}
