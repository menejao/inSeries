import type { AnalyticsDataset, StreakStats } from "@/lib/analytics/types";
import type { FunRecords, MilestoneEvent } from "@/lib/stats/types";

const EPISODE_MILESTONES = [100, 250, 500, 1000];

/** INSERIES-STATISTICS-ENGINE-01 — "linha do tempo mostrando a evolucao": primeira serie, primeira concluida, marcos de episodios, maior maratona, maior sequencia. */
export function computeMilestones(dataset: AnalyticsDataset, streaks: StreakStats, records: FunRecords): MilestoneEvent[] {
  const milestones: MilestoneEvent[] = [];

  const firstAdded = [...dataset.seriesStatuses].sort((a, b) => a.addedAt.getTime() - b.addedAt.getTime())[0] ?? null;
  milestones.push({
    id: "first-series-added",
    label: firstAdded ? `Primeira serie adicionada: ${firstAdded.seriesTitle}` : "Primeira serie adicionada",
    date: firstAdded?.addedAt ?? null,
    achieved: Boolean(firstAdded)
  });

  const completedSorted = dataset.seriesStatuses
    .filter((s) => s.state === "COMPLETED" && s.completedAt)
    .sort((a, b) => (a.completedAt as Date).getTime() - (b.completedAt as Date).getTime());
  const firstCompleted = completedSorted[0] ?? null;
  milestones.push({
    id: "first-series-completed",
    label: firstCompleted ? `Primeira serie concluida: ${firstCompleted.seriesTitle}` : "Primeira serie concluida",
    date: firstCompleted?.completedAt ?? null,
    achieved: Boolean(firstCompleted)
  });

  const sortedEpisodes = [...dataset.watchedEpisodes].sort((a, b) => a.watchedAt.getTime() - b.watchedAt.getTime());
  for (const threshold of EPISODE_MILESTONES) {
    const crossing = sortedEpisodes[threshold - 1];
    milestones.push({
      id: `episodes-${threshold}`,
      label: `${threshold} episodios assistidos`,
      date: crossing?.watchedAt ?? null,
      achieved: Boolean(crossing)
    });
  }

  milestones.push({
    id: "biggest-binge",
    label: records.biggestBingeDay ? `Maior maratona: ${records.biggestBingeDay.episodeCount} episodios em um dia` : "Maior maratona",
    date: records.biggestBingeDay ? new Date(`${records.biggestBingeDay.date}T00:00:00.000Z`) : null,
    achieved: Boolean(records.biggestBingeDay)
  });

  milestones.push({
    id: "longest-streak",
    label: streaks.longestStreakDays > 0 ? `Maior sequencia: ${streaks.longestStreakDays} dias seguidos` : "Maior sequencia",
    date: null,
    achieved: streaks.longestStreakDays > 0
  });

  return milestones;
}
