import type { AnalyticsDataset } from "@/lib/analytics/types";
import type { GrowthMetric, GrowthStats } from "@/lib/stats/types";

function monthKey(date: Date) {
  return date.toISOString().slice(0, 7);
}

function delta(current: number, previous: number): GrowthMetric {
  if (previous === 0) return { current, previous, deltaPercent: current > 0 ? 100 : null };
  return { current, previous, deltaPercent: Math.round(((current - previous) / previous) * 1000) / 10 };
}

/** INSERIES-STATISTICS-ENGINE-01 — "mostrar crescimento percentual... +32% comparado ao mes anterior." This month vs the previous calendar month, in UTC (same convention as the rest of lib/analytics). */
export function computeGrowthStats(dataset: AnalyticsDataset): GrowthStats {
  const now = new Date();
  const thisMonthKey = monthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)));
  const lastMonthKey = monthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)));

  let episodesThis = 0;
  let episodesLast = 0;
  let minutesThis = 0;
  let minutesLast = 0;

  for (const episode of dataset.watchedEpisodes) {
    const key = monthKey(episode.watchedAt);
    if (key === thisMonthKey) {
      episodesThis += 1;
      minutesThis += episode.runtimeMinutes ?? 0;
    } else if (key === lastMonthKey) {
      episodesLast += 1;
      minutesLast += episode.runtimeMinutes ?? 0;
    }
  }

  let completedThis = 0;
  let completedLast = 0;
  for (const status of dataset.seriesStatuses) {
    if (status.state !== "COMPLETED" || !status.completedAt) continue;
    const key = monthKey(status.completedAt);
    if (key === thisMonthKey) completedThis += 1;
    else if (key === lastMonthKey) completedLast += 1;
  }

  return {
    episodes: delta(episodesThis, episodesLast),
    hours: delta(Math.round((minutesThis / 60) * 10) / 10, Math.round((minutesLast / 60) * 10) / 10),
    seriesCompleted: delta(completedThis, completedLast)
  };
}
