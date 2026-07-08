import type { ProviderSignal, RecommendationContext, RecommendationProvider } from "@/lib/recommendations/types";
import { editorialReason } from "@/lib/recommendations/reasons";

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

/**
 * Fase 4 (INSERIES-DASHBOARD-PREMIUM-01) — "Recomendado para voce": Discovery Score,
 * Quality Score, Collection Tags e Keywords, combinados com o historico do usuario
 * (seedSeries, ja filtrado por status pelas exclusoes existentes em filters.ts). Nunca uma
 * recomendacao generica: um candidato so recebe sinal se tiver overlap real de tag ou
 * keyword com pelo menos uma serie que o usuario concluiu ou esta assistindo — Discovery/
 * Quality Score aqui reforcam a posicao de um match ja pessoal, nunca sao a unica razao
 * (isso seria o mesmo para qualquer usuario, o que o ticket pede para evitar).
 */
export const editorialProvider: RecommendationProvider = {
  id: "editorial",
  label: "Discovery & Quality Score",
  run(context: RecommendationContext): ProviderSignal[] {
    const seedTagSet = new Set(context.seedSeries.flatMap((series) => series.collectionTags));
    const seedKeywordSet = new Set(context.seedSeries.flatMap((series) => series.keywords));
    if (seedTagSet.size === 0 && seedKeywordSet.size === 0) return [];

    const signals: ProviderSignal[] = [];

    for (const candidate of context.candidates) {
      const matchedTags = candidate.collectionTags.filter((tag) => seedTagSet.has(tag));
      const matchedKeywords = candidate.keywords.filter((keyword) => seedKeywordSet.has(keyword));
      if (matchedTags.length === 0 && matchedKeywords.length === 0) continue;

      const overlapScore = clamp01((matchedTags.length * 2 + matchedKeywords.length) / 6);
      const qualityScore = clamp01((candidate.qualityScore ?? 0) / 100);
      const discoveryScore = clamp01((candidate.discoveryScore ?? 0) / 100);

      // Overlap (the personalized part) always weighs more than half — Discovery/Quality
      // Score only ever adjust ranking among already-personalized matches.
      const score = Math.round((overlapScore * 0.5 + discoveryScore * 0.25 + qualityScore * 0.25) * 100);

      signals.push({
        seriesId: candidate.id,
        score,
        reason: editorialReason(matchedTags[0], matchedKeywords[0])
      });
    }

    return signals;
  }
};
