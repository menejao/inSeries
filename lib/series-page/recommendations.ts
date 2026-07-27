import { prisma } from "@/lib/db/prisma";
import { canUseDatabase } from "@/lib/db/health";
import { searchSeries, toSeriesSummary } from "@/lib/discovery/search";
import { fetchTmdbSimilarSeries, TmdbConfigurationError } from "@/lib/tmdb/service";
import { getTmdbCredentials } from "@/lib/config";
import type { Series } from "@/lib/types";

const SECTION_LIMIT = 8;

/**
 * Fase 21/22 (INSERIES-CATALOG-SERIES-EXPERIENCE-01) — hierarquia reformulada. Removidos:
 * popularidade/premiacoes/maratona/tags internas/favoritos/recem-adicionadas como criterio de
 * "series parecidas" (nao representam similaridade). Cada secao agora tem 1 criterio claro e
 * nunca se mistura com outra:
 * - similar: TMDb Similar (semelhanca narrativa curada) filtrado ao que ja existe no catalogo
 *   local; cai pro heuristica de tag/keyword so quando TMDb esta indisponivel/nao configurado
 *   ou sem match local.
 * - sameGenre: apenas genero principal, ordenado por Quality Score (nao popularidade).
 * - sameCreator: overlap em `createdBy`, quando a serie tem criador(es) conhecidos.
 * - trending: Discovery Score, SEMPRE em secao separada — nunca misturado com "parecidas".
 */
export type SeriesRecommendations = {
  similar: Series[];
  sameGenre: Series[];
  sameCreator: Series[];
  trending: Series[];
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

async function getTmdbSimilarLocalMatches(externalId: string | null): Promise<Series[]> {
  if (!externalId || !getTmdbCredentials().isConfigured || !(await canUseDatabase())) return [];

  try {
    const tmdbResults = await fetchTmdbSimilarSeries(externalId);
    const tmdbIds = tmdbResults.map((item) => String(item.id));
    if (!tmdbIds.length) return [];

    const mappings = await prisma.externalSourceMapping.findMany({
      where: { source: "TMDB", entityType: "SERIES", externalId: { in: tmdbIds } },
      include: { series: true }
    });

    // Preserve TMDb's own similarity ordering, not the DB's arbitrary row order.
    const byExternalId = new Map(mappings.map((mapping) => [mapping.externalId, mapping.series]));
    return tmdbIds
      .map((id) => byExternalId.get(id))
      .filter((row): row is NonNullable<typeof row> => Boolean(row))
      .slice(0, SECTION_LIMIT)
      .map(toSeriesSummary);
  } catch (error) {
    if (error instanceof TmdbConfigurationError) return [];
    return [];
  }
}

async function getSameCreatorSeries(series: Series): Promise<Series[]> {
  if (!series.createdBy.length || !(await canUseDatabase())) return [];

  const rows = await prisma.series.findMany({
    where: { id: { not: series.id }, createdBy: { hasSome: series.createdBy } },
    orderBy: [{ qualityScore: { sort: "desc", nulls: "last" } }],
    take: SECTION_LIMIT
  });

  return rows.map(toSeriesSummary);
}

export async function getSeriesRecommendations(series: Series, userId?: string | null): Promise<SeriesRecommendations> {
  void userId; // personalized ("voce tambem pode gostar") removido — usava popularidade/favoritos, fora dos criterios permitidos (Fase 21).

  const externalIdRow = (await canUseDatabase())
    ? await prisma.externalSourceMapping.findFirst({ where: { seriesId: series.id, source: "TMDB", entityType: "SERIES" }, select: { externalId: true } })
    : null;

  const [tmdbSimilar, sameCreator, trendingResult] = await Promise.all([
    getTmdbSimilarLocalMatches(externalIdRow?.externalId ?? null),
    getSameCreatorSeries(series),
    searchSeries({ sort: "discovery", pageSize: SECTION_LIMIT + 1 })
  ]);

  let similar = tmdbSimilar;
  if (!similar.length) {
    // Fallback only when TMDb Similar is unavailable/insufficient — tag/keyword heuristic,
    // never popularity-based (Fase 22: "criterio: semelhanca narrativa, nao popularidade").
    const topTag = series.collectionTags[0];
    const topKeyword = series.keywords[0];
    const [tagResult, keywordResult] = await Promise.all([
      topTag ? searchSeries({ tag: topTag, sort: "quality", pageSize: SECTION_LIMIT * 2 }) : null,
      topKeyword ? searchSeries({ keyword: topKeyword, sort: "quality", pageSize: SECTION_LIMIT * 2 }) : null
    ]);
    similar = excludeSelf(dedupeById([...(tagResult?.items ?? []), ...(keywordResult?.items ?? [])]), series.id).slice(0, SECTION_LIMIT);
  }

  const topGenre = series.genres[0];
  const genreResult = topGenre ? await searchSeries({ genre: topGenre, sort: "quality", pageSize: SECTION_LIMIT * 2 }) : null;
  const similarIds = new Set(similar.map((item) => item.id));
  const sameGenre = excludeSelf(genreResult?.items ?? [], series.id)
    .filter((item) => !similarIds.has(item.id))
    .slice(0, SECTION_LIMIT);

  const trending = excludeSelf(trendingResult.items, series.id).slice(0, SECTION_LIMIT);

  return { similar, sameGenre, sameCreator, trending };
}
