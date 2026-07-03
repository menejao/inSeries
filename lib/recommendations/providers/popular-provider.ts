import type { ProviderSignal, RecommendationContext, RecommendationProvider } from "@/lib/recommendations/types";
import { popularReason } from "@/lib/recommendations/reasons";

/**
 * Scores by the catalog's own `popularityScore` (sourced from TMDb during
 * sync — see lib/catalog/sync.ts), normalized against the highest score in
 * the current candidate pool. Needs no user history at all, which is what
 * makes it (along with rating/trending) the fallback for a brand-new user.
 */
export const popularProvider: RecommendationProvider = {
  id: "popular",
  label: "Popularidade no catalogo",
  run(context: RecommendationContext): ProviderSignal[] {
    const maxPopularity = Math.max(0, ...context.candidates.map((c) => c.popularityScore ?? 0));
    if (maxPopularity <= 0) return [];

    const signals: ProviderSignal[] = [];
    for (const candidate of context.candidates) {
      if (!candidate.popularityScore || candidate.popularityScore <= 0) continue;

      signals.push({
        seriesId: candidate.id,
        score: Math.round((candidate.popularityScore / maxPopularity) * 100),
        reason: popularReason()
      });
    }

    return signals;
  }
};
