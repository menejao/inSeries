import type { ProviderSignal, RecommendationContext, RecommendationProvider } from "@/lib/recommendations/types";
import { castReason } from "@/lib/recommendations/reasons";

const MIN_RECURRING_APPEARANCES = 2;

/** INSERIES-RECOMMENDATION-ENGINE-02 — "caso varios atores apareçam repetidamente no historico, dar peso adicional." Only actors seen in 2+ seed series count — a single shared actor is too common to be a real signal. */
export const castProvider: RecommendationProvider = {
  id: "cast",
  label: "Mesmo elenco",
  run(context: RecommendationContext): ProviderSignal[] {
    const appearances = new Map<string, { count: number; weight: number }>();
    for (const seed of context.seedSeries) {
      for (const actor of seed.castNames) {
        const entry = appearances.get(actor) ?? { count: 0, weight: 0 };
        entry.count += 1;
        entry.weight = Math.max(entry.weight, seed.weight);
        appearances.set(actor, entry);
      }
    }
    const recurring = new Map([...appearances].filter(([, entry]) => entry.count >= MIN_RECURRING_APPEARANCES));
    if (recurring.size === 0) return [];

    const signals: ProviderSignal[] = [];
    for (const candidate of context.candidates) {
      const match = candidate.castNames.find((actor) => recurring.has(actor));
      if (!match) continue;

      const score = Math.round(Math.min(1, recurring.get(match)?.weight ?? 0) * 100);
      if (score <= 0) continue;

      signals.push({ seriesId: candidate.id, score, reason: castReason(match) });
    }
    return signals;
  }
};
