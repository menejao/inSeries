import type { ProviderSignal, RecommendationContext, RecommendationProvider } from "@/lib/recommendations/types";
import { countryReason } from "@/lib/recommendations/reasons";

/** INSERIES-RECOMMENDATION-ENGINE-02 — paises de origem que o usuario costuma assistir. */
export const countryProvider: RecommendationProvider = {
  id: "country",
  label: "Mesmo pais",
  run(context: RecommendationContext): ProviderSignal[] {
    const totalWeight = context.seedSeries.reduce((sum, seed) => sum + seed.weight, 0);
    if (totalWeight === 0) return [];

    const weightByCountry = new Map<string, number>();
    for (const seed of context.seedSeries) {
      for (const country of seed.originCountry) {
        weightByCountry.set(country, (weightByCountry.get(country) ?? 0) + seed.weight);
      }
    }
    if (weightByCountry.size === 0) return [];

    const signals: ProviderSignal[] = [];
    for (const candidate of context.candidates) {
      const match = candidate.originCountry.find((country) => weightByCountry.has(country));
      if (!match) continue;

      const score = Math.round(((weightByCountry.get(match) ?? 0) / totalWeight) * 100);
      if (score <= 0) continue;

      signals.push({ seriesId: candidate.id, score, reason: countryReason(match) });
    }
    return signals;
  }
};
