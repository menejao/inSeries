import { prisma } from "@/lib/db/prisma";
import { canUseDatabase } from "@/lib/db/health";
import { searchSeries, toSeriesSummary } from "@/lib/discovery/search";
import { fetchTmdbSimilarSeries, fetchTmdbRecommendedSeries, TmdbConfigurationError } from "@/lib/tmdb/service";
import { getTmdbCredentials } from "@/lib/config";
import type { NormalizedCastMember } from "@/lib/catalog/normalize";
import type { Series } from "@/lib/types";

const RESULT_LIMIT = 5;

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

const RELATED_CANDIDATE_POOL = 150;

function jaccard(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const setA = new Set(a.map((value) => value.toLowerCase()));
  const setB = new Set(b.map((value) => value.toLowerCase()));
  const intersection = [...setA].filter((value) => setB.has(value)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

/**
 * INSERIES-RECOMMENDATION-ENGINE-01 — "series nao devem ser consideradas semelhantes apenas
 * porque compartilham o genero": substitui os antigos passos "mesmo genero" (so o genero
 * principal), "mesmo criador" e "mesmo elenco" (cada um sua propria query, sem se combinar) por
 * um unico ranking local ponderando genero, keywords (temas/estilo/ambientacao — a unica fonte
 * disponivel pra essas dimensoes, ver INSERIES-DASHBOARD-PREMIUM-01), Collection Tags, elenco,
 * criador, idioma e pais de origem — a mesma logica de "multiplas camadas de similaridade" do
 * motor de recomendacoes pessoal (lib/recommendations), aqui sem depender do historico do
 * usuario (a pagina da serie e a mesma pra qualquer visitante).
 */
async function getRelatedByAffinity(series: Series, seriesCastIds: number[], excludeIds: Set<string>): Promise<Series[]> {
  if (!(await canUseDatabase())) return [];
  if (!series.genres.length && !series.keywords.length && !series.collectionTags.length) return [];

  const orClauses = [
    series.genres.length ? { genres: { hasSome: series.genres } } : null,
    series.keywords.length ? { keywords: { hasSome: series.keywords } } : null,
    series.collectionTags.length ? { collectionTags: { hasSome: series.collectionTags } } : null
  ].filter((clause): clause is NonNullable<typeof clause> => clause !== null);

  const rows = await prisma.series.findMany({
    where: { id: { notIn: [...excludeIds, series.id] }, OR: orClauses },
    take: RELATED_CANDIDATE_POOL
  });

  const castIdSet = new Set(seriesCastIds);

  const scored = rows.map((row) => {
    const summary = toSeriesSummary(row);
    const castOverlap = castIdSet.size
      ? (row.cast as unknown as NormalizedCastMember[]).filter((member) => castIdSet.has(member.id)).length
      : 0;
    const creatorOverlap = series.createdBy.length ? summary.createdBy.filter((name) => series.createdBy.includes(name)).length : 0;

    const score =
      jaccard(summary.genres, series.genres) * 0.3 +
      jaccard(summary.keywords, series.keywords) * 0.3 +
      jaccard(summary.collectionTags, series.collectionTags) * 0.15 +
      Math.min(1, castOverlap / 3) * 0.1 +
      (creatorOverlap > 0 ? 1 : 0) * 0.08 +
      (summary.language && summary.language === series.language ? 1 : 0) * 0.04 +
      (summary.originCountry.some((country) => series.originCountry.includes(country)) ? 1 : 0) * 0.03;

    return { summary, score };
  });

  return scored
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.summary);
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
  if (picks.length < RESULT_LIMIT) {
    const excludeIds = new Set(picks.map((pick) => pick.id));
    addUnique(await getRelatedByAffinity(series, seriesCastIds, excludeIds));
  }
  if (picks.length < RESULT_LIMIT) addUnique(await getPopularSeries(series.id));

  // Fase 24 — sem fonte de dado curada pra franquias oficiais (TMDb TV nao expoe
  // `belongs_to_collection`, exclusivo de filmes); sempre vazio ate essa fonte existir.
  const officialUniverse: Series[] = [];

  return { youMayLike: picks.slice(0, RESULT_LIMIT), officialUniverse };
}
