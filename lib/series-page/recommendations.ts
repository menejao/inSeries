import { searchSeries } from "@/lib/discovery/search";
import { getRecommendationsForUser, type RecommendationResult } from "@/lib/recommendations";
import { listMaratonas } from "@/lib/catalog/smart-lists";
import type { Series } from "@/lib/types";

const SECTION_LIMIT = 8;

export type SeriesRecommendations = {
  /** Fase 9 "Series parecidas" — Collection Tags + Keywords + genero desta serie, ranqueado por Discovery Score. Nunca generico: so existe sinal se a serie tiver pelo menos uma tag/keyword/genero. */
  similar: Series[];
  /** Fase 9 "Mais da mesma categoria" — mesmo genero principal, ordenado por Quality Score. */
  sameCategory: Series[];
  /** Fase 9 "Maratonas" — Smart List reaproveitada sem alteracao (INSERIES-TRENDING-DISCOVERY-ENGINE-01). */
  marathons: Series[];
  /** Fase 9 "Voce tambem pode gostar" — motor de recomendacoes do usuario reaproveitado sem alteracao; so existe quando autenticado. */
  personalized: RecommendationResult | null;
};

function excludeSelf(items: Series[], seriesId: string) {
  return items.filter((item) => item.id !== seriesId);
}

function dedupeById(items: Series[]) {
  const seen = new Map<string, Series>();
  for (const item of items) {
    if (!seen.has(item.id)) seen.set(item.id, item);
  }
  return [...seen.values()];
}

/**
 * Fase 9 (INSERIES-SERIES-PAGE-PREMIUM-01) — every subsection reuses an existing query
 * capability (`searchSeries`'s tag/keyword/genre filters + discovery/quality sort,
 * `listMaratonas`, `getRecommendationsForUser`) — nothing new added to the discovery layer
 * itself. "Similar" merges up to 3 existing single-facet searches in memory (searchSeries
 * only supports one tag/keyword/genre at a time) rather than inventing a multi-facet query.
 */
export async function getSeriesRecommendations(series: Series, userId?: string | null): Promise<SeriesRecommendations> {
  const topTag = series.collectionTags[0];
  const topKeyword = series.keywords[0];
  const topGenre = series.genres[0];

  const [tagResult, keywordResult, genreResult, marathonsResult, personalized] = await Promise.all([
    topTag ? searchSeries({ tag: topTag, sort: "discovery", pageSize: SECTION_LIMIT * 2 }) : null,
    topKeyword ? searchSeries({ keyword: topKeyword, sort: "discovery", pageSize: SECTION_LIMIT * 2 }) : null,
    topGenre ? searchSeries({ genre: topGenre, sort: "quality", pageSize: SECTION_LIMIT * 2 }) : null,
    listMaratonas(SECTION_LIMIT * 2),
    userId ? getRecommendationsForUser(userId, { limit: SECTION_LIMIT }) : Promise.resolve(null)
  ]);

  const similarCandidates = dedupeById([...(tagResult?.items ?? []), ...(keywordResult?.items ?? [])]);
  const similar = excludeSelf(similarCandidates, series.id)
    .sort((a, b) => (b.discoveryScore ?? 0) - (a.discoveryScore ?? 0))
    .slice(0, SECTION_LIMIT);

  const similarIds = new Set(similar.map((item) => item.id));
  const sameCategory = excludeSelf(genreResult?.items ?? [], series.id)
    .filter((item) => !similarIds.has(item.id))
    .slice(0, SECTION_LIMIT);

  const marathons = excludeSelf(marathonsResult, series.id).slice(0, SECTION_LIMIT);

  return { similar, sameCategory, marathons, personalized };
}
