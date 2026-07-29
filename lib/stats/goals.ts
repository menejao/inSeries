import type { OverviewStats, WatchTimeStats } from "@/lib/analytics/types";
import type { GoalProgress } from "@/lib/stats/types";

/**
 * INSERIES-STATISTICS-ENGINE-01 — "criar metas... exibir progresso visual". Fixed common
 * milestones (matching the ticket's own examples) rather than a user-configurable goal system
 * — no such concept exists anywhere in the schema, and the ticket never shows a goal-creation
 * UI, only fixed round-number targets with a progress bar.
 */
const GOAL_TARGETS = [
  { id: "episodes-1000", label: "Assistir 1000 episodios", target: 1000, metric: "episodes" as const },
  { id: "series-10", label: "Concluir 10 series", target: 10, metric: "seriesCompleted" as const },
  { id: "hours-100", label: "Assistir 100 horas", target: 100, metric: "hours" as const }
];

export function computeGoalsProgress(overview: OverviewStats, watchTime: WatchTimeStats): GoalProgress[] {
  const currentByMetric = {
    episodes: overview.episodesWatched,
    seriesCompleted: overview.seriesCompleted,
    hours: watchTime.hoursWatched
  };

  return GOAL_TARGETS.map((goal) => {
    const current = currentByMetric[goal.metric];
    return { id: goal.id, label: goal.label, current, target: goal.target, percent: Math.min(100, Math.round((current / goal.target) * 100)) };
  });
}
