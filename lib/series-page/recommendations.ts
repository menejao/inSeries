import { prisma } from "@/lib/db/prisma";
import { canUseDatabase } from "@/lib/db/health";
import { searchSeries, toSeriesSummary } from "@/lib/discovery/search";
import { fetchTmdbSimilarSeries, fetchTmdbRecommendedSeries, TmdbConfigurationError } from "@/lib/tmdb/service";
import { getTmdbCredentials } from "@/lib/config";
import type { NormalizedCastMember } from "@/lib/catalog/normalize";
import type { Series } from "@/lib/types";

const RESULT_LIMIT = 5;
const CANDIDATE_POOL = 8;

/**
 * Fase 20/21/22/23/24 (INSERIES-CATALOG-SERIES-EXPERIENCE-V2) — a pagina da serie nao deve
 * funcionar como um segundo Catalogo. Todas as secoes rotuladas da V1 (Series parecidas/Mesmo
 * genero/Mesmo universo/Do mesmo criador/Com o mesmo elenco/Em alta) foram substituidas por UM
 * unico resultado: `youMayLike`, no maximo 5 series. Os criterios (TMDb Similar -> TMDb
 * Recommendations -> mesmo genero -> mesmo criador -> mesmo elenco -> popularidade) continuam
 * existindo, mas so como ordem de prioridade INTERNA pra preencher esses 5 slots — a UI nunca
 * rotula qual criterio gerou qual item (Fase 22: "esses criterios servem apenas para calcular
 * a recomendacao, nao para serem exibidos").
 *
 * `officialUniverse` e a unica excecao permitida a uma secao propria (Fase 24) — reservado pra
 * quando o catalogo passar a reconhecer franquias curadas (ex.: MCU, Arrowverse). Sem uma fonte
 * de dado curada pra isso hoje (TMDb TV nao tem `belongs_to_collection`, exclusivo de filmes),
 * fica sempre vazio — o componente esconde a secao por completo nesse caso, nunca inventando
 * uma franquia a partir de heuristica fraca.
 */
export type SeriesRecommendations = {
  youMayLike: Series[];
  officialUniverse: Series[];
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

async function getTmdbLocalMatches(externalId: string | null, fetcher: (id: string) => Promise<Array<{ id: number }>>): Promise<Series[]> {
  if (!externalId || !getTmdbCredentials().isConfigured || !(await canUseDatabase())) return [];

  try {
    const tmdbResults = await fetcher(externalId);
    const tmdbIds = tmdbResults.map((item) => String(item.id));
    if (!tmdbIds.length) return [];

    const mappings = await prisma.externalSourceMapping.findMany({
      where: { source: "TMDB", entityType: "SERIES", externalId: { in: tmdbIds } },
      include: { series: true }
    });

    const byExternalId = new Map(mappings.map((mapping) => [mapping.externalId, mapping.series]));
    return tmdbIds
      .map((id) => byExternalId.get(id))
      .filter((row): row is NonNullable<typeof row> => Boolean(row))
      .map((row) => toSeriesSummary(row));
  } catch (error) {
    if (error instanceof TmdbConfigurationError) return [];
    return [];
  }
}

async function getSameGenreSeries(series: Series): Promise<Series[]> {
  const topGenre = series.genres[0];
  if (!topGenre) return [];
  const result = await searchSeries({ genre: topGenre, sort: "quality", pageSize: CANDIDATE_POOL });
  return excludeSelf(result.items, series.id);
}

async function getSameCreatorSeries(series: Series): Promise<Series[]> {
  if (!series.createdBy.length || !(await canUseDatabase())) return [];
  const rows = await prisma.series.findMany({
    where: { id: { not: series.id }, createdBy: { hasSome: series.createdBy } },
    orderBy: [{ qualityScore: { sort: "desc", nulls: "last" } }],
    take: CANDIDATE_POOL
  });
  return rows.map((row) => toSeriesSummary(row));
}

async function getSameCastSeries(seriesId: string, castIds: number[]): Promise<Series[]> {
  if (!castIds.length || !(await canUseDatabase())) return [];
  const idSet = new Set(castIds);
  const candidates = await prisma.series.findMany({ where: { id: { not: seriesId }, cast: { isEmpty: false } }, take: 60 });
  return candidates
    .map((candidate) => ({
      candidate,
      overlap: (candidate.cast as unknown as NormalizedCastMember[]).filter((member) => idSet.has(member.id)).length
    }))
    .filter((item) => item.overlap > 0)
    .sort((a, b) => b.overlap - a.overlap)
    .slice(0, CANDIDATE_POOL)
    .map((item) => toSeriesSummary(item.candidate));
}

async function getPopularSeries(seriesId: string): Promise<Series[]> {
  const result = await searchSeries({ sort: "popular", pageSize: RESULT_LIMIT + 1 });
  return excludeSelf(result.items, seriesId);
}

export async function getSeriesRecommendations(series: Series, userId?: string | null): Promise<SeriesRecommendations> {
  void userId; // Fase 21 — sem "voce tambem pode gostar" personalizado baseado em popularidade/favoritos; o unico bloco de recomendacao e este, com criterios narrativos.

  const dbAvailable = await canUseDatabase();
  const externalIdRow = dbAvailable
    ? await prisma.externalSourceMapping.findFirst({ where: { seriesId: series.id, source: "TMDB", entityType: "SERIES" }, select: { externalId: true } })
    : null;
  const castRow = dbAvailable ? await prisma.series.findUnique({ where: { id: series.id }, select: { cast: true } }) : null;
  const seriesCastIds = ((castRow?.cast ?? []) as unknown as NormalizedCastMember[]).map((member) => member.id);

  const picks: Series[] = [];
  const addUnique = (candidates: Series[]) => {
    for (const candidate of candidates) {
      if (picks.length >= RESULT_LIMIT) return;
      if (candidate.id === series.id) continue;
      if (picks.some((existing) => existing.id === candidate.id)) continue;
      picks.push(candidate);
    }
  };

  // Fase 23 — ordem de prioridade interna, preenchendo os 5 slots ate esgotar.
  addUnique(await getTmdbLocalMatches(externalIdRow?.externalId ?? null, fetchTmdbSimilarSeries));
  if (picks.length < RESULT_LIMIT) addUnique(await getTmdbLocalMatches(externalIdRow?.externalId ?? null, fetchTmdbRecommendedSeries));
  if (picks.length < RESULT_LIMIT) addUnique(dedupeById(await getSameGenreSeries(series)));
  if (picks.length < RESULT_LIMIT) addUnique(await getSameCreatorSeries(series));
  if (picks.length < RESULT_LIMIT) addUnique(await getSameCastSeries(series.id, seriesCastIds));
  if (picks.length < RESULT_LIMIT) addUnique(await getPopularSeries(series.id));

  // Fase 24 — sem fonte de dado curada pra franquias oficiais (TMDb TV nao expoe
  // `belongs_to_collection`, exclusivo de filmes); sempre vazio ate essa fonte existir.
  const officialUniverse: Series[] = [];

  return { youMayLike: picks.slice(0, RESULT_LIMIT), officialUniverse };
}
