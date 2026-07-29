import type { ProviderSignal, RecommendationContext, RecommendationProvider } from "@/lib/recommendations/types";
import { networkReason } from "@/lib/recommendations/reasons";

/** INSERIES-RECOMMENDATION-ENGINE-02 — emissoras que o usuario acompanha. */
export const networkProvider: RecommendationProvider = {
  id: "network",
  label: "Mesma emissora",
  run(context: RecommendationContext): ProviderSignal[] {
    const weightByNetwork = new Map<string, number>();
    for (const seed of context.seedSeries) {
      for (const network of seed.networks) {
        weightByNetwork.set(network, Math.max(weightByNetwork.get(network) ?? 0, seed.weight));
      }
    }
    if (weightByNetwork.size === 0) return [];

    const signals: ProviderSignal[] = [];
    for (const candidate of context.candidates) {
      const match = candidate.networks.find((network) => weightByNetwork.has(network));
      if (!match) continue;

      const score = Math.round(Math.min(1, weightByNetwork.get(match) ?? 0) * 100);
      if (score <= 0) continue;

      signals.push({ seriesId: candidate.id, score, reason: networkReason(match) });
    }
    return signals;
  }
};
