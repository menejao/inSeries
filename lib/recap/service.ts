import { prisma } from "@/lib/db/prisma";
import { isFeatureEnabled } from "@/lib/config/flags";
import {
  computeGenreStats,
  computeStreakStats,
  computeTimelineStats,
  fetchAnalyticsDataset,
  getMostWatchedSeries
} from "@/lib/analytics";
import type { AnalyticsDataset, SeriesStatusRecord, WatchedEpisodeRecord } from "@/lib/analytics";
import * as monthly from "@/lib/recap/monthly";
import * as yearly from "@/lib/recap/yearly";
import { generateRecapInsights } from "@/lib/recap/insights";
import { buildRecapSharing } from "@/lib/recap/sharing";
import type { RecapAvailabilityOutcome, RecapData, RecapOutcome, RecapPeriod, RecapReviewRecord } from "@/lib/recap/types";

const TOP_REVIEWS_LIMIT = 3;

/**
 * Reviews are the one piece of data Recap needs that the Analytics Layer's
 * dataset doesn't already carry (it deliberately only covers progress/status —
 * see lib/analytics/dataset.ts). One extra query, same pattern the
 * recommendation engine used for "positively reviewed genres".
 */
async function fetchRecapReviews(userId: string): Promise<RecapReviewRecord[]> {
  const reviews = await prisma.review.findMany({
    where: { userId },
    select: { seriesId: true, rating: true, body: true, createdAt: true, series: { select: { title: true } } },
    orderBy: [{ rating: "desc" }, { createdAt: "desc" }]
  });

  return reviews.map((review) => ({
    seriesId: review.seriesId,
    seriesTitle: review.series.title,
    rating: review.rating,
    body: review.body,
    createdAt: review.createdAt
  }));
}

function composeRecapData(
  userId: string,
  period: RecapPeriod,
  label: string,
  episodes: WatchedEpisodeRecord[],
  completedStatuses: SeriesStatusRecord[],
  reviews: RecapReviewRecord[]
): RecapData {
  const genres = computeGenreStats(episodes);
  const streaks = computeStreakStats(episodes);
  const mostWatched = getMostWatchedSeries(episodes);
  const minutesWatched = episodes.reduce((sum, episode) => sum + (episode.runtimeMinutes ?? 0), 0);

  const mostRecent = episodes.length
    ? [...episodes].sort((a, b) => b.watchedAt.getTime() - a.watchedAt.getTime())[0]
    : null;

  const seriesWatched = [...new Set(episodes.map((episode) => episode.seriesTitle))];
  const seriesCompleted = completedStatuses.map((status) => status.seriesTitle);

  const insights = generateRecapInsights({
    label,
    episodesWatched: episodes.length,
    hoursWatched: Math.round((minutesWatched / 60) * 10) / 10,
    genres,
    longestStreakDays: streaks.longestStreakDays,
    seriesCompletedCount: seriesCompleted.length,
    mostWatchedSeries: mostWatched ? { seriesId: mostWatched.seriesId, seriesTitle: mostWatched.title, episodeCount: mostWatched.count } : null
  });

  return {
    period,
    label,
    episodesWatched: episodes.length,
    seriesWatchedCount: seriesWatched.length,
    seriesWatched,
    seriesCompletedCount: seriesCompleted.length,
    seriesCompleted,
    minutesWatched,
    hoursWatched: Math.round((minutesWatched / 60) * 10) / 10,
    activeDays: streaks.activeDays,
    longestStreakDays: streaks.longestStreakDays,
    genres,
    mostWatchedSeries: mostWatched ? { seriesId: mostWatched.seriesId, seriesTitle: mostWatched.title, episodeCount: mostWatched.count } : null,
    mostRecentEpisode: mostRecent
      ? {
          seriesId: mostRecent.seriesId,
          seriesTitle: mostRecent.seriesTitle,
          seasonNumber: mostRecent.seasonNumber,
          episodeNumber: mostRecent.episodeNumber,
          episodeTitle: mostRecent.episodeTitle,
          watchedAt: mostRecent.watchedAt.toISOString()
        }
      : null,
    topReviews: reviews.slice(0, TOP_REVIEWS_LIMIT).map((review) => ({ ...review, createdAt: review.createdAt.toISOString() })),
    insights,
    sharing: buildRecapSharing(userId, period.year, period.month),
    generatedAt: new Date().toISOString()
  };
}

