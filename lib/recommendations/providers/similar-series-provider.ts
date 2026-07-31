import type { ProviderSignal, RecommendationContext, RecommendationProvider, SeedSeries } from "@/lib/recommendations/types";
import { similarSeriesReason } from "@/lib/recommendations/reasons";

function jaccard(a: string[], b: string[]) {
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  const intersection = [...setA].filter((genre) => setB.has(genre)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

// INSERIES-RECOMMENDATION-ENGINE-01 — "series nao devem ser consideradas semelhantes apenas
// porque compartilham genero" (duas series de Drama podem ser Romance vs. Terror psicologico):
// genero sozinho pesa so 55% do overlap; keywords do TMDb (temas/estilo/ambientacao — nao ha
// outra fonte pra essas dimensoes no catalogo) e Collection Tags completam o resto, igual ao
// blend ja usado por editorial-provider.ts pro historico do usuario.
const GENRE_WEIGHT = 0.55;
const KEYWORD_WEIGHT = 0.3;
const TAG_WEIGHT = 0.15;

function blendedOverlap(candidateGenres: string[], candidateKeywords: string[], candidateTags: string[], seed: SeedSeries) {
  return (
    jaccard(candidateGenres, seed.genres) * GENRE_WEIGHT +
    jaccard(candidateKeywords, seed.keywords) * KEYWORD_WEIGHT +
    jaccard(candidateTags, seed.collectionTags) * TAG_WEIGHT
  );
}

/**
 * "Similar to X": similaridade ponderada entre um candidato e cada uma das "seed series" do
 * usuario (series concluidas ou em andamento) — genero + keywords + Collection Tags, nao so
 * genero. Cada candidato e comparado com sua melhor seed correspondente.
 */
export const similarSeriesProvider: RecommendationProvider = {
  id: "similar",
  label: "Series parecidas com o que voce assistiu",
  run(context: RecommendationContext): ProviderSignal[] {
    if (context.seedSeries.length === 0) return [];

    const signals: ProviderSignal[] = [];

    for (const candidate of context.candidates) {
      // INSERIES-RECOMMENDATION-ENGINE-02 — "series avaliadas com notas altas" pesam mais:
      // rank by overlap * seed.weight (0 for a 1-star review), not raw overlap alone, so a
      // 5-star match beats an unrated/low-rated one even with identical overlap.
      let best: { seed: string; weighted: number } | null = null;

      for (const seed of context.seedSeries) {
        if (seed.weight <= 0) continue;
        const overlap = blendedOverlap(candidate.genres, candidate.keywords, candidate.collectionTags, seed);
        const weighted = overlap * seed.weight;
        if (weighted > 0 && (!best || weighted > best.weighted)) {
          best = { seed: seed.title, weighted };
        }
      }

      if (!best) continue;

      signals.push({
        seriesId: candidate.id,
        score: Math.round(Math.min(1, best.weighted) * 100),
        reason: similarSeriesReason(best.seed)
      });
    }

    return signals;
  }
};
