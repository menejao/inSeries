import { fetchAnalyticsDataset } from "@/lib/analytics/dataset";
import { computeOverviewStats } from "@/lib/analytics/overview";
import { computeWatchTimeStats } from "@/lib/analytics/watch-time";
import { computeGenreStats } from "@/lib/analytics/genres";
import { computeTimelineStats } from "@/lib/analytics/timeline";
import { computeStreakStats } from "@/lib/analytics/streaks";
import { generateInsights } from "@/lib/analytics/insights";
import type { UserStats } from "@/lib/analytics/types";

/**
 * The single entry point for the analytics layer: two queries (see
 * dataset.ts) followed by pure in-memory computation, reused for every
 * section of the dashboard, `GET /api/me/stats`, and — since this only
 * takes a `userId` and never touches the session — any future admin tool
 * or shareable-recap feature that needs another user's numbers (Fase 14).
 *
 * Deliberately not cached: stats read live off the same tables the
 * progress/status mutations write to, so a user who just marked an episode
 * watched sees it reflected immediately. If this ever needs a cache (e.g.
 * a public recap endpoint hit at scale), it should wrap this function with
 * a short TTL keyed by `userId` and invalidate on progress/status writes —
 * not change anything inside it.
 */
export async function getUserStats(userId: string): Promise<UserStats> {
  const dataset = await fetchAnalyticsDataset(userId);

  const overview = computeOverviewStats(dataset);
  const watchTime = computeWatchTimeStats(dataset);
  const genres = computeGenreStats(dataset.watchedEpisodes);
  const timeline = computeTimelineStats(dataset.watchedEpisodes);
  const streaks = computeStreakStats(dataset.watchedEpisodes);
  const insights = generateInsights({ overview, watchTime, genres, streaks, watchedEpisodes: dataset.watchedEpisodes });

  return {
    generatedAt: new Date().toISOString(),
    overview,
    watchTime,
    genres,
    timeline,
    streaks,
    insights
  };
}
