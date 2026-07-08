import type { UserStats } from "@/lib/analytics";

/**
 * Fase 3/9 (INSERIES-MY-LISTS-PREMIUM-01) — pure arithmetic over the numbers `getUserStats`
 * already computes (lib/analytics), never a new query. "Tempo restante" and "status
 * predominante" are the only two numbers this ticket needs that don't already exist as a
 * named field on `UserStats` — both are trivial compositions of existing fields.
 */
export function estimateRemainingHours(stats: UserStats): number {
  const averageMinutes = stats.watchTime.averageMinutesPerEpisode ?? 42;
  return Math.round((stats.overview.episodesRemaining * averageMinutes) / 60);
}

export function predominantStatusLabel(stats: UserStats): string {
  const counts: Array<[string, number]> = [
    ["Assistindo", stats.overview.seriesWatching],
    ["Concluidas", stats.overview.seriesCompleted],
    ["Pausadas", stats.overview.seriesPaused],
    ["Abandonadas", stats.overview.seriesDropped],
    ["Quero assistir", stats.overview.seriesPlanned]
  ];
  const [label, count] = counts.reduce((best, current) => (current[1] > best[1] ? current : best));
  return count > 0 ? label : "—";
}
