import type { GenreStats, Insight, OverviewStats, StreakStats, WatchedEpisodeRecord, WatchTimeStats } from "@/lib/analytics/types";

export type InsightInput = {
  overview: OverviewStats;
  watchTime: WatchTimeStats;
  genres: GenreStats;
  streaks: StreakStats;
  watchedEpisodes: WatchedEpisodeRecord[];
};

/** Exported for reuse by the Recap layer ("serie mais assistida no periodo") — same rule, no duplication. */
export function getMostWatchedSeries(watchedEpisodes: WatchedEpisodeRecord[]): { seriesId: string; title: string; count: number } | null {
  const counts = new Map<string, { seriesId: string; title: string; count: number }>();
  for (const episode of watchedEpisodes) {
    const entry = counts.get(episode.seriesId) ?? { seriesId: episode.seriesId, title: episode.seriesTitle, count: 0 };
    entry.count += 1;
    counts.set(episode.seriesId, entry);
  }
  return [...counts.values()].sort((a, b) => b.count - a.count)[0] ?? null;
}

/**
 * Each rule is a small pure function that either returns an `Insight` or
 * `null` (not applicable yet, e.g. not enough data). Adding a new insight
 * means adding one function to this array — nothing else in the layer
 * needs to change (Fase 7's "arquitetura para novos insights").
 */
const INSIGHT_RULES: Array<(input: InsightInput) => Insight | null> = [
  ({ overview }) =>
    overview.seriesCompleted > 0
      ? { id: "series-completed", text: `Voce concluiu ${overview.seriesCompleted} serie${overview.seriesCompleted === 1 ? "" : "s"}.` }
      : null,

  ({ genres }) =>
    genres.topGenre ? { id: "top-genre", text: `Seu genero favorito e ${genres.topGenre.genre}.` } : null,

  ({ watchTime }) =>
    watchTime.hoursWatched > 0 ? { id: "hours-watched", text: `Voce ja assistiu ${watchTime.hoursWatched}h de series.` } : null,

  ({ watchedEpisodes }) => {
    const longest = getMostWatchedSeries(watchedEpisodes);
    return longest && longest.count > 1
      ? { id: "longest-series", text: `A serie que voce mais assistiu foi ${longest.title}, com ${longest.count} episodios.` }
      : null;
  },

  ({ streaks }) =>
    streaks.activeDays > 0
      ? { id: "active-days", text: `Voce assistiu episodios em ${streaks.activeDays} dia${streaks.activeDays === 1 ? "" : "s"} diferente${streaks.activeDays === 1 ? "" : "s"}.` }
      : null,

  ({ streaks }) =>
    streaks.longestStreakDays > 1
      ? { id: "longest-streak", text: `Sua maior sequencia foi de ${streaks.longestStreakDays} dias seguidos assistindo series.` }
      : null,

  ({ streaks }) =>
    streaks.currentStreakDays > 1
      ? { id: "current-streak", text: `Voce esta numa sequencia atual de ${streaks.currentStreakDays} dias.` }
      : null,

  ({ overview }) =>
    overview.episodesRemaining > 0
      ? { id: "episodes-remaining", text: `Voce tem ${overview.episodesRemaining} episodio${overview.episodesRemaining === 1 ? "" : "s"} restante${overview.episodesRemaining === 1 ? "" : "s"} nas series que esta acompanhando.` }
      : null
];

export function generateInsights(input: InsightInput): Insight[] {
  return INSIGHT_RULES.map((rule) => rule(input)).filter((insight): insight is Insight => insight !== null);
}
