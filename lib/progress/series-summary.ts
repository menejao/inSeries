import { prisma } from "@/lib/db/prisma";

export type SeriesProgressSummary = {
  totalEpisodes: number;
  watchedEpisodes: number;
  percentage: number;
  lastWatchedEpisode: { seasonNumber: number; number: number; title: string; watchedAt: Date } | null;
  completedSeasonNumbers: number[];
};

/**
 * Fase 25 (INSERIES-CATALOG-SERIES-EXPERIENCE-01) — aggregate version of the progress the
 * series detail page's "Resumo"/timeline sections need, WITHOUT loading every episode of
 * every season (that's what `calculateSeriesProgress`, used elsewhere in the app, still does
 * — left untouched since other callers rely on its exact shape). Every query here is bounded
 * by how much the user has actually watched, never by the catalog's total episode count — the
 * fix for the same class of problem the Calendar ticket's Tagesschau finding documented (a
 * series with an unrealistic episode count no longer means an unrealistic query here).
 */
export async function getSeriesProgressSummary(
  userId: string,
  seriesId: string,
  seasons: Array<{ number: number; episodeCount: number }>
): Promise<SeriesProgressSummary> {
  const now = new Date();

  const [watchedEpisodes, lastWatchedRow, watchedPerSeason, airedPerSeason] = await Promise.all([
    prisma.userEpisodeProgress.count({ where: { userId, watched: true, episode: { season: { seriesId } } } }),
    prisma.userEpisodeProgress.findFirst({
      where: { userId, watched: true, episode: { season: { seriesId } } },
      orderBy: { watchedAt: "desc" },
      select: { watchedAt: true, episode: { select: { number: true, title: true, season: { select: { number: true } } } } }
    }),
    prisma.userEpisodeProgress.findMany({
      where: { userId, watched: true, episode: { season: { seriesId } } },
      select: { episode: { select: { season: { select: { number: true } } } } }
    }),
    prisma.episode.findMany({
      where: {
        season: { seriesId },
        OR: [{ airedAt: null }, { airedAt: { lte: now } }]
      },
      select: { seasonId: true, season: { select: { number: true } } }
    })
  ]);

  const watchedCountBySeason = new Map<number, number>();
  for (const row of watchedPerSeason) {
    const seasonNumber = row.episode.season.number;
    watchedCountBySeason.set(seasonNumber, (watchedCountBySeason.get(seasonNumber) ?? 0) + 1);
  }

  const airedCountBySeason = new Map<number, number>();
  for (const row of airedPerSeason) {
    const seasonNumber = row.season.number;
    airedCountBySeason.set(seasonNumber, (airedCountBySeason.get(seasonNumber) ?? 0) + 1);
  }

  const totalEpisodes = [...airedCountBySeason.values()].reduce((sum, c) => sum + c, 0);

  const completedSeasonNumbers = seasons
    .filter((season) => {
      const aired = airedCountBySeason.get(season.number) ?? 0;
      return aired > 0 && (watchedCountBySeason.get(season.number) ?? 0) === aired;
    })
    .map((season) => season.number);

  return {
    totalEpisodes,
    watchedEpisodes,
    percentage: totalEpisodes ? Math.round((watchedEpisodes / totalEpisodes) * 100) : 0,
    lastWatchedEpisode: lastWatchedRow
      ? {
          seasonNumber: lastWatchedRow.episode.season.number,
          number: lastWatchedRow.episode.number,
          title: lastWatchedRow.episode.title,
          watchedAt: lastWatchedRow.watchedAt as Date
        }
      : null,
    completedSeasonNumbers
  };
}
