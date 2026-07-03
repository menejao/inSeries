import type {
  MonthlyRecapData,
  TimelineBucket,
  TimelineStats,
  WatchedEpisodeRecord,
  YearlyRecapData
} from "@/lib/analytics/types";
import { computeGenreStats } from "@/lib/analytics/genres";

/**
 * All date bucketing here uses UTC, not the server's local timezone or the
 * viewer's — `watchedAt` is stored as an absolute instant, and bucketing it
 * consistently in UTC means the same watch history always produces the same
 * buckets regardless of where the app happens to be running. Documented in
 * the README; a future per-user timezone preference would slot in here.
 */
function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function monthKey(date: Date) {
  return date.toISOString().slice(0, 7);
}

function yearKey(date: Date) {
  return String(date.getUTCFullYear());
}

/** ISO 8601 week number, e.g. "2026-W27". */
function weekKey(date: Date) {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNumber = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNumber);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil(((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${target.getUTCFullYear()}-W${String(weekNumber).padStart(2, "0")}`;
}

function bucketBy(episodes: WatchedEpisodeRecord[], keyFn: (date: Date) => string): TimelineBucket[] {
  const counts = new Map<string, number>();
  for (const episode of episodes) {
    const key = keyFn(episode.watchedAt);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => a.key.localeCompare(b.key));
}

export function computeTimelineStats(watchedEpisodes: WatchedEpisodeRecord[]): TimelineStats {
  return {
    perDay: bucketBy(watchedEpisodes, dayKey),
    perWeek: bucketBy(watchedEpisodes, weekKey),
    perMonth: bucketBy(watchedEpisodes, monthKey),
    perYear: bucketBy(watchedEpisodes, yearKey)
  };
}

/**
 * Prepared for a future "Monthly Recap" feature (Fase 5) — deliberately not
 * wired to any UI or auto-generation yet, just a reusable, testable shape.
 */
export function getMonthlyRecapData(watchedEpisodes: WatchedEpisodeRecord[], year: number, month: number): MonthlyRecapData {
  const inMonth = watchedEpisodes.filter(
    (episode) => episode.watchedAt.getUTCFullYear() === year && episode.watchedAt.getUTCMonth() + 1 === month
  );

  const minutesWatched = inMonth.reduce((sum, episode) => sum + (episode.runtimeMinutes ?? 0), 0);
  const seriesCompleted = [...new Set(inMonth.map((episode) => episode.seriesTitle))];

  return {
    year,
    month,
    episodesWatched: inMonth.length,
    minutesWatched,
    topGenre: computeGenreStats(inMonth).topGenre,
    seriesCompleted
  };
}

/** Prepared for a future "Yearly Recap" feature (Fase 5) — same status as getMonthlyRecapData. */
export function getYearlyRecapData(watchedEpisodes: WatchedEpisodeRecord[], year: number): YearlyRecapData {
  const inYear = watchedEpisodes.filter((episode) => episode.watchedAt.getUTCFullYear() === year);
  const minutesWatched = inYear.reduce((sum, episode) => sum + (episode.runtimeMinutes ?? 0), 0);
  const activeDays = new Set(inYear.map((episode) => dayKey(episode.watchedAt))).size;

  return {
    year,
    episodesWatched: inYear.length,
    minutesWatched,
    topGenre: computeGenreStats(inYear).topGenre,
    seriesCompleted: [...new Set(inYear.map((episode) => episode.seriesTitle))],
    activeDays
  };
}
