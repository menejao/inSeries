import { searchSeries } from "@/lib/discovery/search";
import type { Series } from "@/lib/types";

export type CatalogDiscoverySections = {
  trending: Series[];
  popular: Series[];
  latest: Series[];
  topRated: Series[];
};

const SECTION_SIZE = 10;

/**
 * Fase 9 (INSERIES-CATALOG-SERIES-EXPERIENCE-01) — secoes editoriais mostradas apenas quando
 * nao ha busca/filtro ativo (ver app/series/page.tsx): "o que vale a pena descobrir" antes de
 * mergulhar em "todos os resultados". Reaproveita searchSeries com os sorts ja existentes —
 * nenhuma query nova.
 */
export async function getCatalogDiscoverySections(): Promise<CatalogDiscoverySections> {
  const [trending, popular, latest, topRated] = await Promise.all([
    searchSeries({ sort: "discovery", pageSize: SECTION_SIZE }),
    searchSeries({ sort: "popular", pageSize: SECTION_SIZE }),
    searchSeries({ sort: "latest", pageSize: SECTION_SIZE }),
    searchSeries({ sort: "rating", pageSize: SECTION_SIZE })
  ]);

  return {
    trending: trending.items,
    popular: popular.items,
    latest: latest.items,
    topRated: topRated.items
  };
}
