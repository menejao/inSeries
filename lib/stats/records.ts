import type { AnalyticsDataset, WatchedEpisodeRecord } from "@/lib/analytics/types";
import type { FunRecords } from "@/lib/stats/types";

const WEEKDAY_LABELS = ["Domingo", "Segunda", "Terca", "Quarta", "Quinta", "Sexta", "Sabado"];
// A new "session" starts whenever the gap since the previous episode exceeds this — no
// session concept exists anywhere else in the app, so this is a deliberate, documented
// heuristic (not derived from any persisted field).
const SESSION_GAP_MINUTES = 180;

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

/** INSERIES-STATISTICS-ENGINE-01 — the "estatisticas divertidas" the ticket lists (binge day, favorite hour/weekday, session size, speed records). */
export function computeFunRecords(dataset: AnalyticsDataset): FunRecords {
  const episodes = dataset.watchedEpisodes;

  if (episodes.length === 0) {
    return {
      biggestBingeDay: null,
      favoriteHour: null,
      favoriteWeekday: null,
      averageEpisodesPerSession: null,
      longestSeriesCompleted: null,
      fastestCompletion: null,
      longestTracked: null,
      lateNightEpisodes: 0
    };
  }

  const byDay = new Map<string, number>();
  const byHour = new Map<number, number>();
  const byWeekday = new Map<number, number>();
  let lateNightEpisodes = 0;

  for (const episode of episodes) {
    const key = dayKey(episode.watchedAt);
    byDay.set(key, (byDay.get(key) ?? 0) + 1);

    const hour = episode.watchedAt.getUTCHours();
    byHour.set(hour, (byHour.get(hour) ?? 0) + 1);
    if (hour >= 0 && hour < 5) lateNightEpisodes += 1;

    const weekday = episode.watchedAt.getUTCDay();
    byWeekday.set(weekday, (byWeekday.get(weekday) ?? 0) + 1);
  }

  const biggestDayEntry = [...byDay.entries()].sort((a, b) => b[1] - a[1])[0];
  const favoriteHourEntry = [...byHour.entries()].sort((a, b) => b[1] - a[1])[0];
  const favoriteWeekdayEntry = [...byWeekday.entries()].sort((a, b) => b[1] - a[1])[0];

  // Sessions: sort by watchedAt, split whenever the gap exceeds SESSION_GAP_MINUTES.
  const sorted = [...episodes].sort((a, b) => a.watchedAt.getTime() - b.watchedAt.getTime());
  const sessionSizes: number[] = [];
  let currentSize = 1;
  for (let i = 1; i < sorted.length; i++) {
    const gapMinutes = (sorted[i].watchedAt.getTime() - sorted[i - 1].watchedAt.getTime()) / 60000;
    if (gapMinutes > SESSION_GAP_MINUTES) {
      sessionSizes.push(currentSize);
      currentSize = 1;
    } else {
      currentSize += 1;
    }
  }
  sessionSizes.push(currentSize);
  const averageEpisodesPerSession = Math.round((sessionSizes.reduce((sum, size) => sum + size, 0) / sessionSizes.length) * 10) / 10;

  const longestSeriesCompleted = findLongestSeriesCompleted(dataset);
  const fastestCompletion = findFastestCompletion(dataset);
  const longestTracked = findLongestTracked(dataset);

  return {
    biggestBingeDay: biggestDayEntry ? { date: biggestDayEntry[0], episodeCount: biggestDayEntry[1] } : null,
    favoriteHour: favoriteHourEntry
      ? { hour: favoriteHourEntry[0], label: `${String(favoriteHourEntry[0]).padStart(2, "0")}h`, episodeCount: favoriteHourEntry[1] }
      : null,
    favoriteWeekday: favoriteWeekdayEntry
      ? { weekday: favoriteWeekdayEntry[0], label: WEEKDAY_LABELS[favoriteWeekdayEntry[0]], episodeCount: favoriteWeekdayEntry[1] }
      : null,
    averageEpisodesPerSession,
    longestSeriesCompleted,
    fastestCompletion,
    longestTracked,
    lateNightEpisodes
  };
}

function episodeCountBySeries(episodes: WatchedEpisodeRecord[]) {
  const counts = new Map<string, number>();
  for (const episode of episodes) counts.set(episode.seriesId, (counts.get(episode.seriesId) ?? 0) + 1);
  return counts;
}

function findLongestSeriesCompleted(dataset: AnalyticsDataset): FunRecords["longestSeriesCompleted"] {
  const counts = episodeCountBySeries(dataset.watchedEpisodes);
  const completed = dataset.seriesStatuses.filter((s) => s.state === "COMPLETED");
  let best: { title: string; episodeCount: number } | null = null;
  for (const status of completed) {
    const episodeCount = counts.get(status.seriesId) ?? status.totalEpisodes;
    if (!best || episodeCount > best.episodeCount) best = { title: status.seriesTitle, episodeCount };
  }
  return best;
}

function findFastestCompletion(dataset: AnalyticsDataset): FunRecords["fastestCompletion"] {
  let best: { title: string; days: number } | null = null;
  for (const status of dataset.seriesStatuses) {
    if (status.state !== "COMPLETED" || !status.startedAt || !status.completedAt) continue;
    const days = Math.max(1, Math.round((status.completedAt.getTime() - status.startedAt.getTime()) / 86400000));
    if (!best || days < best.days) best = { title: status.seriesTitle, days };
  }
  return best;
}

function findLongestTracked(dataset: AnalyticsDataset): FunRecords["longestTracked"] {
  const now = Date.now();
  let best: { title: string; days: number } | null = null;
  for (const status of dataset.seriesStatuses) {
    const days = Math.round((now - status.addedAt.getTime()) / 86400000);
    if (!best || days > best.days) best = { title: status.seriesTitle, days };
  }
  return best;
}
