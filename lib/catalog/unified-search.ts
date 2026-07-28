import { ExternalEntityType, ExternalSource } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { canUseDatabase } from "@/lib/db/health";
import { searchSeries, type SeriesDiscoveryParams } from "@/lib/discovery/search";
import { searchExternalSeries } from "@/lib/catalog/repository";
import type { Series } from "@/lib/types";

// Fase 4-6 (INSERIES-CATALOG-TRANSPARENT-SEARCH-AND-SILENT-IMPORT-01) — resultados locais e do
// TMDb combinados numa unica lista, deduplicados por tmdb_id, sem expor origem. Cap generoso o
// bastante pra parecer completo sem virar uma segunda pagina paginada dentro da busca — busca
// nao usa a paginacao tradicional do catalogo (ver CatalogPagination), so mostra os melhores
// resultados combinados.
const LOCAL_RESULTS_CAP = 30;
const EXTERNAL_RESULTS_CAP = 20;
const UNIFIED_RESULTS_CAP = 40;

export type UnifiedSeriesResult = Series & { tmdbId?: string };

export type UnifiedSearchOutcome = {
  items: UnifiedSeriesResult[];
  // Fase 21 — falha parcial de uma fonte nunca derruba a busca; so vira "falha total" (mensagem
  // amigavel de retry) quando NENHUMA fonte responde E nao ha resultado nenhum pra mostrar.
  bothFailed: boolean;
};

function externalStatusOrUndefined(status: string): string | undefined {
  return status || undefined;
}

/**
 * Fase 4/6/7 — busca hibrida: consulta local + TMDb em paralelo, deduplica por tmdb_id (usando
 * `ExternalSourceMapping`, a mesma fonte de verdade que `upsertNormalizedSeriesWithCounts` usa
 * pra decidir update-vs-create) e devolve uma lista unica pronta pra um unico grid/card — nunca
 * dois resultados pra mesma serie, nunca uma flag "de onde veio" exposta ao chamador de UI.
 */
export async function getUnifiedSearchResults(params: SeriesDiscoveryParams & { q: string }): Promise<UnifiedSearchOutcome> {
  const dbAvailable = await canUseDatabase();

  const [localSettled, externalSettled] = await Promise.allSettled([
    searchSeries({ ...params, page: 1, pageSize: LOCAL_RESULTS_CAP }),
    searchExternalSeries(params.q)
  ]);

  const localItems: Series[] = localSettled.status === "fulfilled" ? localSettled.value.items : [];
  const externalRaw = externalSettled.status === "fulfilled" ? externalSettled.value.slice(0, EXTERNAL_RESULTS_CAP) : [];

  const bothFailed = localSettled.status === "rejected" && externalSettled.status === "rejected";

  if (!externalRaw.length) {
    return { items: localItems, bothFailed: bothFailed && localItems.length === 0 };
  }

  // Fase 6 — dedup obrigatorio por tmdb_id: qualquer resultado externo que ja mapeia pra uma
  // serie local (mesmo que essa serie nao tenha aparecido em `localItems`, por nao bater com
  // filtros de status/genero/etc.) e descartado, o registro local sempre prevalece.
  const externalIds = externalRaw.map((item) => item.external.externalId);
  const mappings = dbAvailable
    ? await prisma.externalSourceMapping.findMany({
        where: { source: ExternalSource.TMDB, entityType: ExternalEntityType.SERIES, externalId: { in: externalIds } },
        select: { externalId: true }
      })
    : [];
  const mappedExternalIds = new Set(mappings.map((mapping) => mapping.externalId));

  const externalStubs: UnifiedSeriesResult[] = externalRaw
    .filter((item) => !mappedExternalIds.has(item.external.externalId))
    .map((item) => ({
      id: `tmdb-${item.external.externalId}`,
      // Fase 12 — rota temporaria canonica-pendente: SeriesCard usa `/series/${series.slug}`
      // sem nenhuma alteracao, e essa rota resolve/cria o registro local e redireciona pra
      // URL canonica definitiva (app/series/tmdb/[tmdbId]/page.tsx).
      slug: `tmdb/${item.external.externalId}`,
      title: item.title,
      originalTitle: item.originalTitle,
      year: item.year,
      status: externalStatusOrUndefined(item.status) ?? "RETURNING",
      overview: item.overview,
      genres: item.genres,
      language: item.language,
      platform: item.platform,
      popularity: item.popularity,
      posterUrl: item.posterUrl,
      backdropUrl: item.backdropUrl,
      voteAverage: item.voteAverage ?? null,
      qualityScore: null,
      discoveryScore: null,
      collectionTags: [],
      watchProviders: [],
      keywords: [],
      type: item.type ?? null,
      logoUrl: null,
      originCountry: item.originCountry ?? [],
      spokenLanguages: [],
      createdBy: [],
      networks: [],
      productionCompanies: [],
      productionCountries: [],
      tagline: null,
      homepage: null,
      numberOfSeasons: null,
      numberOfEpisodes: null,
      seasons: [],
      tmdbId: item.external.externalId
    }));

  // Fase 5 — correspondencia exata > local (ja curada/completa) > relevancia (nota/popularidade).
  const qLower = params.q.trim().toLowerCase();
  function isExactMatch(item: Series) {
    return item.title.toLowerCase() === qLower || item.originalTitle?.toLowerCase() === qLower;
  }

  const merged: UnifiedSeriesResult[] = [...localItems, ...externalStubs];
  merged.sort((a, b) => {
    const exactDiff = Number(isExactMatch(b)) - Number(isExactMatch(a));
    if (exactDiff !== 0) return exactDiff;
    const localDiff = Number("tmdbId" in b && Boolean(b.tmdbId)) - Number("tmdbId" in a && Boolean(a.tmdbId));
    if (localDiff !== 0) return localDiff;
    return (b.voteAverage ?? 0) - (a.voteAverage ?? 0);
  });

  return { items: merged.slice(0, UNIFIED_RESULTS_CAP), bothFailed: false };
}
