import type { GenreStats, Insight } from "@/lib/analytics";
import type { RecapMostWatchedSeries } from "@/lib/recap/types";

export type RecapInsightInput = {
  label: string;
  episodesWatched: number;
  hoursWatched: number;
  genres: GenreStats;
  longestStreakDays: number;
  seriesCompletedCount: number;
  mostWatchedSeries: RecapMostWatchedSeries;
};

/**
 * Same "one pure rule per line" architecture as `lib/analytics/insights.ts` —
 * deterministic sentences built from numbers already computed elsewhere in
 * this module, never a new calculation and never AI-generated text.
 */
const RECAP_INSIGHT_RULES: Array<(input: RecapInsightInput) => Insight | null> = [
  ({ episodesWatched, label }) =>
    episodesWatched > 0
      ? { id: "recap-episodes", text: `Voce assistiu ${episodesWatched} episodio${episodesWatched === 1 ? "" : "s"} em ${label}.` }
      : null,

  ({ genres, label }) =>
    genres.topGenre ? { id: "recap-top-genre", text: `${genres.topGenre.genre} foi seu genero dominante em ${label}.` } : null,

  ({ longestStreakDays }) =>
    longestStreakDays > 1
      ? { id: "recap-streak", text: `Sua maior sequencia foi de ${longestStreakDays} dias seguidos.` }
      : null,

  ({ hoursWatched }) =>
    hoursWatched > 0 ? { id: "recap-hours", text: `Voce passou ${hoursWatched}h acompanhando series.` } : null,

  ({ seriesCompletedCount }) =>
    seriesCompletedCount > 0
      ? { id: "recap-completed", text: `Voce concluiu ${seriesCompletedCount} serie${seriesCompletedCount === 1 ? "" : "s"}.` }
      : null,

  ({ mostWatchedSeries }) =>
    mostWatchedSeries
      ? {
          id: "recap-most-watched",
          text: `${mostWatchedSeries.seriesTitle} foi a serie que voce mais assistiu, com ${mostWatchedSeries.episodeCount} episodio${mostWatchedSeries.episodeCount === 1 ? "" : "s"}.`
        }
      : null
];

export function generateRecapInsights(input: RecapInsightInput): Insight[] {
  return RECAP_INSIGHT_RULES.map((rule) => rule(input)).filter((insight): insight is Insight => insight !== null);
}
