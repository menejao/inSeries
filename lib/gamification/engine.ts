import { prisma } from "@/lib/db/prisma";
import { computeGenreStats, computeStreakStats, computeWatchTimeStats, fetchAnalyticsDataset } from "@/lib/analytics";
import { ACHIEVEMENT_DEFINITIONS } from "@/lib/gamification/achievements";
import { unlockAchievement } from "@/lib/gamification/service";
import type { AchievementEvalContext, GamificationEvent } from "@/lib/gamification/types";

/**
 * Fase 4/13 — builds only the aggregates the triggering event's category of
 * achievements needs, never the full picture every time. `EPISODE_WATCHED`
 * is the one event several different categories (count, hours, genre,
 * streak) depend on, so it reuses the Analytics Layer's single dataset
 * fetch instead of 4 separate queries — every other event is a single count.
 */
async function buildContextForEvent(event: GamificationEvent): Promise<AchievementEvalContext> {
  const base: AchievementEvalContext = {
    userId: event.userId,
    episodesWatchedCount: 0,
    hoursWatched: 0,
    genreEpisodeCounts: {},
    longestStreakDays: 0,
    seriesCompletedCount: 0,
    reviewsCount: 0,
    listsCount: 0,
    followingCount: 0
  };

  switch (event.type) {
    case "EPISODE_WATCHED": {
      const dataset = await fetchAnalyticsDataset(event.userId);
      const watchTime = computeWatchTimeStats(dataset);
      const genres = computeGenreStats(dataset.watchedEpisodes);
      const streaks = computeStreakStats(dataset.watchedEpisodes);
      return {
        ...base,
        episodesWatchedCount: dataset.watchedEpisodes.length,
        hoursWatched: watchTime.hoursWatched,
        genreEpisodeCounts: Object.fromEntries(genres.ranking.map((g) => [g.genre, g.episodeCount])),
        longestStreakDays: streaks.longestStreakDays
      };
    }
    case "SERIES_COMPLETED": {
      const seriesCompletedCount = await prisma.userSeriesStatus.count({ where: { userId: event.userId, state: "COMPLETED" } });
      return { ...base, seriesCompletedCount };
    }
    case "REVIEW_CREATED": {
      const reviewsCount = await prisma.review.count({ where: { userId: event.userId } });
      return { ...base, reviewsCount };
    }
    case "LIST_CREATED": {
      const listsCount = await prisma.list.count({ where: { userId: event.userId } });
      return { ...base, listsCount };
    }
    case "USER_FOLLOWED": {
      const followingCount = await prisma.follow.count({ where: { followerId: event.userId } });
      return { ...base, followingCount };
    }
  }
}

/** Only evaluates achievements registered for this event's type, and only the ones the user hasn't already unlocked. */
export async function evaluateEvent(event: GamificationEvent): Promise<void> {
  const candidates = ACHIEVEMENT_DEFINITIONS.filter((definition) => definition.triggers.includes(event.type));
  if (candidates.length === 0) return;

  const alreadyUnlocked = await prisma.userAchievement.findMany({
    where: { userId: event.userId, achievement: { slug: { in: candidates.map((definition) => definition.slug) } } },
    select: { achievement: { select: { slug: true } } }
  });
  const unlockedSlugs = new Set(alreadyUnlocked.map((row) => row.achievement.slug));

  const stillLocked = candidates.filter((definition) => !unlockedSlugs.has(definition.slug));
  if (stillLocked.length === 0) return;

  const context = await buildContextForEvent(event);

  for (const definition of stillLocked) {
    if (definition.isUnlocked(context)) {
      await unlockAchievement(event.userId, definition.slug);
    }
  }
}
