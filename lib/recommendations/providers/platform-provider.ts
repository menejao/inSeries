import type { ProviderSignal, RecommendationContext, RecommendationProvider } from "@/lib/recommendations/types";
import { platformReason } from "@/lib/recommendations/reasons";

/** INSERIES-RECOMMENDATION-ENGINE-02 — "priorizar conteudos disponiveis nessas plataformas quando essa informacao existir." Only fires when the candidate's watchProviders data actually exists — never guessed. */
export const platformProvider: RecommendationProvider = {
  id: "platform",
  label: "Mesma plataforma",
  run(context: RecommendationContext): ProviderSignal[] {
    const weightByPlatform = new Map<string, number>();
    for (const seed of context.seedSeries) {
      for (const provider of seed.watchProviders) {
        weightByPlatform.set(provider, Math.max(weightByPlatform.get(provider) ?? 0, seed.weight));
      }
    }
    if (weightByPlatform.size === 0) return [];

    const signals: ProviderSignal[] = [];
    for (const candidate of context.candidates) {
      if (candidate.watchProviders.length === 0) continue;
      const match = candidate.watchProviders.find((provider) => weightByPlatform.has(provider));
      if (!match) continue;

      const score = Math.round(Math.min(1, weightByPlatform.get(match) ?? 0) * 100);
      if (score <= 0) continue;

      signals.push({ seriesId: candidate.id, score, reason: platformReason(match) });
    }
    return signals;
  }
};