async function loadRecapSources(userId: string): Promise<{ dataset: AnalyticsDataset; reviews: RecapReviewRecord[] }> {
  const [dataset, reviews] = await Promise.all([fetchAnalyticsDataset(userId), fetchRecapReviews(userId)]);
  return { dataset, reviews };
}

export async function getMonthlyRecap(userId: string, year: number, month: number): Promise<RecapOutcome> {
  if (!isFeatureEnabled("recap")) return { ok: false, enabled: false };
  if (!monthly.isValidYearNumber(year)) return { ok: false, enabled: true, error: "invalid_year" };
  if (!monthly.isValidMonthNumber(month)) return { ok: false, enabled: true, error: "invalid_month" };
  if (monthly.isFutureMonth(year, month)) return { ok: false, enabled: true, error: "future_period" };

  const { dataset, reviews } = await loadRecapSources(userId);
  const episodes = monthly.sliceEpisodesForMonth(dataset.watchedEpisodes, year, month);
  const completed = monthly.sliceStatusesCompletedInMonth(dataset.seriesStatuses, year, month);
  const periodReviews = monthly.sliceReviewsForMonth(reviews, year, month);
  const label = monthly.getMonthlyPeriodLabel(year, month);

  return { ok: true, enabled: true, data: composeRecapData(userId, { year, month }, label, episodes, completed, periodReviews) };
}

export async function getYearlyRecap(userId: string, year: number): Promise<RecapOutcome> {
  if (!isFeatureEnabled("recap")) return { ok: false, enabled: false };
  if (!yearly.isValidYearNumber(year)) return { ok: false, enabled: true, error: "invalid_year" };
  if (yearly.isFutureYear(year)) return { ok: false, enabled: true, error: "future_period" };

  const { dataset, reviews } = await loadRecapSources(userId);
  const episodes = yearly.sliceEpisodesForYear(dataset.watchedEpisodes, year);
  const completed = yearly.sliceStatusesCompletedInYear(dataset.seriesStatuses, year);
  const periodReviews = yearly.sliceReviewsForYear(reviews, year);
  const label = yearly.getYearlyPeriodLabel(year);

  return { ok: true, enabled: true, data: composeRecapData(userId, { year, month: null }, label, episodes, completed, periodReviews) };
}

/**
 * Drives the `/me/recap` index: which years/months actually have watched
 * episodes, without building a full `RecapData` for each one. Reuses the
 * Analytics Layer's timeline buckets (already computed for `/me/stats`)
 * instead of re-deriving distinct periods some other way.
 */
export async function listAvailableRecaps(userId: string): Promise<RecapAvailabilityOutcome> {
  if (!isFeatureEnabled("recap")) return { enabled: false, availability: null };

  const dataset = await fetchAnalyticsDataset(userId);
  const timeline = computeTimelineStats(dataset.watchedEpisodes);

  const months = timeline.perMonth
    .map((bucket) => {
      const [yearPart, monthPart] = bucket.key.split("-").map(Number);
      return { year: yearPart, month: monthPart, label: monthly.getMonthlyPeriodLabel(yearPart, monthPart), episodesWatched: bucket.count };
    })
    .sort((a, b) => (a.year === b.year ? b.month - a.month : b.year - a.year));

  const years = timeline.perYear
    .map((bucket) => {
      const year = Number(bucket.key);
      return { year, month: null, label: yearly.getYearlyPeriodLabel(year), episodesWatched: bucket.count };
    })
    .sort((a, b) => b.year - a.year);

  return { enabled: true, availability: { years, months } };
}
