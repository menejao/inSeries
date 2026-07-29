import type { ProviderSignal, RecommendationContext, RecommendationProvider } from "@/lib/recommendations/types";
import { creatorReason } from "@/lib/recommendations/reasons";

/** INSERIES-RECOMMENDATION-ENGINE-02 — "se o usuario acompanha frequentemente obras do mesmo criador, dar prioridade." Weighted by how highly the user rated the seed series that share the creator. */
export const creatorProvider: RecommendationProvider = {
  id: "creator",
  label: "Mesmo criador",
  run(context: RecommendationContext): ProviderSignal[] {
    const weightByCreator = new Map<string, number>();
    for (const seed of context.seedSeries) {
      for (const creator of seed.createdBy) {
        weightByCreator.set(creator, Math.max(weightByCreator.get(creator) ?? 0, seed.weight));
      }
    }
    if (weightByCreator.size === 0) return [];

    const signals: ProviderSignal[] = [];
    for (const candidate of context.candidates) {
      const match = candidate.createdBy.find((creator) => weightByCreator.has(creator));
      if (!match) continue;

      const score = Math.round(Math.min(1, weightByCreator.get(match) ?? 0) * 100);
      if (score <= 0) continue;

      signals.push({ seriesId: candidate.id, score, reason: creatorReason(match) });
    }
    return signals;
  }
};
