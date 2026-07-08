import { searchSeries } from "@/lib/discovery/search";
import { getRecommendationsForUser, type RecommendationResult } from "@/lib/recommendations";
import { getSeriesRecommendations } from "@/lib/series-page/recommendations";
import { getCatalogSeriesBySlug } from "@/lib/catalog/repository";
import type { MyListItem } from "@/lib/my-list/types";
import type { Series } from "@/lib/types";

const SECTION_LIMIT = 8;

export type MyListDiscovery = {
  /** Fase 10 "Baseado na sua lista" — motor de recomendacoes existente, ja agregado sobre todo o historico do usuario (genero/similar/popular/rating/trending/editorial). */
  basedOnYourList: RecommendationResult | null;
  /** Fase 10 "Complete sua colecao" — Collection Tag mais frequente entre as series ja rastreadas, buscando outras com a mesma tag que o usuario ainda nao tem. */
  completeYourCollection: Series[];
  /** Fase 10 "Porque voce assistiu {titulo}" — reaproveita getSeriesRecommendations (Fase 9 da pagina da serie) para a serie de maior Discovery Score que o usuario ja acompanha. */
  becauseYouWatched: { series: Series; recommendations: Series[] } | null;
};

function mostFrequentTag(items: MyListItem[]): string | null {
  const counts = new Map<string, number>();
  for (const item of items) {
    const tag = item.series.collectionTags[0];
    if (!tag) continue;
    counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [tag, count] of counts) {
    if (count > bestCount) {
      best = tag;
      bestCount = count;
    }
  }
  return best;
}

function topDiscoveryItem(items: MyListItem[]): MyListItem | null {
  return [...items].sort((a, b) => (b.series.discoveryScore ?? 0) - (a.series.discoveryScore ?? 0))[0] ?? null;
}

/**
 * Fase 10 (INSERIES-MY-LISTS-PREMIUM-01) — 3 secoes, cada uma inteiramente ocultada quando
 * vazia (nunca uma lista generica de preenchimento). Nenhuma consulta nova de similaridade:
 * tudo reaproveita o motor de recomendacoes existente (`getRecommendationsForUser`), a busca
 * por Collection Tag (`searchSeries`, mesma usada pela pagina da serie) e a propria funcao de
 * recomendacoes da pagina da serie (`getSeriesRecommendations`, INSERIES-SERIES-PAGE-PREMIUM-01).
 */
export async function getMyListDiscovery(userId: string, items: MyListItem[]): Promise<MyListDiscovery> {
  const trackedIds = new Set(items.map((item) => item.series.id));
  const topTag = mostFrequentTag(items);
  const topItem = topDiscoveryItem(items);

  const [basedOnYourList, tagResult, topSeries] = await Promise.all([
    getRecommendationsForUser(userId, { limit: SECTION_LIMIT }),
    topTag ? searchSeries({ tag: topTag, sort: "discovery", pageSize: SECTION_LIMIT * 2 }) : null,
    topItem ? getCatalogSeriesBySlug(topItem.series.slug) : null
  ]);

  const completeYourCollection = (tagResult?.items ?? []).filter((series) => !trackedIds.has(series.id)).slice(0, SECTION_LIMIT);

  const becauseYouWatched = topSeries
    ? {
        series: topSeries,
        recommendations: (await getSeriesRecommendations(topSeries, userId)).similar
          .filter((series) => !trackedIds.has(series.id))
          .slice(0, SECTION_LIMIT)
      }
    : null;

  return {
    basedOnYourList: basedOnYourList.enabled && basedOnYourList.items.length ? basedOnYourList : null,
    completeYourCollection,
    becauseYouWatched: becauseYouWatched && becauseYouWatched.recommendations.length ? becauseYouWatched : null
  };
}
