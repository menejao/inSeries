import type { ProviderSignal, RecommendationContext, RecommendationProvider } from "@/lib/recommendations/types";
import { genreAffinityReason } from "@/lib/recommendations/reasons";

/**
 * Scores candidates by overlap with the user's genre affinity (reused
 * directly from the Analytics Layer's `computeGenreStats`, computed over
 * the user's watched episodes). A candidate with no genre overlap gets no
 * signal at all from this provider (not a zero-score entry) so it never
 * shows up as a "genre match" reason with nothing behind it.
 */
export const genreProvider: RecommendationProvider = {
  id: "genre",
  label: "Generos favoritos",
  run(context: RecommendationContext): ProviderSignal[] {
    const affinityByGenre = new Map(context.genreAffinity.ranking.map((stat) => [stat.genre, stat.percentage]));
    if (affinityByGenre.size === 0) return [];

    const signals: ProviderSignal[] = [];

    for (const candidate of context.candidates) {
      const matches = candidate.genres.filter((genre) => affinityByGenre.has(genre));
      if (matches.length === 0) continue;

      const score = Math.min(100, matches.reduce((sum, genre) => sum + (affinityByGenre.get(genre) ?? 0), 0));

      const bestGenre = [...matches].sort((a, b) => (affinityByGenre.get(b) ?? 0) - (affinityByGenre.get(a) ?? 0))[0];
      const completedCount = context.genreCompletedCounts.get(bestGenre) ?? 0;

      signals.push({ seriesId: candidate.id, score, reason: genreAffinityReason(bestGenre, completedCount) });
    }

    return signals;
  }
};
