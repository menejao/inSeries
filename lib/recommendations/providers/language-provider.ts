import type { ProviderSignal, RecommendationContext, RecommendationProvider } from "@/lib/recommendations/types";
import { languageReason } from "@/lib/recommendations/reasons";

/** INSERIES-RECOMMENDATION-ENGINE-02 — "detectar idiomas predominantes... priorizar idiomas semelhantes." Score = the seed's share of the user's watched languages, so an 80%-English viewer gets a much stronger English signal than a 5%-Spanish one. */
export const languageProvider: RecommendationProvider = {
  id: "language",
  label: "Mesmo idioma",
  run(context: RecommendationContext): ProviderSignal[] {
    const totalWeight = context.seedSeries.reduce((sum, seed) => sum + seed.weight, 0);
    if (totalWeight === 0) return [];

    const weightByLanguage = new Map<string, number>();
    for (const seed of context.seedSeries) {
      if (!seed.language) continue;
      weightByLanguage.set(seed.language, (weightByLanguage.get(seed.language) ?? 0) + seed.weight);
    }
    if (weightByLanguage.size === 0) return [];

    const signals: ProviderSignal[] = [];
    for (const candidate of context.candidates) {
      if (!candidate.language) continue;
      const weight = weightByLanguage.get(candidate.language);
      if (!weight) continue;

      const score = Math.round((weight / totalWeight) * 100);
      if (score <= 0) continue;

      signals.push({ seriesId: candidate.id, score, reason: languageReason(candidate.language) });
    }
    return signals;
  }
};
