import { prisma } from "@/lib/db/prisma";
import { computeGenreStats, computeStreakStats, computeWatchTimeStats, fetchAnalyticsDataset } from "@/lib/analytics";
import type { AchievementEvalContext } from "@/lib/gamification/types";

/**
 * INSERIES-ACHIEVEMENTS-REDESIGN-01 — every aggregate at once, for the Conquistas page's
 * progress bars ("18/50 series", "82/100 episodios" on every locked achievement, not just
 * the one that just triggered). More expensive than engine.ts's per-event
 * `buildContextForEvent`, but only ever called once per page load, not per mutation. Kept in
 * its own module (not engine.ts) so `service.ts` can import it without a circular dependency
 * (engine.ts already imports `unlockAchievement` from service.ts).
 */
export async function buildFullContext(userId: string): Promise<AchievementEvalContext> {
  const [dataset, seriesCompletedCount, reviewsCount, listsCount, followingCount] = await Promise.all([
    fetchAnalyticsDataset(userId),
    prisma.userSeriesStatus.count({ where: { userId, state: "COMPLETED" } }),
    prisma.review.count({ where: { userId } }),
    prisma.list.count({ where: { userId } }),
    prisma.follow.count({ where: { followerId: userId } })
  ]);

  const watchTime = computeWatchTimeStats(dataset);
  const genres = computeGenreStats(dataset.watchedEpisodes);
  const streaks = computeStreakStats(dataset.watchedEpisodes);

  return {
    userId,
    episodesWatchedCount: dataset.watchedEpisodes.length,
    hoursWatched: watchTime.hoursWatched,
    genreEpisodeCounts: Object.fromEntries(genres.ranking.map((g) => [g.genre, g.episodeCount])),
    longestStreakDays: streaks.longestStreakDays,
    seriesCompletedCount,
    reviewsCount,
    listsCount,
    followingCount
  };
}
