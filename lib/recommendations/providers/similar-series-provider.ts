import type { ProviderSignal, RecommendationContext, RecommendationProvider } from "@/lib/recommendations/types";
import { similarSeriesReason } from "@/lib/recommendations/reasons";

function jaccard(a: string[], b: string[]) {
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  const intersection = [...setA].filter((genre) => setB.has(genre)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

/**
 * "Similar to X" without embeddings or keywords (neither exists in the
 * catalog data — see the Fase 1 audit in the README): similarity is the
 * genre overlap (Jaccard index) between a candidate and each of the user's
 * "seed" series (series they've completed or are currently watching). Each
 * candidate is matched to its single best-overlapping seed.
 */
export const similarSeriesProvider: RecommendationProvider = {
  id: "similar",
  label: "Series parecidas com o que voce assistiu",
  run(context: RecommendationContext): ProviderSignal[] {
    if (context.seedSeries.length === 0) return [];

    const signals: ProviderSignal[] = [];

    for (const candidate of context.candidates) {
      let best: { seed: string; overlap: number } | null = null;

      for (const seed of context.seedSeries) {
        const overlap = jaccard(candidate.genres, seed.genres);
        if (overlap > 0 && (!best || overlap > best.overlap)) {
          best = { seed: seed.title, overlap };
        }
      }

      if (!best) continue;

      signals.push({
        seriesId: candidate.id,
        score: Math.round(best.overlap * 100),
        reason: similarSeriesReason(best.seed)
      });
    }

    return signals;
  }
};
