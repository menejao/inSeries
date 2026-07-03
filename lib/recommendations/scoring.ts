import { config } from "@/lib/config";
import type { ProviderSignal, RecommendationProviderId, RecommendationReason } from "@/lib/recommendations/types";

export type CombinedScore = {
  seriesId: string;
  score: number;
  reasons: RecommendationReason[];
};

/**
 * Combines every provider's raw (0-100) signals into one weighted score per
 * series: `finalScore = sum(providerScore * weight[provider])`. Weights
 * live in `config.recommendations.weights` (lib/config), never as numbers
 * scattered through the providers themselves.
 */
export function combineProviderSignals(signalsByProvider: Record<RecommendationProviderId, ProviderSignal[]>): CombinedScore[] {
  const bySeries = new Map<string, CombinedScore>();

  for (const [providerId, signals] of Object.entries(signalsByProvider) as [RecommendationProviderId, ProviderSignal[]][]) {
    const weight = config.recommendations.weights[providerId];

    for (const signal of signals) {
      const entry = bySeries.get(signal.seriesId) ?? { seriesId: signal.seriesId, score: 0, reasons: [] };
      entry.score += signal.score * weight;
      entry.reasons.push({ provider: providerId, text: signal.reason, score: signal.score * weight });
      bySeries.set(signal.seriesId, entry);
    }
  }

  for (const entry of bySeries.values()) {
    entry.reasons.sort((a, b) => b.score - a.score);
  }

  return [...bySeries.values()].sort((a, b) => b.score - a.score);
}
