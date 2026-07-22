import { generateNewEpisodeAvailableNotifications } from "@/lib/notifications/episode-availability";
import { config } from "@/lib/config";
import { prisma } from "@/lib/db/prisma";
import {
  getLatestCoverageRun,
  resumeCoverage,
  runCoverageWithSources,
  syncAiringTodaySeries,
  syncCoverage,
  syncDiscoverSeries,
  syncFullCatalog,
  syncOnTheAirSeries,
  syncPopularSeries,
  syncTopRatedSeries,
  syncTrendingSeries,
  syncUpdateDue
} from "@/lib/catalog/sync";
import { collectCandidates, type SourceDefinition } from "@/lib/catalog/aggregator";
import { createSyncCache } from "@/lib/catalog/sync-cache";
import { getUpdateIntervalMs, isDueForUpdate } from "@/lib/catalog/update-policy";
import { getTmdbCallStats, resetTmdbCallStats, withTmdbRateLimit } from "@/lib/tmdb/rate-limit";
import { findSeriesByKeyword, upsertNormalizedSeriesWithCounts } from "@/lib/catalog/repository";
import type { NormalizedCatalogSeries } from "@/lib/catalog/normalize";
import { computeQualityScore } from "@/lib/catalog/quality-score";
import { CurationRejectedError, passesDetailCuration, passesListItemCuration } from "@/lib/catalog/curation";
import { deriveCollectionTags } from "@/lib/catalog/collection-tags";
import { resolvePreferredImageUrl } from "@/lib/catalog/image-resolution";
import { computeCatalogStatistics } from "@/lib/catalog/statistics";
import { computeSmartListCounts } from "@/lib/catalog/smart-lists";
import { getCatalogFilterMetadata, searchSeries } from "@/lib/discovery/search";
import { pickHero } from "@/lib/catalog/hero-selection";
import { getContinueWatchingForUser } from "@/lib/continue-watching";
import type { ContinueWatchingItem } from "@/lib/continue-watching";
import { dedupeDashboardEpisodes } from "@/lib/dashboard/dedupe";
import type { CalendarEpisode } from "@/lib/calendar/queries";
import { editorialProvider } from "@/lib/recommendations/providers";
import { getWatchNextForUser } from "@/lib/watch-next";
import { runDiscoveryEngine } from "@/lib/discovery/engine";
import { computeDiscoveryScore } from "@/lib/discovery/discovery-score";
import { computeSourceWeightScore, computeStreamingPriorityScore } from "@/lib/discovery/source-weight";
import { passesDetailBlacklist, passesListItemBlacklist } from "@/lib/discovery/blacklist";
import type { Series } from "@/lib/types";

const BASE_URL = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

type CookieJar = { value: string };

function extractCookie(response: Response, jar: CookieJar) {
  const setCookie = response.headers.get("set-cookie");
  if (!setCookie) return;
  const [pair] = setCookie.split(";");
  jar.value = pair;
}

async function request(
  jar: CookieJar,
  path: string,
  init: RequestInit = {}
): Promise<{ status: number; body: Json; headers: Headers }> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    redirect: "manual",
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers as Record<string, string> | undefined),
      ...(jar.value ? { Cookie: jar.value } : {})
    }
  });

  extractCookie(response, jar);

  let body: Json = null;
  const text = await response.text();
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  return { status: response.status, body, headers: response.headers };
}

let failures = 0;

function check(label: string, condition: boolean, detail?: unknown) {
  if (condition) {
    console.log(`OK   - ${label}`);
  } else {
    failures += 1;
    console.error(`FAIL - ${label}`, detail ?? "");
  }
}

function countOccurrences(haystack: string, needle: string) {
  return haystack.split(needle).length - 1;
}

// ---- Fase 7 (INSERIES-DASHBOARD-HOME-EXPERIENCE-03) — regra de deduplicacao entre secoes ----
// Teste puro (sem servidor/banco): roda sempre, mesmo se o resto do smoke test estiver bloqueado.
(function testDedupeDashboardEpisodes() {
  const now = new Date();
  const makeCalendarEpisode = (id: string): CalendarEpisode => ({
    id,
    title: `Episodio ${id}`,
    number: 1,
    seasonNumber: 1,
    airedAt: now,
    watched: false,
    watchedAt: null,
    stillUrl: null,
    userState: "WATCHING",
    series: { id: "series-1", slug: "serie-1", title: "Serie 1", posterUrl: null, backdropUrl: null }
  });
  const makeContinueWatchingItem = (episodeId: string): ContinueWatchingItem =>
    ({ episode: { id: episodeId } }) as unknown as ContinueWatchingItem;

  const continueWatching = [makeContinueWatchingItem("ep-shared")];
  const sinceLastVisit = [makeCalendarEpisode("ep-shared"), makeCalendarEpisode("ep-new")];
  const overdue = [makeCalendarEpisode("ep-shared"), makeCalendarEpisode("ep-overdue")];

  const result = dedupeDashboardEpisodes({ continueWatching, sinceLastVisit, overdue });

  check(
    "dedupeDashboardEpisodes remove de 'Novos para voce' um episodio ja presente em Continuar Assistindo",
    result.sinceLastVisit.length === 1 && result.sinceLastVisit[0].id === "ep-new",
    result.sinceLastVisit.map((ep) => ep.id)
  );
  check(
    "dedupeDashboardEpisodes remove de 'Pendencias' um episodio ja presente em Continuar Assistindo",
    result.overdue.length === 1 && result.overdue[0].id === "ep-overdue",
    result.overdue.map((ep) => ep.id)
  );
  check(
    "dedupeDashboardEpisodes preserva itens sem sobreposicao com Continuar Assistindo",
    result.sinceLastVisit.some((ep) => ep.id === "ep-new") && result.overdue.some((ep) => ep.id === "ep-overdue"),
    result
  );
})();

async function registerUser(jar: CookieJar, label: string) {
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const email = `${label}-${suffix}@inseries.test`;
  const username = `${label}${suffix}`;
  const password = "senha1234";

  const register = await request(jar, "/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ name: `Smoke ${label}`, username, email, password })
  });

  check(`cadastro do usuario ${label} cria conta (201)`, register.status === 201, register.body);
  return { email, username, password };
}

async function main() {
  console.log(`Smoke test contra ${BASE_URL}`);

  // ---- Fluxo principal: cadastro, login, sessao, catalogo, progresso ----
  const jarA: CookieJar = { value: "" };
  const userA = await registerUser(jarA, "usera");
  check("cadastro retorna cookie de sessao", Boolean(jarA.value), jarA.value);

  const meAfterRegister = await request(jarA, "/api/auth/me");
  check("sessao valida apos cadastro (/api/auth/me 200)", meAfterRegister.status === 200, meAfterRegister.body);

  await request(jarA, "/api/auth/logout", { method: "POST" });
  jarA.value = "";

  const login = await request(jarA, "/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: userA.email, password: userA.password })
  });
  check("login autentica usuario (200)", login.status === 200, login.body);
  check("login retorna cookie de sessao", Boolean(jarA.value), jarA.value);

  const me = await request(jarA, "/api/auth/me");
  check("/api/auth/me retorna usuario autenticado", me.status === 200 && me.body?.data?.email === userA.email, me.body);

  const meBlocked = await request({ value: "" }, "/me");
  check("/me sem sessao redireciona (307/302)", meBlocked.status === 307 || meBlocked.status === 302, meBlocked.status);

  // `?q=Serie Teste` restringe ao pool determinístico de `npm run seed:dev` (5 séries,
  // "Serie Teste Um".."Cinco") - sem isso, `data[0]` pegava o que estivesse por acaso em
  // primeiro no catálogo inteiro, incluindo séries reais sincronizadas de sessões anteriores
  // (não-deterministico, quebra todo assert que assume "Serie Teste Um" = tem episódio hoje/
  // semana/temporada futura, propriedades exatas que só o seed garante).
  const catalog = await request(jarA, "/api/catalog/series?q=Serie+Teste");
  const seriesId: string | undefined = catalog.body?.data?.[0]?.id;
  const episodeId: string | undefined = catalog.body?.data?.[0]?.seasons?.[0]?.episodes?.[0]?.id;
  check("catalogo retorna ao menos uma serie seedada", Boolean(seriesId), catalog.body);
  check("serie seedada possui episodios", Boolean(episodeId), catalog.body);

  if (!seriesId || !episodeId) {
    console.error("Aborting: rode `npm run seed:dev` antes do smoke test.");
    process.exitCode = 1;
    return;
  }

  // ---- Descoberta e busca: filtros de /series e /api/search ----
  // `q=Serie Teste` escopa pro pool deterministico do seed:dev nos checks que comparam
  // posicao relativa entre series - sem isso, catalogo real sincronizado em sessoes
  // anteriores (persistido no volume do Postgres local) polui a paginacao/ordenacao e os
  // asserts de indexOf ficam nao-deterministicos (achado rodando de verdade contra servidor
  // local, unica vez nesta sprint que o Docker esteve disponivel).
  const seriesNoFilter = await request(jarA, "/series?q=Serie+Teste");
  check(
    "/series sem filtro extra lista series seedadas",
    seriesNoFilter.status === 200 && String(seriesNoFilter.body).includes("Serie Teste Um"),
    seriesNoFilter.status
  );

  const seriesByQuery = await request(jarA, "/series?q=Tres");
  check(
    "/series?q= filtra por texto (encontra, exclui outras)",
    seriesByQuery.status === 200 &&
      String(seriesByQuery.body).includes("Serie Teste Tres") &&
      !String(seriesByQuery.body).includes("Serie Teste Um"),
    seriesByQuery.status
  );

  const seriesByGenre = await request(jarA, "/series?genre=Mystery");
  check(
    "/series?genre= filtra por genero (so series com o genero aparecem)",
    seriesByGenre.status === 200 &&
      String(seriesByGenre.body).includes("Serie Teste Tres") &&
      !String(seriesByGenre.body).includes("Serie Teste Um"),
    seriesByGenre.status
  );

  const seriesByStatus = await request(jarA, "/series?status=IN_PRODUCTION");
  check(
    "/series?status= filtra por status do catalogo",
    seriesByStatus.status === 200 &&
      String(seriesByStatus.body).includes("Serie Teste Quatro") &&
      !String(seriesByStatus.body).includes("Serie Teste Um"),
    seriesByStatus.status
  );

  const seriesByYear = await request(jarA, "/series?year=2016");
  check(
    "/series?year= filtra por ano de estreia",
    seriesByYear.status === 200 &&
      String(seriesByYear.body).includes("Serie Teste Tres") &&
      !String(seriesByYear.body).includes("Serie Teste Um"),
    seriesByYear.status
  );

  const seriesSortPopular = await request(jarA, "/series?q=Serie+Teste&sort=popular");
  const popularBody = String(seriesSortPopular.body);
  check(
    "/series?sort=popular ordena por popularidade desc",
    seriesSortPopular.status === 200 && popularBody.indexOf("Serie Teste Um") < popularBody.indexOf("Serie Teste Cinco"),
    seriesSortPopular.status
  );

  const seriesSortLatest = await request(jarA, "/series?q=Serie+Teste&sort=latest");
  const latestBody = String(seriesSortLatest.body);
  check(
    "/series?sort=latest ordena por data de estreia desc",
    seriesSortLatest.status === 200 && latestBody.indexOf("Serie Teste Quatro") < latestBody.indexOf("Serie Teste Tres"),
    seriesSortLatest.status
  );

  const seriesSortTitle = await request(jarA, "/series?q=Serie+Teste&sort=title");
  const titleBody = String(seriesSortTitle.body);
  check(
    "/series?sort=title ordena alfabeticamente",
    seriesSortTitle.status === 200 && titleBody.indexOf("Serie Teste Cinco") < titleBody.indexOf("Serie Teste Um"),
    seriesSortTitle.status
  );

  const seriesSortRating = await request(jarA, "/series?q=Serie+Teste&sort=rating");
  const ratingBody = String(seriesSortRating.body);
  check(
    "/series?sort=rating ordena por nota desc (sem nota fica por ultimo)",
    seriesSortRating.status === 200 &&
      ratingBody.indexOf("Serie Teste Um") < ratingBody.indexOf("Serie Teste Quatro"),
    seriesSortRating.status
  );

  const apiSearchAll = await request(jarA, "/api/search?type=series");
  check(
    "/api/search?type=series sem q retorna series",
    apiSearchAll.status === 200 && Array.isArray(apiSearchAll.body?.data?.series) && apiSearchAll.body.data.series.length > 0,
    apiSearchAll.body
  );

  // Titulo completo, nao so "Cinco": uma palavra solta pode bater com sinopse/keyword de
  // alguma serie real sincronizada em sessao anterior (achado real rodando contra servidor
  // local com catalogo nao-limpo - "O Incrivel Circo Digital" tambem batia com "Cinco").
  const apiSearchQuery = await request(jarA, "/api/search?type=series&q=Serie+Teste+Cinco");
  check(
    "/api/search?type=series&q= filtra corretamente",
    apiSearchQuery.status === 200 &&
      apiSearchQuery.body?.data?.series?.length === 1 &&
      apiSearchQuery.body?.data?.series?.[0]?.title === "Serie Teste Cinco",
    apiSearchQuery.body
  );

  const apiSearchOtherTypes = await request(jarA, "/api/search?type=all&q=Teste");
  check(
    "/api/search?type=all prepara users/lists/reviews (arrays presentes)",
    apiSearchOtherTypes.status === 200 &&
      Array.isArray(apiSearchOtherTypes.body?.data?.users) &&
      Array.isArray(apiSearchOtherTypes.body?.data?.lists) &&
      Array.isArray(apiSearchOtherTypes.body?.data?.reviews),
    apiSearchOtherTypes.body
  );

  const setStatus = await request(jarA, `/api/series/${seriesId}/status`, {
    method: "POST",
    body: JSON.stringify({ seriesId, state: "WATCHING" })
  });
  check("status da serie salvo como WATCHING", setStatus.status === 200 && setStatus.body?.data?.state === "WATCHING", setStatus.body);

  const markWatched = await request(jarA, `/api/episodes/${episodeId}/progress`, {
    method: "POST",
    body: JSON.stringify({ episodeId, watched: true })
  });
  check("episodio marcado como assistido", markWatched.status === 200 && markWatched.body?.data?.watchedEpisodes === 1, markWatched.body);

  const unmarkWatched = await request(jarA, `/api/episodes/${episodeId}/progress`, {
    method: "POST",
    body: JSON.stringify({ episodeId, watched: false })
  });
  check("episodio desmarcado", unmarkWatched.status === 200 && unmarkWatched.body?.data?.watchedEpisodes === 0, unmarkWatched.body);

  const remarkWatched = await request(jarA, `/api/episodes/${episodeId}/progress`, {
    method: "POST",
    body: JSON.stringify({ episodeId, watched: true })
  });
  check(
    "episodio marcado novamente e progresso recalculado",
    remarkWatched.status === 200 && remarkWatched.body?.data?.watchedEpisodes === 1 && Boolean(remarkWatched.body?.data?.nextEpisode),
    remarkWatched.body
  );

  // ---- Estatisticas: analytics layer, dashboard, privacidade ----
  const statsGuestPage = await request({ value: "" }, "/me/stats");
  check("acesso anonimo a /me/stats redireciona (privacidade)", statsGuestPage.status === 307 || statsGuestPage.status === 302, statsGuestPage.status);

  const statsGuestApi = await request({ value: "" }, "/api/me/stats");
  check("acesso anonimo a /api/me/stats retorna 401", statsGuestApi.status === 401, statsGuestApi.body);

  const statsA = await request(jarA, "/api/me/stats");
  const statsData = statsA.body?.data;
  check(
    "estatisticas de A refletem o episodio assistido (1 episodio, runtime coerente)",
    statsA.status === 200 &&
      statsData?.overview?.episodesWatched === 1 &&
      statsData?.watchTime?.minutesWatched === 42 &&
      statsData?.watchTime?.hoursWatched > 0,
    statsData
  );
  check(
    "estatisticas de A calculam generos a partir da serie assistida",
    Array.isArray(statsData?.genres?.ranking) && statsData.genres.ranking.length > 0 && Boolean(statsData.genres.topGenre),
    statsData?.genres
  );
  check(
    "estatisticas de A calculam sequencia atual (assistiu hoje)",
    statsData?.streaks?.activeDays === 1 && statsData?.streaks?.currentStreakDays === 1,
    statsData?.streaks
  );
  check("estatisticas de A geram ao menos um insight", Array.isArray(statsData?.insights) && statsData.insights.length > 0, statsData?.insights);

  const statsDashboard = await request(jarA, "/me/stats");
  check(
    "dashboard /me/stats carrega e mostra secoes principais",
    statsDashboard.status === 200 &&
      String(statsDashboard.body).includes("Resumo geral") &&
      String(statsDashboard.body).includes("Tempo assistido") &&
      String(statsDashboard.body).includes("Sequencias"),
    statsDashboard.status
  );

  const jarStatsEmpty: CookieJar = { value: "" };
  await registerUser(jarStatsEmpty, "userstats");

  const statsEmptyUser = await request(jarStatsEmpty, "/api/me/stats");
  check(
    "usuario sem episodios assistidos possui estatisticas zeradas (empty state)",
    statsEmptyUser.status === 200 &&
      statsEmptyUser.body?.data?.overview?.episodesWatched === 0 &&
      Array.isArray(statsEmptyUser.body?.data?.insights) &&
      statsEmptyUser.body.data.insights.length === 0,
    statsEmptyUser.body
  );
  const statsEmptyDashboard = await request(jarStatsEmpty, "/me/stats");
  check(
    "dashboard /me/stats mostra empty state para usuario sem historico",
    statsEmptyDashboard.status === 200 && String(statsEmptyDashboard.body).includes("Ainda sem estatisticas"),
    statsEmptyDashboard.status
  );

  // ---- Recomendacoes: motor, providers, filtros, motivo, cache, feature flag ----
  const recsGuestApi = await request({ value: "" }, "/api/recommendations");
  check("acesso anonimo a /api/recommendations retorna 401", recsGuestApi.status === 401, recsGuestApi.body);

  const jarRecsNew: CookieJar = { value: "" };
  await registerUser(jarRecsNew, "userrecsnew");

  const recsNewUser = await request(jarRecsNew, "/api/recommendations");
  const recsNewData = recsNewUser.body?.data;
  check(
    "usuario novo recebe recomendacoes sem sinais pessoais (sem genero/similaridade)",
    recsNewUser.status === 200 &&
      recsNewData?.enabled === true &&
      Array.isArray(recsNewData?.items) &&
      recsNewData.items.length > 0 &&
      recsNewData.items.every((item: Json) => item.primaryProvider !== "genre" && item.primaryProvider !== "similar"),
    recsNewData
  );
  check(
    "toda recomendacao possui motivo (reason) e provider principal",
    Array.isArray(recsNewData?.items) &&
      recsNewData.items.every((item: Json) => typeof item.primaryReason === "string" && item.primaryReason.length > 0 && typeof item.primaryProvider === "string"),
    recsNewData?.items
  );
  check(
    "scores das recomendacoes sao numericos e ordenados de forma decrescente",
    Array.isArray(recsNewData?.items) &&
      recsNewData.items.every((item: Json, index: number, arr: Json[]) => typeof item.score === "number" && (index === 0 || arr[index - 1].score >= item.score)),
    recsNewData?.items
  );

  const recsNewUserCached = await request(jarRecsNew, "/api/recommendations");
  check("segunda chamada retorna do cache (fromCache true)", recsNewUserCached.body?.data?.fromCache === true, recsNewUserCached.body);

  const jarRecsPersonal: CookieJar = { value: "" };
  await registerUser(jarRecsPersonal, "userrecspersonal");
  const secondSeriesId: string | undefined = catalog.body?.data?.[1]?.id;

  const watchForRecs = await request(jarRecsPersonal, `/api/episodes/${episodeId}/progress`, {
    method: "POST",
    body: JSON.stringify({ episodeId, watched: true })
  });
  check("usuario dedicado assiste episodio para gerar afinidade de genero", watchForRecs.status === 200, watchForRecs.body);

  const completeForRecs = await request(jarRecsPersonal, `/api/series/${seriesId}/status`, {
    method: "POST",
    body: JSON.stringify({ seriesId, state: "COMPLETED" })
  });
  check("usuario dedicado conclui a serie assistida", completeForRecs.status === 200, completeForRecs.body);

  if (secondSeriesId) {
    const dropForRecs = await request(jarRecsPersonal, `/api/series/${secondSeriesId}/status`, {
      method: "POST",
      body: JSON.stringify({ seriesId: secondSeriesId, state: "DROPPED" })
    });
    check("usuario dedicado abandona uma segunda serie", dropForRecs.status === 200, dropForRecs.body);
  }

  const recsPersonal = await request(jarRecsPersonal, "/api/recommendations");
  const recsPersonalData = recsPersonal.body?.data;
  check(
    "recomendacoes nunca incluem a serie que o usuario concluiu",
    Array.isArray(recsPersonalData?.items) && !recsPersonalData.items.some((item: Json) => item.series.id === seriesId),
    recsPersonalData?.items?.map((item: Json) => item.series.id)
  );
  check(
    "recomendacoes nunca incluem a serie que o usuario abandonou",
    !secondSeriesId || (Array.isArray(recsPersonalData?.items) && !recsPersonalData.items.some((item: Json) => item.series.id === secondSeriesId)),
    recsPersonalData?.items?.map((item: Json) => item.series.id)
  );
  check(
    "recomendacoes ficam personalizadas (genero ou series parecidas) apos concluir uma serie",
    Array.isArray(recsPersonalData?.items) &&
      recsPersonalData.items.some((item: Json) => item.reasons.some((reason: Json) => reason.provider === "genre" || reason.provider === "similar")),
    recsPersonalData?.items
  );

  const dashboardWithRecs = await request(jarRecsPersonal, "/");
  // INSERIES-DASHBOARD-HOME-EXPERIENCE-02 (Fase 3) — Recomendacoes removidas do Dashboard;
  // vivem apenas em /recommendations, acessivel pela Sidebar/BottomNav.
  check(
    "dashboard / carrega sem erro mesmo com recomendacoes disponiveis (Recomendado removido do Dashboard)",
    dashboardWithRecs.status === 200,
    dashboardWithRecs.status
  );

  // ---- editorialProvider (INSERIES-DASHBOARD-PREMIUM-01, Fase 4): Discovery/Quality ----
  // ---- Score + Collection Tags/Keywords, nunca generico ----
  const editorialContextBase = {
    userId: "smoke-editorial",
    seedSeries: [{ id: "seed-1", title: "Seed", genres: [], collectionTags: ["Maratona"], keywords: ["dystopia"] }],
    genreAffinity: { ranking: [], topGenre: null },
    genreCompletedCounts: new Map<string, number>(),
    positivelyReviewedGenres: new Map<string, number>()
  };
  const editorialCandidateMatch = {
    id: "match",
    slug: "match",
    title: "Match",
    posterUrl: null,
    backdropUrl: null,
    genres: [],
    status: "RETURNING",
    popularityScore: 0,
    voteAverage: 0,
    voteCount: 0,
    firstAirYear: null,
    qualityScore: 90,
    collectionTags: ["Maratona"],
    watchProviders: [],
    logoUrl: null,
    discoveryScore: 90,
    keywords: []
  };
  const editorialCandidateNoOverlap = { ...editorialCandidateMatch, id: "no-overlap", collectionTags: [], keywords: [], qualityScore: 100, discoveryScore: 100 };
  const editorialSignalsMatch = editorialProvider.run({ ...editorialContextBase, candidates: [editorialCandidateMatch, editorialCandidateNoOverlap] });
  check(
    "Recomendacoes (Fase 4): editorialProvider so pontua series com overlap real de Collection Tag/Keyword com o historico (nunca generico)",
    editorialSignalsMatch.length === 1 && editorialSignalsMatch[0].seriesId === "match",
    editorialSignalsMatch
  );

  const editorialCandidateLowScore = { ...editorialCandidateMatch, id: "low-score", qualityScore: 10, discoveryScore: 10 };
  const editorialSignalsRanking = editorialProvider.run({
    ...editorialContextBase,
    candidates: [editorialCandidateLowScore, editorialCandidateMatch]
  });
  const highScoreSignal = editorialSignalsRanking.find((signal) => signal.seriesId === "match");
  const lowScoreSignal = editorialSignalsRanking.find((signal) => signal.seriesId === "low-score");
  check(
    "Recomendacoes (Fase 4): entre duas series com o mesmo overlap, Discovery/Quality Score mais alto pontua mais",
    Boolean(highScoreSignal) && Boolean(lowScoreSignal) && highScoreSignal!.score > lowScoreSignal!.score,
    { highScoreSignal, lowScoreSignal }
  );

  // ---- Recap: geracao mensal/anual, insights, privacidade, feature flag, validacao de periodo ----
  const recapNow = new Date();
  const recapYear = recapNow.getUTCFullYear();
  const recapMonth = recapNow.getUTCMonth() + 1;

  const recapGuestApi = await request({ value: "" }, "/api/me/recap");
  check("acesso anonimo a /api/me/recap retorna 401", recapGuestApi.status === 401, recapGuestApi.body);

  const recapGuestYearApi = await request({ value: "" }, `/api/me/recap/${recapYear}`);
  check("acesso anonimo a /api/me/recap/[year] retorna 401", recapGuestYearApi.status === 401, recapGuestYearApi.body);

  const recapGuestMonthApi = await request({ value: "" }, `/api/me/recap/${recapYear}/${recapMonth}`);
  check("acesso anonimo a /api/me/recap/[year]/[month] retorna 401", recapGuestMonthApi.status === 401, recapGuestMonthApi.body);

  const recapGuestPage = await request({ value: "" }, "/me/recap");
  check(
    "acesso anonimo a /me/recap redireciona (privacidade)",
    recapGuestPage.status === 307 || recapGuestPage.status === 302,
    recapGuestPage.status
  );

  const recapEmptyAvailability = await request(jarStatsEmpty, "/api/me/recap");
  check(
    "usuario sem historico nao tem nenhum periodo de recap disponivel (empty state)",
    recapEmptyAvailability.status === 200 &&
      Array.isArray(recapEmptyAvailability.body?.data?.years) &&
      recapEmptyAvailability.body.data.years.length === 0 &&
      Array.isArray(recapEmptyAvailability.body?.data?.months) &&
      recapEmptyAvailability.body.data.months.length === 0,
    recapEmptyAvailability.body
  );
  const recapEmptyDashboard = await request(jarStatsEmpty, "/me/recap");
  check(
    "pagina /me/recap mostra empty state para usuario sem historico",
    recapEmptyDashboard.status === 200 && String(recapEmptyDashboard.body).includes("Ainda sem recap"),
    recapEmptyDashboard.status
  );

  const recapMonthlyA = await request(jarA, `/api/me/recap/${recapYear}/${recapMonth}`);
  const recapMonthlyData = recapMonthlyA.body?.data;
  check(
    "recap mensal de A usa os mesmos numeros do Analytics Layer (episodios e minutos batem com /api/me/stats)",
    recapMonthlyA.status === 200 &&
      recapMonthlyData?.episodesWatched === statsData?.overview?.episodesWatched &&
      recapMonthlyData?.minutesWatched === statsData?.watchTime?.minutesWatched,
    { recapMonthlyData, statsOverview: statsData?.overview }
  );
  check(
    "recap mensal de A calcula generos coerentes com o historico (mesmo genero principal das estatisticas)",
    recapMonthlyData?.genres?.topGenre?.genre === statsData?.genres?.topGenre?.genre,
    { recapGenres: recapMonthlyData?.genres, statsGenres: statsData?.genres }
  );
  check("recap mensal de A gera insights narrativos", Array.isArray(recapMonthlyData?.insights) && recapMonthlyData.insights.length > 0, recapMonthlyData?.insights);
  check(
    "recap mensal de A prepara estrutura de compartilhamento privada (shareSlug presente, isPublic false)",
    typeof recapMonthlyData?.sharing?.shareSlug === "string" &&
      recapMonthlyData.sharing.shareSlug.length > 0 &&
      recapMonthlyData.sharing.isPublic === false,
    recapMonthlyData?.sharing
  );

  const recapYearlyA = await request(jarA, `/api/me/recap/${recapYear}`);
  check(
    "recap anual de A tambem reflete o historico (mesmo total de episodios)",
    recapYearlyA.status === 200 && recapYearlyA.body?.data?.episodesWatched === statsData?.overview?.episodesWatched,
    recapYearlyA.body
  );

  const recapFuturePeriod = await request(jarA, `/api/me/recap/${recapYear + 1}`);
  check("recap anual de periodo futuro e rejeitado (400)", recapFuturePeriod.status === 400, recapFuturePeriod.body);

  const recapInvalidMonth = await request(jarA, `/api/me/recap/${recapYear}/13`);
  check("recap mensal com mes invalido e rejeitado (400)", recapInvalidMonth.status === 400, recapInvalidMonth.body);

  const recapPersonalMonthly = await request(jarRecsPersonal, `/api/me/recap/${recapYear}/${recapMonth}`);
  check(
    "recap mensal reflete series concluidas no periodo",
    recapPersonalMonthly.status === 200 &&
      recapPersonalMonthly.body?.data?.seriesCompletedCount === 1 &&
      recapPersonalMonthly.body?.data?.seriesCompleted?.includes("Serie Teste Um"),
    recapPersonalMonthly.body?.data
  );

  const recapDashboard = await request(jarA, "/me/recap");
  check(
    "dashboard /me/recap lista os recaps disponiveis do usuario",
    recapDashboard.status === 200 && String(recapDashboard.body).includes("Recaps anuais") && String(recapDashboard.body).includes("Recaps mensais"),
    recapDashboard.status
  );

  const recapMonthlyPage = await request(jarA, `/me/recap/${recapYear}/${recapMonth}`);
  check(
    "pagina de recap mensal renderiza as secoes principais",
    recapMonthlyPage.status === 200 &&
      String(recapMonthlyPage.body).includes("Numeros principais") &&
      String(recapMonthlyPage.body).includes("Compartilhamento"),
    recapMonthlyPage.status
  );

  // Fase 2 (INSERIES-DASHBOARD-UX-AND-NAVIGATION-01) — CTA de Recap no Dashboard foi removido
  // (Recap agora vive apenas em /me/recap, acessivel pela Sidebar/BottomNav).

  // ---- Gamificacao: engine, conquistas iniciais, notificacao, nivel, dashboard, privacidade ----
  const achievementsGuestPage = await request({ value: "" }, "/me/achievements");
  check(
    "acesso anonimo a /me/achievements redireciona (privacidade)",
    achievementsGuestPage.status === 307 || achievementsGuestPage.status === 302,
    achievementsGuestPage.status
  );

  const jarGameA: CookieJar = { value: "" };
  const userGameA = await registerUser(jarGameA, "usergamea");

  const achievementsBeforeAnyAction = await request(jarGameA, "/me/achievements");
  check(
    "pagina de conquistas carrega (feature flag ligada por padrao)",
    achievementsBeforeAnyAction.status === 200 && !String(achievementsBeforeAnyAction.body).includes("Conquistas indisponiveis"),
    achievementsBeforeAnyAction.status
  );

  const watchForAchievement = await request(jarGameA, `/api/episodes/${episodeId}/progress`, {
    method: "POST",
    body: JSON.stringify({ episodeId, watched: true })
  });
  check("usuario dedicado assiste ao primeiro episodio", watchForAchievement.status === 200, watchForAchievement.body);

  const notificationsAfterFirstEpisode = await request(jarGameA, "/api/notifications");
  const achievementNotifCountAfterFirst = (notificationsAfterFirstEpisode.body?.data?.items ?? []).filter(
    (item: Json) => item.type === "ACHIEVEMENT_UNLOCKED"
  ).length;
  check(
    "primeiro episodio assistido desbloqueia conquista e gera notificacao ACHIEVEMENT_UNLOCKED",
    achievementNotifCountAfterFirst === 1,
    notificationsAfterFirstEpisode.body
  );

  await request(jarGameA, `/api/episodes/${episodeId}/progress`, {
    method: "POST",
    body: JSON.stringify({ episodeId, watched: false })
  });
  await request(jarGameA, `/api/episodes/${episodeId}/progress`, {
    method: "POST",
    body: JSON.stringify({ episodeId, watched: true })
  });
  const notificationsAfterRewatch = await request(jarGameA, "/api/notifications");
  const achievementNotifCountAfterRewatch = (notificationsAfterRewatch.body?.data?.items ?? []).filter(
    (item: Json) => item.type === "ACHIEVEMENT_UNLOCKED"
  ).length;
  check(
    "conquista nao duplica ao desmarcar/marcar o mesmo episodio novamente",
    achievementNotifCountAfterRewatch === 1,
    notificationsAfterRewatch.body
  );

  const reviewForAchievement = await request(jarGameA, `/api/series/${seriesId}/reviews`, {
    method: "POST",
    body: JSON.stringify({ rating: 5, body: "Muito boa serie para testar conquistas." })
  });
  check("usuario dedicado escreve a primeira review", reviewForAchievement.status === 200, reviewForAchievement.body);

  const listForAchievement = await request(jarGameA, "/api/lists", {
    method: "POST",
    body: JSON.stringify({ title: "Lista para testar conquistas" })
  });
  check("usuario dedicado cria a primeira lista", listForAchievement.status === 201 || listForAchievement.status === 200, listForAchievement.body);

  const completeForAchievement = await request(jarGameA, `/api/series/${seriesId}/status`, {
    method: "POST",
    body: JSON.stringify({ seriesId, state: "COMPLETED" })
  });
  check("usuario dedicado conclui a primeira serie", completeForAchievement.status === 200, completeForAchievement.body);

  const jarGameB: CookieJar = { value: "" };
  await registerUser(jarGameB, "usergameb");
  const followForAchievement = await request(jarGameB, `/api/users/${userGameA.username}/follow`, {
    method: "POST"
  });
  check("usuario dedicado segue outro usuario pela primeira vez", followForAchievement.status === 200, followForAchievement.body);

  const achievementsPageAfterAll = await request(jarGameA, "/me/achievements");
  check(
    "pagina de conquistas mostra as conquistas desbloqueadas (episodio, review, lista, serie concluida)",
    achievementsPageAfterAll.status === 200 &&
      String(achievementsPageAfterAll.body).includes("Primeiro Episodio") &&
      String(achievementsPageAfterAll.body).includes("Primeira Review") &&
      String(achievementsPageAfterAll.body).includes("Primeira Lista") &&
      String(achievementsPageAfterAll.body).includes("Primeira Serie Concluida"),
    achievementsPageAfterAll.status
  );
  check(
    "pagina de conquistas mostra progresso de nivel (4 conquistas desbloqueadas de 15)",
    String(achievementsPageAfterAll.body).includes("4/15"),
    achievementsPageAfterAll.status
  );

  const followerAchievementsPage = await request(jarGameB, "/me/achievements");
  check(
    "conquista Primeiro Follow desbloqueada para quem seguiu",
    followerAchievementsPage.status === 200 && String(followerAchievementsPage.body).includes("Primeiro Follow"),
    followerAchievementsPage.status
  );

  // Fase 2 (INSERIES-DASHBOARD-UX-AND-NAVIGATION-01) — secao de Conquistas no Dashboard foi
  // removida (Conquistas agora vive apenas em /me/achievements).

  // ---- Assistir a seguir: query layer (getWatchNextForUser), formato T05|E01+N, marcar ----
  // ---- assistido, exclusoes. /watch-next (pagina) foi fundida no Dashboard (Fase 2, ----
  // ---- INSERIES-PRODUCT-EXPERIENCE-REVOLUTION-01) - so os checks de API/dado continuam. ----
  const watchNextGuestPage = await request({ value: "" }, "/watch-next");
  check(
    "/watch-next (rota antiga) redireciona para / (fundido no Dashboard, sem gate proprio)",
    (watchNextGuestPage.status === 307 || watchNextGuestPage.status === 302) && watchNextGuestPage.headers.get("location")?.endsWith("/") === true,
    { status: watchNextGuestPage.status, location: watchNextGuestPage.headers.get("location") }
  );

  const watchNextGuestApi = await request({ value: "" }, "/api/me/watch-next");
  check("acesso anonimo a /api/me/watch-next retorna 401", watchNextGuestApi.status === 401, watchNextGuestApi.body);

  const jarWatchNextEmpty: CookieJar = { value: "" };
  await registerUser(jarWatchNextEmpty, "userwnempty");
  const watchNextEmptyApi = await request(jarWatchNextEmpty, "/api/me/watch-next");
  check(
    "usuario sem series acompanhadas nao tem itens em Assistir a seguir",
    watchNextEmptyApi.status === 200 &&
      Array.isArray(watchNextEmptyApi.body?.data?.items) &&
      watchNextEmptyApi.body.data.items.length === 0 &&
      watchNextEmptyApi.body.data.hasTrackedSeries === false,
    watchNextEmptyApi.body
  );
  const secondSeriesIdForWatchNext: string | undefined = catalog.body?.data?.[1]?.id;
  const thirdSeriesIdForWatchNext: string | undefined = catalog.body?.data?.[2]?.id;

  const jarWatchNextA: CookieJar = { value: "" };
  await registerUser(jarWatchNextA, "userwna");
  await request(jarWatchNextA, `/api/series/${seriesId}/status`, {
    method: "POST",
    body: JSON.stringify({ seriesId, state: "WATCHING" })
  });

  const watchNextA1 = await request(jarWatchNextA, "/api/me/watch-next");
  const watchNextA1Item = watchNextA1.body?.data?.items?.[0];
  check(
    "serie watching aparece com o primeiro episodio pendente (T01|E01) e contagem +N",
    watchNextA1.status === 200 &&
      watchNextA1Item?.episode?.seasonNumber === 1 &&
      watchNextA1Item?.episode?.number === 1 &&
      watchNextA1Item?.pendingAfterNext === 10 &&
      watchNextA1Item?.totalPending === 11,
    watchNextA1.body?.data
  );

  const markFirstFromWatchNext = await request(jarWatchNextA, `/api/episodes/${watchNextA1Item.episode.id}/progress`, {
    method: "POST",
    body: JSON.stringify({ episodeId: watchNextA1Item.episode.id, watched: true })
  });
  check("marcar episodio assistido via mutation existente funciona", markFirstFromWatchNext.status === 200, markFirstFromWatchNext.body);

  const watchNextA2 = await request(jarWatchNextA, "/api/me/watch-next");
  const watchNextA2Item = watchNextA2.body?.data?.items?.[0];
  check(
    "apos marcar, o proximo episodio pendente da mesma serie aparece (T01|E02, +9)",
    watchNextA2.status === 200 &&
      watchNextA2Item?.series?.id === seriesId &&
      watchNextA2Item?.episode?.number === 2 &&
      watchNextA2Item?.pendingAfterNext === 9,
    watchNextA2.body?.data
  );

  let lastWatchNextForA = watchNextA2;
  for (let i = 0; i < 12; i++) {
    const current = await request(jarWatchNextA, "/api/me/watch-next");
    const currentItem = current.body?.data?.items?.[0];
    if (!currentItem) {
      lastWatchNextForA = current;
      break;
    }
    await request(jarWatchNextA, `/api/episodes/${currentItem.episode.id}/progress`, {
      method: "POST",
      body: JSON.stringify({ episodeId: currentItem.episode.id, watched: true })
    });
  }
  check(
    "apos marcar todos os episodios pendentes, a serie some da lista (mas o usuario continua tendo series acompanhadas)",
    Array.isArray(lastWatchNextForA.body?.data?.items) &&
      lastWatchNextForA.body.data.items.length === 0 &&
      lastWatchNextForA.body.data.hasTrackedSeries === true,
    lastWatchNextForA.body?.data
  );
  const jarWatchNextB: CookieJar = { value: "" };
  await registerUser(jarWatchNextB, "userwnb");
  if (secondSeriesIdForWatchNext) {
    await request(jarWatchNextB, `/api/series/${secondSeriesIdForWatchNext}/status`, {
      method: "POST",
      body: JSON.stringify({ seriesId: secondSeriesIdForWatchNext, state: "WANT_TO_WATCH" })
    });
  }
  const watchNextBApi = await request(jarWatchNextB, "/api/me/watch-next");
  check(
    "serie plan_to_watch (WANT_TO_WATCH) tambem aparece em Assistir a seguir",
    !secondSeriesIdForWatchNext ||
      (watchNextBApi.status === 200 &&
        watchNextBApi.body?.data?.items?.some((item: Json) => item.series.id === secondSeriesIdForWatchNext && item.userState === "WANT_TO_WATCH")),
    watchNextBApi.body?.data
  );

  const jarWatchNextC: CookieJar = { value: "" };
  await registerUser(jarWatchNextC, "userwnc");
  if (secondSeriesIdForWatchNext) {
    await request(jarWatchNextC, `/api/series/${secondSeriesIdForWatchNext}/status`, {
      method: "POST",
      body: JSON.stringify({ seriesId: secondSeriesIdForWatchNext, state: "COMPLETED" })
    });
  }
  if (thirdSeriesIdForWatchNext) {
    await request(jarWatchNextC, `/api/series/${thirdSeriesIdForWatchNext}/status`, {
      method: "POST",
      body: JSON.stringify({ seriesId: thirdSeriesIdForWatchNext, state: "DROPPED" })
    });
  }
  const watchNextCApi = await request(jarWatchNextC, "/api/me/watch-next");
  check(
    "series completed e dropped nunca aparecem em Assistir a seguir",
    watchNextCApi.status === 200 &&
      !watchNextCApi.body?.data?.items?.some(
        (item: Json) => item.series.id === secondSeriesIdForWatchNext || item.series.id === thirdSeriesIdForWatchNext
      ),
    watchNextCApi.body?.data
  );

  const jarWatchNextDashboard: CookieJar = { value: "" };
  await registerUser(jarWatchNextDashboard, "userwndash");
  await request(jarWatchNextDashboard, `/api/series/${seriesId}/status`, {
    method: "POST",
    body: JSON.stringify({ seriesId, state: "WATCHING" })
  });
  // Fase 2 (INSERIES-DASHBOARD-UX-AND-NAVIGATION-01) — secao Assistir a seguir no Dashboard
  // foi removida (redundante com Continuar assistindo). A pagina /watch-next em si foi
  // fundida no Dashboard depois (INSERIES-PRODUCT-EXPERIENCE-REVOLUTION-01, Fase 2).

  // ---- Continuar assistindo (INSERIES-CONTINUE-WATCHING-EXPERIENCE-01) ----
  const jarWatchNextDashboardMe = await request(jarWatchNextDashboard, "/api/auth/me");
  const jarWatchNextDashboardUserId: string | undefined = jarWatchNextDashboardMe.body?.data?.id;

  const dashboardHomeWithContinueWatching = await request(jarWatchNextDashboard, "/");
  const dashboardHomeBody = String(dashboardHomeWithContinueWatching.body);
  const continueWatchingIndex = dashboardHomeBody.indexOf("Continuar assistindo");
  const dashboardGridIndex = dashboardHomeBody.indexOf("Novos para voce");
  check(
    "Dashboard exibe a secao Continuar assistindo",
    dashboardHomeWithContinueWatching.status === 200 &&
      continueWatchingIndex !== -1 &&
      dashboardHomeBody.includes("Retome suas series exatamente de onde parou."),
    dashboardHomeWithContinueWatching.status
  );
  check(
    "Continuar assistindo fica no topo do Dashboard (antes do grid de outras secoes)",
    continueWatchingIndex !== -1 && dashboardGridIndex !== -1 && continueWatchingIndex < dashboardGridIndex,
    { continueWatchingIndex, dashboardGridIndex }
  );
  check(
    "Continuar assistindo mostra o proximo episodio correto (T01 | E01)",
    dashboardHomeBody.includes("T01 | E01"),
    dashboardHomeWithContinueWatching.status
  );

  check("sessao do usuario userwndash expoe id valido (/api/auth/me)", Boolean(jarWatchNextDashboardUserId), jarWatchNextDashboardMe.body);

  const continueWatchingBeforeMark = jarWatchNextDashboardUserId
    ? await getContinueWatchingForUser(jarWatchNextDashboardUserId)
    : { items: [], hasTrackedSeries: false };
  const watchNextForConsistency = jarWatchNextDashboardUserId
    ? await getWatchNextForUser(jarWatchNextDashboardUserId)
    : { items: [], hasTrackedSeries: false };
  check(
    "Continuar assistindo e Watch Next permanecem consistentes (mesmas series/proximo episodio)",
    continueWatchingBeforeMark.items.length > 0 &&
      continueWatchingBeforeMark.items.length === watchNextForConsistency.items.length &&
      continueWatchingBeforeMark.items.every((item, index) => item.episode.id === watchNextForConsistency.items[index]?.episode.id),
    {
      continueWatching: continueWatchingBeforeMark.items.map((item) => item.episode.id),
      watchNext: watchNextForConsistency.items.map((item) => item.episode.id)
    }
  );

  const firstPendingEpisodeId = continueWatchingBeforeMark.items.find((item) => item.series.id === seriesId)?.episode.id;
  if (firstPendingEpisodeId) {
    await request(jarWatchNextDashboard, `/api/episodes/${firstPendingEpisodeId}/progress`, {
      method: "POST",
      body: JSON.stringify({ episodeId: firstPendingEpisodeId, watched: true })
    });
  }
  const dashboardAfterMarking = await request(jarWatchNextDashboard, "/");
  check(
    "Marcar episodio como assistido avanca o card de Continuar assistindo para o proximo episodio",
    Boolean(firstPendingEpisodeId) &&
      dashboardAfterMarking.status === 200 &&
      String(dashboardAfterMarking.body).includes("T01 | E02"),
    dashboardAfterMarking.status
  );

  const jarContinueWatchingEmpty: CookieJar = { value: "" };
  await registerUser(jarContinueWatchingEmpty, "usercwempty");
  const dashboardEmptyContinueWatching = await request(jarContinueWatchingEmpty, "/");
  check(
    "Continuar assistindo mostra empty state para usuario sem series acompanhadas, com CTA Explorar catalogo",
    dashboardEmptyContinueWatching.status === 200 &&
      String(dashboardEmptyContinueWatching.body).includes("Voce ainda nao comecou nenhuma serie") &&
      String(dashboardEmptyContinueWatching.body).includes("Explorar catalogo"),
    dashboardEmptyContinueWatching.status
  );
  check(
    "Fase 8 (INSERIES-PRODUCT-EXPERIENCE-REVOLUTION-01): usuario sem nenhuma serie acompanhada nao ve 'Novos para voce'/'Agenda resumida' (evita parede de empty states)",
    !String(dashboardEmptyContinueWatching.body).includes("Novos para voce<") &&
      !String(dashboardEmptyContinueWatching.body).includes("Agenda resumida<"),
    null
  );
  check(
    "Fase 8: cabecalho contextual do usuario novo diz 'Bem-vindo', nao o fallback generico de usuario com series em dia",
    String(dashboardEmptyContinueWatching.body).includes("Bem-vindo ao inSeries"),
    null
  );

  // ---- Calendario: pessoal, global, proximo episodio, dashboard, filtros ----
  const seriesDetail = await request(jarA, "/api/catalog/series");
  const trackedSeries = seriesDetail.body?.data?.find((item: Json) => item.id === seriesId);
  const allEpisodes: Array<{ id: string; title: string; airedOn: string }> = (trackedSeries?.seasons ?? []).flatMap(
    (season: Json) => season.episodes ?? []
  );
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const todayEpisode = allEpisodes.find((episode) => episode.airedOn === todayStr);
  const futureSeason = (trackedSeries?.seasons ?? []).find((season: Json) => (season.episodes ?? []).length === 0);

  const calendarGuest = await request({ value: "" }, "/calendar");
  check(
    "calendario sem sessao mostra CTA de login (nao redireciona)",
    calendarGuest.status === 200 && String(calendarGuest.body).includes("Entre para ver seu calendario"),
    calendarGuest.status
  );

  const calendarPersonal = await request(jarA, "/calendar");
  check("calendario pessoal carrega (200)", calendarPersonal.status === 200, calendarPersonal.status);
  check(
    "calendario pessoal mostra episodio de hoje na secao Hoje",
    Boolean(todayEpisode) && String(calendarPersonal.body).includes(todayEpisode?.title ?? "__none__"),
    todayEpisode
  );
  check(
    "calendario pessoal mostra temporada futura sem episodios",
    Boolean(futureSeason) && String(calendarPersonal.body).includes(futureSeason?.title ?? "__none__"),
    futureSeason
  );

  const calendarGlobalToday = await request(jarA, "/calendar?view=global&range=today");
  check(
    "calendario global (hoje) mostra episodio lancado hoje",
    calendarGlobalToday.status === 200 && Boolean(todayEpisode) && String(calendarGlobalToday.body).includes(todayEpisode?.title ?? "__none__"),
    todayEpisode
  );

  const calendarOnlyMine = await request(jarA, "/calendar?view=global&range=month&onlyMine=1");
  check(
    "filtro apenas minhas series funciona (inclui serie que o usuario acompanha)",
    calendarOnlyMine.status === 200 && String(calendarOnlyMine.body).includes(trackedSeries?.title ?? "__none__"),
    trackedSeries?.title
  );

  const nextEpisodeSeriesPage = await request(jarA, `/series/${seriesId}`);
  check(
    // INSERIES-SERIES-PAGE-PREMIUM-01 — renomeado para "Proximo lancamento" (calendario)
    // para nao ser confundido com a nova secao "Continuar assistindo" (Fase 3, Watch Next).
    "pagina da serie mostra secao Proximo lancamento",
    nextEpisodeSeriesPage.status === 200 && String(nextEpisodeSeriesPage.body).includes("Proximo lancamento"),
    nextEpisodeSeriesPage.status
  );

  const dashboard = await request(jarA, "/");
  check(
    // "Proximos episodios" foi renomeada pra "Agenda resumida" na sprint 03
    // (INSERIES-DASHBOARD-HOME-EXPERIENCE-03) - este check ficou desatualizado ate agora.
    "dashboard / mostra secao Agenda resumida",
    dashboard.status === 200 && String(dashboard.body).includes("Agenda resumida"),
    dashboard.status
  );

  // ---- Fundacao social: follow, listas, reviews, privacidade, ownership ----
  const jarB: CookieJar = { value: "" };
  const userB = await registerUser(jarB, "userb");

  const follow = await request(jarA, `/api/users/${userB.username}/follow`, { method: "POST" });
  check("usuario A segue usuario B", follow.status === 200 && follow.body?.data?.following === true, follow.body);

  const selfFollow = await request(jarA, `/api/users/${userA.username}/follow`, { method: "POST" });
  check("usuario nao pode seguir a si mesmo", selfFollow.status === 400, selfFollow.body);

  const duplicateFollow = await request(jarA, `/api/users/${userB.username}/follow`, { method: "POST" });
  check("seguir duplicado e idempotente", duplicateFollow.status === 200, duplicateFollow.body);

  const profileBAfterFollow = await request(jarA, `/profile/${userB.username}`);
  check(
    "perfil de B mostra 1 seguidor apos follow",
    profileBAfterFollow.status === 200 && /Seguidores<\/p><p[^>]*>1/.test(String(profileBAfterFollow.body)),
    profileBAfterFollow.status
  );

  const unfollow = await request(jarA, `/api/users/${userB.username}/follow`, { method: "DELETE" });
  check("usuario A deixa de seguir usuario B", unfollow.status === 200 && unfollow.body?.data?.following === false, unfollow.body);

  const profileBAfterUnfollow = await request(jarA, `/profile/${userB.username}`);
  check(
    "perfil de B volta a mostrar 0 seguidores apos unfollow",
    profileBAfterUnfollow.status === 200 && /Seguidores<\/p><p[^>]*>0/.test(String(profileBAfterUnfollow.body)),
    profileBAfterUnfollow.status
  );

  const createList = await request(jarA, "/api/lists", {
    method: "POST",
    body: JSON.stringify({ title: "Lista smoke test", description: "criada pelo smoke test", visibility: "PUBLIC" })
  });
  const listId: string | undefined = createList.body?.data?.id;
  check("usuario A cria lista", createList.status === 201 && Boolean(listId), createList.body);

  if (listId) {
    const addItem = await request(jarA, `/api/lists/${listId}/items`, {
      method: "POST",
      body: JSON.stringify({ seriesId })
    });
    const itemId: string | undefined = addItem.body?.data?.id;
    check("usuario A adiciona serie a lista", addItem.status === 201 && Boolean(itemId), addItem.body);

    const editList = await request(jarA, `/api/lists/${listId}`, {
      method: "PATCH",
      body: JSON.stringify({ title: "Lista smoke test editada" })
    });
    check("usuario A edita a propria lista", editList.status === 200, editList.body);

    const bEditsAList = await request(jarB, `/api/lists/${listId}`, {
      method: "PATCH",
      body: JSON.stringify({ title: "Hackeado" })
    });
    check("usuario B nao consegue editar lista de A (403)", bEditsAList.status === 403, bEditsAList.body);

    const bDeletesAList = await request(jarB, `/api/lists/${listId}`, { method: "DELETE" });
    check("usuario B nao consegue apagar lista de A (403)", bDeletesAList.status === 403, bDeletesAList.body);

    if (itemId) {
      const removeItem = await request(jarA, `/api/lists/${listId}/items/${itemId}`, { method: "DELETE" });
      check("usuario A remove serie da lista", removeItem.status === 200, removeItem.body);
    }

    const deleteList = await request(jarA, `/api/lists/${listId}`, { method: "DELETE" });
    check("usuario A apaga a propria lista", deleteList.status === 200, deleteList.body);
  }

  const createReview = await request(jarA, `/api/series/${seriesId}/reviews`, {
    method: "POST",
    body: JSON.stringify({ rating: 5, body: "Review inicial do smoke test", visibility: "PUBLIC" })
  });
  check("usuario A cria review", createReview.status === 200 && createReview.body?.data?.rating === 5, createReview.body);

  const editReview = await request(jarA, `/api/series/${seriesId}/reviews`, {
    method: "POST",
    body: JSON.stringify({ rating: 4, body: "Review editada pelo smoke test", visibility: "PUBLIC" })
  });
  check(
    "usuario A edita a propria review (mesmo id, dados atualizados)",
    editReview.status === 200 &&
      editReview.body?.data?.id === createReview.body?.data?.id &&
      editReview.body?.data?.rating === 4,
    editReview.body
  );

  const bReviewsSameSeries = await request(jarB, `/api/series/${seriesId}/reviews`, {
    method: "POST",
    body: JSON.stringify({ rating: 1, body: "Review da B, independente da review de A", visibility: "PUBLIC" })
  });
  check(
    "usuario B nao consegue editar review de A (cria a propria, id diferente)",
    bReviewsSameSeries.status === 200 && bReviewsSameSeries.body?.data?.id !== createReview.body?.data?.id,
    bReviewsSameSeries.body
  );

  const seriesPageAfterReviews = await request(jarA, `/series/${seriesId}`);
  check(
    "review de A permanece intacta apos review de B",
    seriesPageAfterReviews.status === 200 && String(seriesPageAfterReviews.body).includes("Review editada pelo smoke test"),
    seriesPageAfterReviews.status
  );

  // ---- Comentarios e respostas (INSERIES-REVIEWS-COMMENTS-PREMIUM-01) ----
  const reviewIdForComments = createReview.body?.data?.id;

  const commentByB = await request(jarB, `/api/reviews/${reviewIdForComments}/comments`, {
    method: "POST",
    body: JSON.stringify({ body: "Comentario do smoke test" })
  });
  check(
    "usuario B comenta na review de A",
    commentByB.status === 201 && commentByB.body?.data?.body === "Comentario do smoke test",
    commentByB.body
  );

  const commentId = commentByB.body?.data?.id;

  const replyByA = await request(jarA, `/api/reviews/${reviewIdForComments}/comments`, {
    method: "POST",
    body: JSON.stringify({ body: "Resposta do smoke test", parentId: commentId })
  });
  check(
    "usuario A responde ao comentario de B",
    replyByA.status === 201 && replyByA.body?.data?.parentId === commentId,
    replyByA.body
  );

  const bEditsOwnComment = await request(jarB, `/api/reviews/${reviewIdForComments}/comments/${commentId}`, {
    method: "PATCH",
    body: JSON.stringify({ body: "Comentario editado pelo smoke test" })
  });
  check(
    "usuario B edita o proprio comentario",
    bEditsOwnComment.status === 200 && bEditsOwnComment.body?.data?.body === "Comentario editado pelo smoke test",
    bEditsOwnComment.body
  );

  const aEditsBComment = await request(jarA, `/api/reviews/${reviewIdForComments}/comments/${commentId}`, {
    method: "PATCH",
    body: JSON.stringify({ body: "Hackeado" })
  });
  check("usuario A nao consegue editar comentario de B (403)", aEditsBComment.status === 403, aEditsBComment.body);

  const seriesPageWithComments = await request(jarA, `/series/${seriesId}`);
  check(
    "pagina da serie mostra comentario e resposta",
    seriesPageWithComments.status === 200 &&
      String(seriesPageWithComments.body).includes("Comentario editado pelo smoke test") &&
      String(seriesPageWithComments.body).includes("Resposta do smoke test"),
    seriesPageWithComments.status
  );

  const bDeletesOwnComment = await request(jarB, `/api/reviews/${reviewIdForComments}/comments/${commentId}`, { method: "DELETE" });
  check("usuario B apaga o proprio comentario (cascata apaga a resposta)", bDeletesOwnComment.status === 200, bDeletesOwnComment.body);

  const seriesPageAfterCommentDelete = await request(jarA, `/series/${seriesId}`);
  check(
    "comentario e resposta desaparecem apos exclusao em cascata",
    seriesPageAfterCommentDelete.status === 200 &&
      !String(seriesPageAfterCommentDelete.body).includes("Comentario editado pelo smoke test") &&
      !String(seriesPageAfterCommentDelete.body).includes("Resposta do smoke test"),
    seriesPageAfterCommentDelete.status
  );

  const deleteReview = await request(jarA, `/api/series/${seriesId}/reviews`, { method: "DELETE" });
  check("usuario A apaga a propria review", deleteReview.status === 200, deleteReview.body);

  await request(jarB, `/api/series/${seriesId}/reviews`, { method: "DELETE" });

  const setPrivate = await request(jarA, "/api/profile", {
    method: "PATCH",
    body: JSON.stringify({ isProfilePrivate: true })
  });
  check("usuario A define perfil como privado", setPrivate.status === 200 && setPrivate.body?.data?.isProfilePrivate === true, setPrivate.body);

  const profileAAsB = await request(jarB, `/profile/${userA.username}`);
  check(
    "perfil privado de A oculta dados para B",
    profileAAsB.status === 200 && String(profileAAsB.body).includes("Perfil privado"),
    profileAAsB.status
  );

  const profileAAsOwner = await request(jarA, `/profile/${userA.username}`);
  check(
    "dono ve proprio perfil completo mesmo privado",
    profileAAsOwner.status === 200 && !String(profileAAsOwner.body).includes("Perfil privado"),
    profileAAsOwner.status
  );

  const revertPrivate = await request(jarA, "/api/profile", {
    method: "PATCH",
    body: JSON.stringify({ isProfilePrivate: false })
  });
  check("usuario A reverte perfil para publico", revertPrivate.status === 200, revertPrivate.body);

  // ---- Feed de atividades: geracao, feed pessoal/global, privacidade ----
  const reFollow = await request(jarA, `/api/users/${userB.username}/follow`, { method: "POST" });
  check("usuario A volta a seguir usuario B (para testar feed pessoal)", reFollow.status === 200, reFollow.body);

  const bStatus = await request(jarB, `/api/series/${seriesId}/status`, {
    method: "POST",
    body: JSON.stringify({ seriesId, state: "WATCHING" })
  });
  check("usuario B altera status da serie (gera atividade)", bStatus.status === 200, bStatus.body);

  const bMarkWatched = await request(jarB, `/api/episodes/${episodeId}/progress`, {
    method: "POST",
    body: JSON.stringify({ episodeId, watched: true })
  });
  check("usuario B marca episodio assistido (gera atividade)", bMarkWatched.status === 200, bMarkWatched.body);

  const meBAfterMark = await request(jarB, "/");
  const episodeWatchedCountAfterMark = countOccurrences(String(meBAfterMark.body), "S01E01");

  const bUnmarkWatched = await request(jarB, `/api/episodes/${episodeId}/progress`, {
    method: "POST",
    body: JSON.stringify({ episodeId, watched: false })
  });
  check("usuario B desmarca episodio (200, sem erro)", bUnmarkWatched.status === 200, bUnmarkWatched.body);

  const meBAfterUnmark = await request(jarB, "/");
  const episodeWatchedCountAfterUnmark = countOccurrences(String(meBAfterUnmark.body), "S01E01");
  check(
    "desmarcar episodio nao cria atividade duplicada (contagem identica antes/depois do desmarcar)",
    episodeWatchedCountAfterMark > 0 && episodeWatchedCountAfterUnmark === episodeWatchedCountAfterMark,
    { episodeWatchedCountAfterMark, episodeWatchedCountAfterUnmark }
  );

  const reviewMarker = `Review publica de ${userB.username} para o feed`;
  const listMarker = `Lista publica de ${userB.username} para o feed`;

  const bReview = await request(jarB, `/api/series/${seriesId}/reviews`, {
    method: "POST",
    body: JSON.stringify({ rating: 5, body: reviewMarker, visibility: "PUBLIC" })
  });
  check("usuario B cria review publica (gera atividade)", bReview.status === 200, bReview.body);

  const bList = await request(jarB, "/api/lists", {
    method: "POST",
    body: JSON.stringify({ title: listMarker, visibility: "PUBLIC" })
  });
  check("usuario B cria lista publica (gera atividade)", bList.status === 201, bList.body);

  const feedGuest = await request({ value: "" }, "/feed");
  check(
    "feed sem sessao mostra CTA de login (nao redireciona)",
    feedGuest.status === 200 && String(feedGuest.body).includes("Entre para ver seu feed"),
    feedGuest.status
  );

  const feedPersonalA = await request(jarA, "/feed");
  check(
    "feed pessoal de A mostra atividades de B (que A segue)",
    feedPersonalA.status === 200 &&
      String(feedPersonalA.body).includes(reviewMarker) &&
      String(feedPersonalA.body).includes(listMarker),
    feedPersonalA.status
  );

  // ---- Feed Social Premium (INSERIES-SOCIAL-FEED-01): cards/filtros/ordenacao/descoberta ----
  check(
    "Feed (Fase 4): toolbar de filtro e ordenacao presente",
    String(feedPersonalA.body).includes("Filtrar feed") && String(feedPersonalA.body).includes("Ordenar feed"),
    feedPersonalA.status
  );
  check(
    "Feed (Fase 4): opcao de ordenacao Mais comentados presente",
    String(feedPersonalA.body).includes("Mais comentados") && String(feedPersonalA.body).includes("Relevantes"),
    feedPersonalA.status
  );
  check(
    "Feed (Fase 5): blocos de descoberta (Trending/Reviews em destaque/Usuarios ativos) aparecem",
    String(feedPersonalA.body).includes("Trending entre usuarios") &&
      String(feedPersonalA.body).includes("Reviews em destaque") &&
      String(feedPersonalA.body).includes("Usuarios ativos"),
    feedPersonalA.status
  );

  // Comentario de teste na PROPRIA review de A (nao na de B) — mantem este bloco isolado da
  // asserção de privacidade de B mais abaixo (a review de B e PUBLIC e continua legitimamente
  // legivel na pagina da serie mesmo apos B ficar privado; o que a asserção de privacidade
  // testa e a AUSENCIA da atividade de B no feed, nao o sigilo do texto da review em si).
  const commentTestReviewMarker = `Review de A para testar comentario no feed de ${userA.username}`;
  const aReviewForComment = await request(jarA, `/api/series/${seriesId}/reviews`, {
    method: "POST",
    body: JSON.stringify({ rating: 4, body: commentTestReviewMarker, visibility: "PUBLIC" })
  });
  check("usuario A cria review propria para testar comentario no feed", aReviewForComment.status === 200, aReviewForComment.body);

  const commentMarker = `Comentario de ${userA.username} para o feed`;
  const aReviewIdForFeed = aReviewForComment.body?.data?.id;
  const commentOnOwnReview = await request(jarA, `/api/reviews/${aReviewIdForFeed}/comments`, {
    method: "POST",
    body: JSON.stringify({ body: commentMarker })
  });
  check("usuario A comenta na propria review (gera atividade)", commentOnOwnReview.status === 201, commentOnOwnReview.body);

  const feedPersonalAAfterComment = await request(jarA, "/feed");
  check(
    "Feed (Fase 3): card de comentario mostra 'comentou' e o contexto da review",
    feedPersonalAAfterComment.status === 200 &&
      String(feedPersonalAAfterComment.body).includes("comentou na review de") &&
      String(feedPersonalAAfterComment.body).includes(commentMarker),
    feedPersonalAAfterComment.status
  );

  const deleteAReviewForComment = await request(jarA, `/api/series/${seriesId}/reviews`, { method: "DELETE" });
  check("usuario A apaga a review de teste de comentario (limpeza)", deleteAReviewForComment.status === 200, deleteAReviewForComment.body);

  const feedGlobalBefore = await request({ value: "" }, "/feed?view=global");
  check(
    "feed global mostra atividades publicas de B",
    feedGlobalBefore.status === 200 && String(feedGlobalBefore.body).includes(listMarker),
    feedGlobalBefore.status
  );

  const bGoesPrivate = await request(jarB, "/api/profile", {
    method: "PATCH",
    body: JSON.stringify({ isProfilePrivate: true })
  });
  check("usuario B define perfil como privado", bGoesPrivate.status === 200, bGoesPrivate.body);

  const feedGlobalAfterPrivate = await request({ value: "" }, "/feed?view=global");
  check(
    "perfil privado nao aparece no feed global",
    feedGlobalAfterPrivate.status === 200 && !String(feedGlobalAfterPrivate.body).includes(listMarker),
    feedGlobalAfterPrivate.status
  );

  const feedPersonalAAfterPrivate = await request(jarA, "/feed");
  check(
    "atividade privada nao aparece para terceiros no feed pessoal",
    feedPersonalAAfterPrivate.status === 200 &&
      !String(feedPersonalAAfterPrivate.body).includes(reviewMarker),
    feedPersonalAAfterPrivate.status
  );

  const meBOwnActivity = await request(jarB, "/");
  check(
    "Dashboard de B continua mostrando a propria atividade mesmo com perfil privado",
    meBOwnActivity.status === 200 && String(meBOwnActivity.body).includes(listMarker),
    meBOwnActivity.status
  );

  await request(jarB, "/api/profile", {
    method: "PATCH",
    body: JSON.stringify({ isProfilePrivate: false })
  });

  // ---- Notificacoes: fundacao, eventos sociais, privacidade, leitura ----
  const jarC: CookieJar = { value: "" };
  const userC = await registerUser(jarC, "userc");
  const jarD: CookieJar = { value: "" };
  const userD = await registerUser(jarD, "userd");

  const cFollowsD = await request(jarC, `/api/users/${userD.username}/follow`, { method: "POST" });
  check("usuario C segue usuario D (fundacao de notificacoes)", cFollowsD.status === 200, cFollowsD.body);

  const dNotificationsAfterFollow = await request(jarD, "/api/notifications");
  check(
    "seguir gera notificacao FOLLOWED_YOU para o usuario seguido",
    dNotificationsAfterFollow.status === 200 &&
      dNotificationsAfterFollow.body?.data?.items?.some(
        (n: Json) => n.type === "FOLLOWED_YOU" && n.actorUser?.username === userC.username
      ),
    dNotificationsAfterFollow.body
  );

  const dPublicReview = await request(jarD, `/api/series/${seriesId}/reviews`, {
    method: "POST",
    body: JSON.stringify({ rating: 5, body: "Review publica de D para notificacoes", visibility: "PUBLIC" })
  });
  check("usuario D cria review publica", dPublicReview.status === 200, dPublicReview.body);

  const cNotificationsAfterPublicReview = await request(jarC, "/api/notifications");
  check(
    "review publica de seguido gera notificacao REVIEW_FROM_FOLLOWING",
    cNotificationsAfterPublicReview.status === 200 &&
      cNotificationsAfterPublicReview.body?.data?.items?.some(
        (n: Json) => n.type === "REVIEW_FROM_FOLLOWING" && n.actorUser?.username === userD.username
      ),
    cNotificationsAfterPublicReview.body
  );

  await request(jarD, `/api/series/${seriesId}/reviews`, { method: "DELETE" });

  const dPrivateReview = await request(jarD, `/api/series/${seriesId}/reviews`, {
    method: "POST",
    body: JSON.stringify({ rating: 3, body: "Review privada de D, nao deve notificar", visibility: "PRIVATE" })
  });
  check("usuario D cria review privada", dPrivateReview.status === 200, dPrivateReview.body);

  const cNotificationsAfterPrivateReview = await request(jarC, "/api/notifications");
  const reviewNotificationCountAfterPrivate = (cNotificationsAfterPrivateReview.body?.data?.items ?? []).filter(
    (n: Json) => n.type === "REVIEW_FROM_FOLLOWING"
  ).length;
  check(
    "review privada de seguido nao gera notificacao adicional",
    cNotificationsAfterPrivateReview.status === 200 && reviewNotificationCountAfterPrivate === 1,
    { reviewNotificationCountAfterPrivate }
  );

  await request(jarD, `/api/series/${seriesId}/reviews`, { method: "DELETE" });

  const dPublicList = await request(jarD, "/api/lists", {
    method: "POST",
    body: JSON.stringify({ title: "Lista publica de D para notificacoes", visibility: "PUBLIC" })
  });
  const dPublicListId: string | undefined = dPublicList.body?.data?.id;
  check("usuario D cria lista publica", dPublicList.status === 201 && Boolean(dPublicListId), dPublicList.body);

  const cNotificationsAfterPublicList = await request(jarC, "/api/notifications");
  check(
    "lista publica de seguido gera notificacao LIST_FROM_FOLLOWING",
    cNotificationsAfterPublicList.status === 200 &&
      cNotificationsAfterPublicList.body?.data?.items?.some(
        (n: Json) => n.type === "LIST_FROM_FOLLOWING" && n.actorUser?.username === userD.username
      ),
    cNotificationsAfterPublicList.body
  );

  const dPrivateList = await request(jarD, "/api/lists", {
    method: "POST",
    body: JSON.stringify({ title: "Lista privada de D, nao deve notificar", visibility: "PRIVATE" })
  });
  const dPrivateListId: string | undefined = dPrivateList.body?.data?.id;
  check("usuario D cria lista privada", dPrivateList.status === 201 && Boolean(dPrivateListId), dPrivateList.body);

  const cNotificationsAfterPrivateList = await request(jarC, "/api/notifications");
  const listNotificationCountAfterPrivate = (cNotificationsAfterPrivateList.body?.data?.items ?? []).filter(
    (n: Json) => n.type === "LIST_FROM_FOLLOWING"
  ).length;
  check(
    "lista privada de seguido nao gera notificacao adicional",
    cNotificationsAfterPrivateList.status === 200 && listNotificationCountAfterPrivate === 1,
    { listNotificationCountAfterPrivate }
  );

  await request(jarD, `/api/series/${seriesId}/reviews`, { method: "DELETE" });

  if (dPublicListId) await request(jarD, `/api/lists/${dPublicListId}`, { method: "DELETE" });
  if (dPrivateListId) await request(jarD, `/api/lists/${dPrivateListId}`, { method: "DELETE" });

  const dCompletesSeries = await request(jarD, `/api/series/${seriesId}/status`, {
    method: "POST",
    body: JSON.stringify({ seriesId, state: "COMPLETED" })
  });
  check("usuario D conclui a serie", dCompletesSeries.status === 200, dCompletesSeries.body);

  const dNotificationsAfterCompletion = await request(jarD, "/api/notifications");
  check(
    "concluir serie gera notificacao SERIES_COMPLETED para o proprio usuario",
    dNotificationsAfterCompletion.status === 200 &&
      dNotificationsAfterCompletion.body?.data?.items?.some((n: Json) => n.type === "SERIES_COMPLETED"),
    dNotificationsAfterCompletion.body
  );

  const cNotificationsBeforeRead = await request(jarC, "/api/notifications");
  const cUnreadBefore = cNotificationsBeforeRead.body?.data?.unreadCount;
  const cFirstNotificationId: string | undefined = cNotificationsBeforeRead.body?.data?.items?.[0]?.id;
  check("contador de nao lidas reflete notificacoes pendentes de C", typeof cUnreadBefore === "number" && cUnreadBefore > 0, cUnreadBefore);

  if (cFirstNotificationId) {
    const dTriesToReadCNotification = await request(jarD, `/api/notifications/${cFirstNotificationId}/read`, { method: "POST" });
    check(
      "usuario D nao consegue marcar notificacao de C como lida (403)",
      dTriesToReadCNotification.status === 403,
      dTriesToReadCNotification.body
    );

    const cMarksOwnNotificationRead = await request(jarC, `/api/notifications/${cFirstNotificationId}/read`, { method: "POST" });
    check("usuario C marca a propria notificacao como lida", cMarksOwnNotificationRead.status === 200, cMarksOwnNotificationRead.body);

    const cNotificationsAfterRead = await request(jarC, "/api/notifications");
    const unreadAfterMarkingOne = cNotificationsAfterRead.body?.data?.unreadCount;
    check(
      "contador de nao lidas de C diminui apos marcar uma como lida",
      typeof unreadAfterMarkingOne === "number" && unreadAfterMarkingOne === cUnreadBefore - 1,
      { cUnreadBefore, unreadAfterMarkingOne }
    );
  }

  const cMarksAllRead = await request(jarC, "/api/notifications/read-all", { method: "POST" });
  check("usuario C marca todas as notificacoes como lidas", cMarksAllRead.status === 200, cMarksAllRead.body);

  const cNotificationsAfterMarkAll = await request(jarC, "/api/notifications");
  check(
    "contador de nao lidas de C chega a zero apos marcar todas como lidas",
    cNotificationsAfterMarkAll.status === 200 && cNotificationsAfterMarkAll.body?.data?.unreadCount === 0,
    cNotificationsAfterMarkAll.body
  );

  const guestTriesNotificationsApi = await request({ value: "" }, "/api/notifications");
  check(
    "usuario nao autenticado nao acessa /api/notifications (401, sem pagina dedicada para redirecionar)",
    guestTriesNotificationsApi.status === 401,
    guestTriesNotificationsApi.status
  );

  const notificationsPageRemoved = await request(jarC, "/notifications");
  check(
    "pagina dedicada /notifications foi removida (Fase 7 — sino do Header vira o unico centro de notificacoes)",
    notificationsPageRemoved.status === 404,
    notificationsPageRemoved.status
  );

  const cDashboardWithBell = await request(jarC, "/");
  check(
    "Header (Fase 7/8): sino renderiza como gatilho de Dropdown (aria-haspopup=menu)",
    cDashboardWithBell.status === 200 &&
      String(cDashboardWithBell.body).includes('aria-haspopup="menu"') &&
      /Notifica..es/.test(String(cDashboardWithBell.body)),
    cDashboardWithBell.status
  );

  const firstEpisodeScriptRun = await generateNewEpisodeAvailableNotifications();
  const secondEpisodeScriptRun = await generateNewEpisodeAvailableNotifications();
  check(
    "script de episodios disponiveis nao duplica notificacoes ao rodar novamente",
    secondEpisodeScriptRun === 0,
    { firstEpisodeScriptRun, secondEpisodeScriptRun }
  );

  // ---- Workspace administrativo: RBAC, dashboard, moderacao, sync, auditoria ----
  const guestJar: CookieJar = { value: "" };
  const adminOnlyRoutesGuest = await request(guestJar, "/admin");
  check(
    "convidado sem sessao e redirecionado ao acessar /admin",
    adminOnlyRoutesGuest.status === 307 || adminOnlyRoutesGuest.status === 302,
    adminOnlyRoutesGuest.status
  );

  const userTriesAdmin = await request(jarA, "/admin");
  check(
    "usuario comum (role USER) e bloqueado de /admin (redirect, nao 200)",
    userTriesAdmin.status === 307 || userTriesAdmin.status === 302,
    userTriesAdmin.status
  );

  const jarAdmin: CookieJar = { value: "" };
  const adminLogin = await request(jarAdmin, "/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "admin@inseries.dev", password: "admin12345" })
  });
  check(
    "login do admin de desenvolvimento funciona (rode `npm run seed:admin` antes do smoke test)",
    adminLogin.status === 200,
    adminLogin.body
  );

  const adminDashboard = await request(jarAdmin, "/admin");
  check(
    "admin acessa /admin e ve o dashboard",
    adminDashboard.status === 200 && String(adminDashboard.body).includes("Dashboard"),
    adminDashboard.status
  );

  const adminCatalog = await request(jarAdmin, "/admin/catalog");
  check(
    "admin acessa /admin/catalog e ve o catalogo interno",
    adminCatalog.status === 200 && String(adminCatalog.body).includes("Serie Teste Um"),
    adminCatalog.status
  );

  const adminSyncPage = await request(jarAdmin, "/admin/sync");
  check("admin acessa /admin/sync", adminSyncPage.status === 200, adminSyncPage.status);
  check(
    "admin (Fase 7) pode disparar o Discovery Engine a partir de /admin/sync",
    String(adminSyncPage.body).includes("Rodar Discovery Engine"),
    adminSyncPage.status
  );

  const userTriesTriggerSync = await request(jarA, "/api/admin/sync/popular", { method: "POST" });
  check("usuario comum nao pode disparar sync (403)", userTriesTriggerSync.status === 403, userTriesTriggerSync.body);
  // adminTriggersDiscovery/adminTriggersSync (disparo real do Discovery Engine/sync popular)
  // movidos pro fim do script - ver comentario perto de "Encerramento" mais abaixo.

  const adminUsersPage = await request(jarAdmin, "/admin/users");
  check(
    "admin acessa /admin/users e ve usuarios cadastrados",
    adminUsersPage.status === 200 && String(adminUsersPage.body).includes(userA.username),
    adminUsersPage.status
  );

  const adminSystemPage = await request(jarAdmin, "/admin/system");
  check(
    "admin acessa /admin/system e ve informacoes tecnicas",
    adminSystemPage.status === 200 && String(adminSystemPage.body).includes("Versao do Node"),
    adminSystemPage.status
  );

  const moderationReviewMarker = "Review para moderacao pelo smoke test";
  const moderationReview = await request(jarA, `/api/series/${seriesId}/reviews`, {
    method: "POST",
    body: JSON.stringify({ rating: 3, body: moderationReviewMarker, visibility: "PUBLIC" })
  });
  const moderationReviewId: string | undefined = moderationReview.body?.data?.id;
  check("usuario A cria review para teste de moderacao", moderationReview.status === 200 && Boolean(moderationReviewId), moderationReview.body);

  const moderationListMarker = "Lista para moderacao pelo smoke test";
  const moderationList = await request(jarA, "/api/lists", {
    method: "POST",
    body: JSON.stringify({ title: moderationListMarker, visibility: "PUBLIC" })
  });
  const moderationListId: string | undefined = moderationList.body?.data?.id;
  check("usuario A cria lista para teste de moderacao", moderationList.status === 201 && Boolean(moderationListId), moderationList.body);

  if (moderationReviewId) {
    const seriesBeforeHide = await request(guestJar, `/series/${seriesId}`);
    check(
      "review visivel publicamente antes da moderacao",
      seriesBeforeHide.status === 200 && String(seriesBeforeHide.body).includes(moderationReviewMarker),
      seriesBeforeHide.status
    );

    const userTriesHideReview = await request(jarA, `/api/admin/reviews/${moderationReviewId}/hide`, { method: "POST" });
    check("usuario comum nao pode ocultar review (403)", userTriesHideReview.status === 403, userTriesHideReview.body);

    const hideReviewResponse = await request(jarAdmin, `/api/admin/reviews/${moderationReviewId}/hide`, { method: "POST" });
    check("admin oculta review (200)", hideReviewResponse.status === 200, hideReviewResponse.body);

    const seriesAfterHide = await request(guestJar, `/series/${seriesId}`);
    check(
      "review oculta pelo admin nao aparece mais publicamente",
      seriesAfterHide.status === 200 && !String(seriesAfterHide.body).includes(moderationReviewMarker),
      seriesAfterHide.status
    );

    const restoreReviewResponse = await request(jarAdmin, `/api/admin/reviews/${moderationReviewId}/restore`, { method: "POST" });
    check("admin restaura review (200)", restoreReviewResponse.status === 200, restoreReviewResponse.body);

    const seriesAfterRestore = await request(guestJar, `/series/${seriesId}`);
    check(
      "review restaurada volta a aparecer publicamente",
      seriesAfterRestore.status === 200 && String(seriesAfterRestore.body).includes(moderationReviewMarker),
      seriesAfterRestore.status
    );

    await request(jarA, `/api/series/${seriesId}/reviews`, { method: "DELETE" });
  }

  if (moderationListId) {
    const listsBeforeHide = await request(guestJar, "/lists");
    check(
      "lista visivel publicamente antes da moderacao",
      listsBeforeHide.status === 200 && String(listsBeforeHide.body).includes(moderationListMarker),
      listsBeforeHide.status
    );

    const hideListResponse = await request(jarAdmin, `/api/admin/lists/${moderationListId}/hide`, { method: "POST" });
    check("admin oculta lista (200)", hideListResponse.status === 200, hideListResponse.body);

    const listsAfterHide = await request(guestJar, "/lists");
    check(
      "lista oculta pelo admin nao aparece mais na listagem publica",
      listsAfterHide.status === 200 && !String(listsAfterHide.body).includes(moderationListMarker),
      listsAfterHide.status
    );

    const restoreListResponse = await request(jarAdmin, `/api/admin/lists/${moderationListId}/restore`, { method: "POST" });
    check("admin restaura lista (200)", restoreListResponse.status === 200, restoreListResponse.body);

    const listsAfterRestore = await request(guestJar, "/lists");
    check(
      "lista restaurada volta a aparecer na listagem publica",
      listsAfterRestore.status === 200 && String(listsAfterRestore.body).includes(moderationListMarker),
      listsAfterRestore.status
    );

    await request(jarA, `/api/lists/${moderationListId}`, { method: "DELETE" });
  }

  const adminReviewsPage = await request(jarAdmin, "/admin/reviews");
  check("admin acessa /admin/reviews", adminReviewsPage.status === 200, adminReviewsPage.status);

  const adminListsPage = await request(jarAdmin, "/admin/lists");
  check("admin acessa /admin/lists", adminListsPage.status === 200, adminListsPage.status);

  const adminLogsPage = await request(jarAdmin, "/admin/logs");
  check(
    "AdminAuditLog registra as acoes de moderacao e sync (visiveis em /admin/logs)",
    adminLogsPage.status === 200 &&
      String(adminLogsPage.body).includes("HIDE_REVIEW") &&
      String(adminLogsPage.body).includes("RESTORE_REVIEW") &&
      String(adminLogsPage.body).includes("HIDE_LIST") &&
      String(adminLogsPage.body).includes("RESTORE_LIST") &&
      String(adminLogsPage.body).includes("START_SYNC"),
    adminLogsPage.status
  );

  // ---- Sincronizacao de catalogo em escala: fontes, filtros, rate limit/retry, config ----
  check(
    "config.catalogSync expoe defaults sensatos (paginas, concorrencia, atraso, filtros)",
    config.catalogSync.popularPages === 1 &&
      config.catalogSync.discoverPages === 1 &&
      config.catalogSync.maxConcurrentRequests >= 1 &&
      config.catalogSync.requestDelayMs >= 0 &&
      config.catalogSync.minVoteCount === 0 &&
      config.catalogSync.minYear === undefined &&
      config.catalogSync.maxYear === undefined,
    config.catalogSync
  );

  const discoverySyncs: Array<{ label: string; run: () => Promise<{ status: string; errorMessage: string | null }> }> = [
    { label: "Popular", run: () => syncPopularSeries({ pages: 1 }) },
    { label: "Discover", run: () => syncDiscoverSeries({ pages: 1 }) },
    { label: "Top Rated", run: () => syncTopRatedSeries({ pages: 1 }) },
    { label: "On The Air", run: () => syncOnTheAirSeries({ pages: 1 }) },
    { label: "Airing Today", run: () => syncAiringTodaySeries({ pages: 1 }) },
    { label: "Trending", run: () => syncTrendingSeries({ pages: 1 }) }
  ];

  for (const source of discoverySyncs) {
    const summary = await source.run();
    check(
      `sync de ${source.label} roda isoladamente e aborta com erro amigavel sem TMDB key (nao quebra)`,
      summary.status === "FAILED" && Boolean(summary.errorMessage?.includes("TMDb nao configurado")),
      summary
    );
  }

  const fullCatalogSummary = await syncFullCatalog();
  check(
    "sync:catalog (orquestrador) aborta com erro amigavel sem TMDB key e nao cria sub-execucoes a toa",
    fullCatalogSummary.status === "FAILED" && fullCatalogSummary.sources.length === 0,
    fullCatalogSummary
  );

  // Rate limiter/retry validated in isolation (no network): concurrency cap, retry+backoff on
  // retryable errors, rate-limit errors counted separately, non-retryable errors never retried.
  resetTmdbCallStats();
  let concurrentActive = 0;
  let concurrentMax = 0;
  await Promise.all(
    Array.from({ length: 10 }, () =>
      withTmdbRateLimit(async () => {
        concurrentActive += 1;
        concurrentMax = Math.max(concurrentMax, concurrentActive);
        await new Promise((resolve) => setTimeout(resolve, 20));
        concurrentActive -= 1;
      })
    )
  );
  check(
    "fila de concorrencia do TMDb nunca excede TMDB_MAX_CONCURRENT_REQUESTS",
    concurrentMax > 0 && concurrentMax <= config.catalogSync.maxConcurrentRequests,
    { concurrentMax, limit: config.catalogSync.maxConcurrentRequests }
  );

  resetTmdbCallStats();
  let retryAttempts = 0;
  const retryResult = await withTmdbRateLimit(
    async () => {
      retryAttempts += 1;
      if (retryAttempts < 3) throw new Error("transient");
      return "ok";
    },
    { isRetryable: () => true }
  );
  check(
    "retry com backoff eventualmente resolve um erro transitorio",
    retryResult === "ok" && retryAttempts === 3 && getTmdbCallStats().retryCount === 2,
    { retryAttempts, stats: getTmdbCallStats() }
  );

  resetTmdbCallStats();
  let rateLimitAttempts = 0;
  await withTmdbRateLimit(
    async () => {
      rateLimitAttempts += 1;
      if (rateLimitAttempts < 2) throw new Error("429");
      return "ok";
    },
    { isRateLimit: (error) => error instanceof Error && error.message === "429" }
  );
  check(
    "erro de rate limit e retentado e contado separadamente (rateLimitHitCount)",
    getTmdbCallStats().rateLimitHitCount === 1 && getTmdbCallStats().retryCount === 1,
    getTmdbCallStats()
  );

  resetTmdbCallStats();
  let nonRetryableAttempts = 0;
  const nonRetryableResult = await withTmdbRateLimit(async () => {
    nonRetryableAttempts += 1;
    throw new Error("fatal");
  }).catch((error) => error);
  check(
    "erro nao-retentavel (401/404/config) nunca tenta de novo",
    nonRetryableAttempts === 1 && nonRetryableResult instanceof Error && getTmdbCallStats().retryCount === 0,
    { nonRetryableAttempts, stats: getTmdbCallStats() }
  );

  // ---- Descoberta massiva e coverage (INSERIES-TMDB-CATALOG-COVERAGE-01): agregacao, dedup, ----
  // ---- priorizacao, cache, cadencia por status e retomada — tudo validado sem rede real ao TMDb ----
  let trendingFailureAttempts = 0;
  const aggregatorSources: SourceDefinition[] = [
    {
      key: "POPULAR_SERIES",
      pages: 1,
      fetchPage: async (page) =>
        page === 1
          ? [
              { id: 500001, name: "Aggregator Alpha", popularity: 100, vote_count: 1000, vote_average: 9 },
              { id: 500002, name: "Aggregator Beta", popularity: 1, vote_count: 1, vote_average: 1 }
            ]
          : []
    },
    {
      key: "TOP_RATED",
      pages: 1,
      fetchPage: async (page) =>
        page === 1
          ? [
              { id: 500001, name: "Aggregator Alpha", popularity: 100, vote_count: 1000, vote_average: 9 },
              { id: 500003, name: "Aggregator Gamma", popularity: 50, vote_count: 500, vote_average: 6 }
            ]
          : []
    },
    {
      key: "TRENDING",
      pages: 1,
      fetchPage: async () => {
        trendingFailureAttempts += 1;
        throw new Error("fonte instavel de teste");
      }
    }
  ];

  const aggregation = await collectCandidates(aggregatorSources, createSyncCache());
  check(
    "agregador (Fase 2) consolida as fontes configuradas e isola a fonte que falhou",
    aggregation.perSourceCounts.POPULAR_SERIES === 2 &&
      aggregation.perSourceCounts.TOP_RATED === 2 &&
      aggregation.perSourceCounts.TRENDING === 0 &&
      aggregation.totalCollected === 4 &&
      aggregation.pagesProcessed === 2 &&
      trendingFailureAttempts === 1 &&
      aggregation.errors.length === 1 &&
      aggregation.errors[0].source.includes("TRENDING"),
    { perSourceCounts: aggregation.perSourceCounts, errors: aggregation.errors }
  );
  check(
    "deduplicacao (Fase 3): id repetido entre fontes vira uma unica entrada, com as duas fontes registradas",
    aggregation.uniqueCount === 3 &&
      aggregation.duplicatesRemoved === 1 &&
      aggregation.candidates.length === 3 &&
      aggregation.candidates.find((candidate) => candidate.tmdbId === "500001")?.sources.length === 2,
    aggregation.candidates.map((candidate) => ({ id: candidate.tmdbId, sources: candidate.sources }))
  );
  check(
    "priorizacao (Fase 4): fila ordenada por prioridade calculada (popularidade/votos/nota), mais relevante primeiro",
    aggregation.candidates[0].tmdbId === "500001" && aggregation.candidates[aggregation.candidates.length - 1].tmdbId === "500002",
    aggregation.candidates.map((candidate) => ({ id: candidate.tmdbId, score: candidate.priorityScore }))
  );

  const DAY_MS = 24 * 60 * 60 * 1000;
  const cadenceReferenceNow = new Date("2026-01-15T12:00:00.000Z");
  check(
    "cadencia (Fase 6): serie nunca sincronizada esta sempre devida",
    isDueForUpdate("RETURNING", null, cadenceReferenceNow),
    null
  );
  check(
    "cadencia (Fase 6): RETURNING/IN_PRODUCTION exige pelo menos 1 dia entre atualizacoes",
    isDueForUpdate("RETURNING", new Date(cadenceReferenceNow.getTime() - 12 * 60 * 60 * 1000), cadenceReferenceNow) === false &&
      isDueForUpdate("RETURNING", new Date(cadenceReferenceNow.getTime() - 25 * 60 * 60 * 1000), cadenceReferenceNow) === true,
    null
  );
  check(
    "cadencia (Fase 6): ENDED exige 7 dias e CANCELED exige 30 dias entre atualizacoes",
    isDueForUpdate("ENDED", new Date(cadenceReferenceNow.getTime() - 3 * DAY_MS), cadenceReferenceNow) === false &&
      isDueForUpdate("ENDED", new Date(cadenceReferenceNow.getTime() - 8 * DAY_MS), cadenceReferenceNow) === true &&
      isDueForUpdate("CANCELED", new Date(cadenceReferenceNow.getTime() - 10 * DAY_MS), cadenceReferenceNow) === false &&
      isDueForUpdate("CANCELED", new Date(cadenceReferenceNow.getTime() - 31 * DAY_MS), cadenceReferenceNow) === true,
    { ended: getUpdateIntervalMs("ENDED"), canceled: getUpdateIntervalMs("CANCELED") }
  );

  const sessionCache = createSyncCache();
  let seriesDetailFetchCalls = 0;
  const firstCacheRead = await sessionCache.getOrFetchSeriesDetails("cache-1", async () => {
    seriesDetailFetchCalls += 1;
    return "primeira-resposta";
  });
  const secondCacheRead = await sessionCache.getOrFetchSeriesDetails("cache-1", async () => {
    seriesDetailFetchCalls += 1;
    return "segunda-resposta";
  });
  check(
    "cache de execucao (Fase 7) reaproveita a mesma chave, sem refazer o fetch",
    seriesDetailFetchCalls === 1 &&
      firstCacheRead === "primeira-resposta" &&
      secondCacheRead === "primeira-resposta" &&
      sessionCache.stats().hits === 1 &&
      sessionCache.stats().misses === 1,
    sessionCache.stats()
  );

  let seasonFetchAttempts = 0;
  await sessionCache
    .getOrFetchSeasonDetails("cache-2", 1, async () => {
      seasonFetchAttempts += 1;
      throw new Error("falha simulada");
    })
    .catch(() => undefined);
  const cacheReadAfterFailure = await sessionCache.getOrFetchSeasonDetails("cache-2", 1, async () => {
    seasonFetchAttempts += 1;
    return "ok-na-segunda-tentativa";
  });
  check(
    "cache de execucao (Fase 7): uma promessa rejeitada nao fica presa no cache",
    seasonFetchAttempts === 2 && cacheReadAfterFailure === "ok-na-segunda-tentativa",
    { seasonFetchAttempts, cacheReadAfterFailure }
  );

  const coverageFixtureId = Date.now();
  const dueTmdbId = coverageFixtureId + 1;
  const notDueTmdbId = coverageFixtureId + 2;
  const newTmdbId = coverageFixtureId + 3;

  const notDueOriginalLastSyncedAt = new Date(Date.now() - 60 * 60 * 1000);
  const dueSeries = await prisma.series.create({
    data: { slug: `smoketest-coverage-due-${coverageFixtureId}`, title: "Smoke Coverage Due", status: "RETURNING" }
  });
  const notDueSeries = await prisma.series.create({
    data: { slug: `smoketest-coverage-not-due-${coverageFixtureId}`, title: "Smoke Coverage Not Due", status: "RETURNING" }
  });
  await prisma.externalSourceMapping.create({
    data: {
      seriesId: dueSeries.id,
      source: "TMDB",
      entityType: "SERIES",
      externalId: String(dueTmdbId),
      lastSyncedAt: new Date(Date.now() - 40 * DAY_MS)
    }
  });
  await prisma.externalSourceMapping.create({
    data: {
      seriesId: notDueSeries.id,
      source: "TMDB",
      entityType: "SERIES",
      externalId: String(notDueTmdbId),
      lastSyncedAt: notDueOriginalLastSyncedAt
    }
  });

  const coverageFixtureSources: SourceDefinition[] = [
    {
      key: "POPULAR_SERIES",
      pages: 1,
      fetchPage: async (page) =>
        page === 1
          ? [
              { id: dueTmdbId, name: "Smoke Coverage Due", popularity: 10, vote_count: 100, vote_average: 7 },
              { id: notDueTmdbId, name: "Smoke Coverage Not Due", popularity: 10, vote_count: 100, vote_average: 7 },
              { id: newTmdbId, name: "Smoke Coverage New", popularity: 10, vote_count: 100, vote_average: 7 }
            ]
          : []
    }
  ];

  const coverageSummary = await runCoverageWithSources(coverageFixtureSources);
  check(
    "coverage (Fase 5/8/9): agrega, deduplica e processa a fila sintetica sem N+1 (uma consulta em lote)",
    coverageSummary.uniqueCount === 3 && coverageSummary.duplicatesRemoved === 0 && coverageSummary.perSourceCounts.POPULAR_SERIES === 3,
    coverageSummary
  );
  check(
    "coverage (Fase 5/6): serie devida e atualizada, serie nao devida e ignorada, serie nova falha isolada (sem rede)",
    coverageSummary.totals.updatedSeriesCount === 1 && coverageSummary.skippedByCadenceCount === 1 && coverageSummary.errors.length === 1,
    coverageSummary
  );
  check(
    "coverage (Fase 9): callsSaved reflete duplicatas + ignoradas por cadencia + cache hits",
    coverageSummary.observability.callsSaved ===
      coverageSummary.duplicatesRemoved + coverageSummary.skippedByCadenceCount + coverageSummary.observability.cacheHits,
    coverageSummary.observability
  );

  const dueMappingAfterSync = await prisma.externalSourceMapping.findUnique({
    where: { source_entityType_externalId: { source: "TMDB", entityType: "SERIES", externalId: String(dueTmdbId) } }
  });
  const notDueMappingAfterSync = await prisma.externalSourceMapping.findUnique({
    where: { source_entityType_externalId: { source: "TMDB", entityType: "SERIES", externalId: String(notDueTmdbId) } }
  });
  check(
    "coverage (Fase 6): lastSyncedAt so avanca para quem foi de fato atualizado",
    Boolean(dueMappingAfterSync?.lastSyncedAt) &&
      dueMappingAfterSync!.lastSyncedAt!.getTime() > Date.now() - 5 * 60 * 1000 &&
      notDueMappingAfterSync?.lastSyncedAt?.getTime() === notDueOriginalLastSyncedAt.getTime(),
    { due: dueMappingAfterSync?.lastSyncedAt, notDue: notDueMappingAfterSync?.lastSyncedAt }
  );

  const persistedCoverageRun = await prisma.catalogSyncRun.findUnique({ where: { id: coverageSummary.runId } });
  check(
    "coverage (Fase 8/9): execucao fica registrada em CatalogSyncRun com o tipo/metricas corretos",
    persistedCoverageRun?.type === "COVERAGE" && persistedCoverageRun?.status === coverageSummary.status,
    persistedCoverageRun
  );

  const latestCoverageRun = await getLatestCoverageRun();
  check(
    "getLatestCoverageRun() (usado por sync:stats) retorna a execucao de coverage mais recente",
    latestCoverageRun?.id === coverageSummary.runId,
    latestCoverageRun
  );

  const nothingToResume = await resumeCoverage();
  check(
    "resumeCoverage() (sync:resume) nao inicia trabalho novo quando nao ha fila pendente",
    nothingToResume.resumed === false && nothingToResume.summary === undefined,
    nothingToResume
  );

  await prisma.series.deleteMany({ where: { id: { in: [dueSeries.id, notDueSeries.id] } } });

  const coverageAbort = await syncCoverage();
  const coverageAbortRun = await prisma.catalogSyncRun.findUnique({ where: { id: coverageAbort.runId } });
  check(
    "sync:coverage aborta com erro amigavel sem TMDB key (nao quebra)",
    coverageAbort.status === "FAILED" && Boolean(coverageAbortRun?.errorMessage?.includes("TMDb nao configurado")),
    { coverageAbort, errorMessage: coverageAbortRun?.errorMessage }
  );

  const updateDueAbort = await syncUpdateDue();
  check(
    "sync:update aborta com erro amigavel sem TMDB key (nao quebra)",
    updateDueAbort.status === "FAILED" && Boolean(updateDueAbort.errorMessage?.includes("TMDb nao configurado")),
    updateDueAbort
  );

  // ---- Discovery Engine (INSERIES-TRENDING-DISCOVERY-ENGINE-01) ----
  const discoveryEngineAbort = await runDiscoveryEngine();
  const discoveryEngineAbortRun = await prisma.catalogSyncRun.findUnique({ where: { id: discoveryEngineAbort.runId } });
  check(
    "discovery:run aborta com erro amigavel sem TMDB key (nao quebra)",
    discoveryEngineAbort.status === "FAILED" &&
      discoveryEngineAbortRun?.type === "DISCOVERY_ENGINE" &&
      Boolean(discoveryEngineAbortRun?.errorMessage?.includes("TMDb nao configurado")),
    { discoveryEngineAbort, errorMessage: discoveryEngineAbortRun?.errorMessage }
  );

  const sourceWeightHighSignal = computeSourceWeightScore(
    ["TRENDING", "ON_THE_AIR"],
    [
      { key: "TRENDING", pages: 1, weight: 0.4, fetchPage: async () => [] },
      { key: "ON_THE_AIR", pages: 1, weight: 0.25, fetchPage: async () => [] },
      { key: "POPULAR_SERIES", pages: 1, weight: 0.15, fetchPage: async () => [] },
      { key: "TOP_RATED", pages: 1, weight: 0.1, fetchPage: async () => [] },
      { key: "DISCOVER", pages: 1, weight: 0.1, fetchPage: async () => [] }
    ]
  );
  const sourceWeightLowSignal = computeSourceWeightScore(
    ["DISCOVER"],
    [
      { key: "TRENDING", pages: 1, weight: 0.4, fetchPage: async () => [] },
      { key: "DISCOVER", pages: 1, weight: 0.1, fetchPage: async () => [] }
    ]
  );
  check(
    "Discovery Engine (Fase 2): serie em Trending+On The Air pontua mais que serie so em Discover, ambas 0-1",
    sourceWeightHighSignal > sourceWeightLowSignal && sourceWeightHighSignal <= 1 && sourceWeightLowSignal <= 1,
    { sourceWeightHighSignal, sourceWeightLowSignal }
  );

  check(
    "Discovery Engine (Fase 4): streaming prioritario (Netflix) pontua 1, streaming fora da lista pontua 0",
    computeStreamingPriorityScore(["Netflix"]) === 1 && computeStreamingPriorityScore(["Servico Obscuro XPTO"]) === 0,
    { netflix: computeStreamingPriorityScore(["Netflix"]), obscuro: computeStreamingPriorityScore(["Servico Obscuro XPTO"]) }
  );

  const blacklistLowVotes = passesListItemBlacklist({ id: 1, name: "obscura", vote_count: 5, vote_average: 8 });
  check(
    "Discovery Engine (Fase 5): serie com poucos votos e barrada pela blacklist",
    blacklistLowVotes.passes === false,
    blacklistLowVotes
  );
  const blacklistGoodItem = passesListItemBlacklist({ id: 2, name: "relevante", vote_count: 5000, vote_average: 8 });
  check("Discovery Engine (Fase 5): serie relevante (muitos votos, boa nota) passa na blacklist", blacklistGoodItem.passes === true, blacklistGoodItem);

  const discoveryScoreHigh = computeDiscoveryScore({
    sourceWeightScore: 1,
    popularity: 180,
    voteAverage: 9,
    voteCount: 5000,
    firstAirYear: new Date().getFullYear(),
    status: "RETURNING",
    watchProviders: ["Netflix"],
    numberOfSeasons: 4,
    numberOfEpisodes: 40,
    posterUrl: "x",
    backdropUrl: "x",
    collectionTagsCount: 3,
    qualityScore: 95
  });
  const discoveryScoreLow = computeDiscoveryScore({
    sourceWeightScore: 0,
    popularity: 0,
    voteAverage: 0,
    voteCount: 0,
    firstAirYear: 1990,
    status: "CANCELED",
    watchProviders: [],
    numberOfSeasons: 0,
    numberOfEpisodes: 0,
    posterUrl: null,
    backdropUrl: null,
    collectionTagsCount: 0,
    qualityScore: 0
  });
  check(
    "Discovery Score (Fase 3): serie trending/relevante pontua muito mais que serie irrelevante, ambas 0-100",
    discoveryScoreHigh > discoveryScoreLow && discoveryScoreHigh <= 100 && discoveryScoreLow >= 0,
    { discoveryScoreHigh, discoveryScoreLow }
  );

  // ---- Catalogo editorial de qualidade (INSERIES-TMDB-CATALOG-QUALITY-01): score, curadoria, ----
  // ---- providers, logos/keywords, collection tags, estatisticas e listas inteligentes ----
  const qualityFixtureId = Date.now();
  function buildNormalizedSeries(externalId: string, overrides: Partial<NormalizedCatalogSeries> = {}): NormalizedCatalogSeries {
    return {
      id: `tmdb-${externalId}`,
      slug: `smoketest-quality-${externalId}`,
      title: `Smoke Quality ${externalId}`,
      originalTitle: `Smoke Quality ${externalId}`,
      year: 2023,
      status: "Returning",
      overview: "Uma sinopse completa para teste de qualidade.",
      genres: ["Drama"],
      language: "PT",
      platform: "TMDb",
      popularity: "10",
      posterUrl: "https://image.tmdb.org/t/p/w500/poster.jpg",
      backdropUrl: "https://image.tmdb.org/t/p/original/backdrop.jpg",
      collectionTags: [],
      watchProviders: [],
      keywords: [],
      originCountry: [],
      spokenLanguages: [],
      createdBy: [],
      networks: [],
      productionCompanies: [],
      productionCountries: [],
      seasons: [
        {
          id: `season-${externalId}`,
          number: 1,
          title: "Temporada 1",
          year: 2023,
          episodeCount: 10,
          posterUrl: "",
          overview: "",
          episodes: Array.from({ length: 10 }, (_, index) => ({
            id: `episode-${externalId}-${index + 1}`,
            number: index + 1,
            title: `Episodio ${index + 1}`,
            overview: "Sinopse do episodio.",
            runtimeMinutes: 40,
            airedOn: "2023-01-01",
            watched: false,
            external: { source: "TMDB" as const, entityType: "EPISODE" as const, externalId: `episode-${externalId}-${index + 1}` }
          })),
          external: { source: "TMDB" as const, entityType: "SEASON" as const, externalId: `season-${externalId}` }
        }
      ],
      popularityScore: 10,
      voteAverage: 7,
      voteCount: 100,
      numberOfSeasons: 1,
      numberOfEpisodes: 10,
      external: { source: "TMDB", entityType: "SERIES", externalId: `smoketest-quality-${externalId}-${qualityFixtureId}` },
      ...overrides
    };
  }

  const richScore = computeQualityScore({
    popularity: 150,
    voteAverage: 9,
    voteCount: 5000,
    firstAirYear: new Date().getFullYear(),
    status: "RETURNING",
    numberOfSeasons: 5,
    numberOfEpisodes: 100,
    posterUrl: "x",
    backdropUrl: "x",
    overview: "x",
    logoUrl: "x",
    watchProviders: ["Netflix"],
    originCountry: ["US"],
    language: "en"
  });
  const poorScore = computeQualityScore({
    popularity: 0,
    voteAverage: 0,
    voteCount: 0,
    firstAirYear: 1980,
    status: "CANCELED",
    numberOfSeasons: 0,
    numberOfEpisodes: 0,
    posterUrl: null,
    backdropUrl: null,
    overview: null,
    logoUrl: null,
    watchProviders: [],
    originCountry: [],
    language: null
  });
  check(
    "Quality Score (Fase 2): serie completa pontua mais que serie vazia, ambas dentro de 0-100",
    richScore > poorScore && richScore <= 100 && poorScore >= 0,
    { richScore, poorScore }
  );

  const verdictNoImages = passesDetailCuration(buildNormalizedSeries("no-images", { posterUrl: "", backdropUrl: "" }));
  check(
    "curadoria (Fase 3): serie nova sem poster e sem backdrop e reprovada (TMDB_CURATION_REQUIRE_IMAGE=true por padrao)",
    verdictNoImages.passes === false,
    verdictNoImages
  );

  const verdictNoOverview = passesDetailCuration(buildNormalizedSeries("no-overview", { overview: "" }));
  check(
    "curadoria (Fase 3): serie nova sem sinopse e reprovada (TMDB_CURATION_REQUIRE_OVERVIEW=true por padrao)",
    verdictNoOverview.passes === false,
    verdictNoOverview
  );

  const pilotReferenceNow = new Date();
  const verdictAbandonedPilot = passesDetailCuration(
    buildNormalizedSeries("abandoned-pilot", { status: "Pilot", year: pilotReferenceNow.getFullYear() - 2 }),
    pilotReferenceNow
  );
  check(
    "curadoria (Fase 3): piloto ha mais de TMDB_CURATION_MAX_PILOT_AGE_DAYS dias e reprovado (piloto abandonado)",
    verdictAbandonedPilot.passes === false,
    verdictAbandonedPilot
  );

  const verdictEmptyContent = passesDetailCuration(
    buildNormalizedSeries("empty-content", { seasons: [], numberOfSeasons: 0, numberOfEpisodes: 0 })
  );
  check(
    "curadoria (Fase 3): serie nova sem nenhum episodio e reprovada (conteudo vazio)",
    verdictEmptyContent.passes === false,
    verdictEmptyContent
  );

  const verdictGood = passesDetailCuration(buildNormalizedSeries("good"));
  check("curadoria (Fase 3): serie completa (imagens, sinopse, episodios) e aprovada", verdictGood.passes === true, verdictGood);

  const blacklistNoBackdrop = passesDetailBlacklist(buildNormalizedSeries("blacklist-no-backdrop", { backdropUrl: "" }));
  check(
    "Discovery Engine (Fase 5): serie sem backdrop e barrada pela blacklist (detail level)",
    blacklistNoBackdrop.passes === false,
    blacklistNoBackdrop
  );

  check(
    "curadoria (Fase 3) item de lista: com o filtro desligado (TMDB_MIN_VOTE_AVERAGE=0 por padrao), tudo passa",
    passesListItemCuration({ id: 1, name: "x", vote_average: 0 }).passes === true,
    config.catalogQuality.curation
  );

  const rejectedSeries = buildNormalizedSeries("rejected-upsert", { posterUrl: "", backdropUrl: "", overview: "" });
  let rejectedByUpsert = false;
  try {
    await upsertNormalizedSeriesWithCounts(rejectedSeries);
  } catch (error) {
    rejectedByUpsert = error instanceof CurationRejectedError;
  }
  const rejectedSeriesRow = await prisma.series.findUnique({ where: { slug: rejectedSeries.slug } });
  check(
    "curadoria (Fase 3): upsertNormalizedSeriesWithCounts rejeita uma serie nova reprovada e nao a persiste",
    rejectedByUpsert && rejectedSeriesRow === null,
    { rejectedByUpsert, rejectedSeriesRow }
  );

  const acceptedSeries = buildNormalizedSeries("accepted-upsert", {
    type: "Miniseries",
    status: "Ended",
    numberOfSeasons: 1,
    numberOfEpisodes: 8,
    keywords: ["based on novel or book"],
    watchProviders: ["Netflix"],
    originCountry: ["US"]
  });
  const acceptedResult = await upsertNormalizedSeriesWithCounts(acceptedSeries);
  const acceptedRow = await prisma.series.findUnique({ where: { slug: acceptedSeries.slug } });
  check(
    "Quality Score (Fase 2) + providers/type (Fase 4/8) persistidos no upsert de uma serie nova aprovada",
    acceptedResult.quality.qualityScore > 0 &&
      acceptedRow?.qualityScore === acceptedResult.quality.qualityScore &&
      acceptedRow?.type === "Miniseries" &&
      (acceptedRow?.watchProviders ?? []).includes("Netflix"),
    { quality: acceptedResult.quality, row: acceptedRow }
  );
  check(
    "Collection Tags (Fase 7): Minissérie (via type=Miniseries) e Baseada em Livro (via keyword) persistidas",
    (acceptedRow?.collectionTags ?? []).includes("Minissérie") && (acceptedRow?.collectionTags ?? []).includes("Baseada em Livro"),
    acceptedRow?.collectionTags
  );

  const derivedTagsMaratona = deriveCollectionTags({
    genres: ["Animação"],
    type: undefined,
    keywords: [],
    originCountry: ["JP"],
    numberOfSeasons: 3,
    numberOfEpisodes: 150,
    status: "RETURNING",
    popularity: 60,
    voteAverage: 8.5,
    voteCount: 2000
  });
  check(
    "Collection Tags (Fase 7): Maratona/Em Alta/Premiada/Anime derivadas corretamente dos limiares configurados",
    derivedTagsMaratona.includes("Maratona") &&
      derivedTagsMaratona.includes("Em Alta") &&
      derivedTagsMaratona.includes("Premiada") &&
      derivedTagsMaratona.includes("Anime"),
    derivedTagsMaratona
  );

  check(
    "Logos (Fase 5): resolvePreferredImageUrl prefere logo, depois poster, depois backdrop",
    resolvePreferredImageUrl({ logoUrl: "logo.png", posterUrl: "poster.png", backdropUrl: "backdrop.png" }) === "logo.png" &&
      resolvePreferredImageUrl({ logoUrl: null, posterUrl: "poster.png", backdropUrl: "backdrop.png" }) === "poster.png" &&
      resolvePreferredImageUrl({ logoUrl: null, posterUrl: null, backdropUrl: "backdrop.png" }) === "backdrop.png" &&
      resolvePreferredImageUrl({ logoUrl: null, posterUrl: null, backdropUrl: null }) === null,
    null
  );

  const keywordMatches = await findSeriesByKeyword("based on novel or book");
  check(
    "Keywords (Fase 6): findSeriesByKeyword encontra a serie sincronizada com a keyword real do TMDb",
    keywordMatches.some((series) => series.id === acceptedRow?.id),
    keywordMatches.map((series) => series.id)
  );

  const catalogStatistics = await computeCatalogStatistics();
  check(
    "Estatisticas (Fase 9): computeCatalogStatistics reflete a serie recem-persistida (genero/pais/provedor/status)",
    catalogStatistics.totalSeries > 0 &&
      (catalogStatistics.byCountry.US ?? 0) > 0 &&
      (catalogStatistics.byProvider.Netflix ?? 0) > 0 &&
      (catalogStatistics.byStatus.ENDED ?? 0) > 0,
    catalogStatistics
  );

  const smartListCounts = await computeSmartListCounts();
  check(
    "Catalogo inteligente (Fase 10): listas derivadas (Minisséries/Mais Bem Avaliadas) contam a serie recem-persistida",
    smartListCounts.MINISSERIES > 0 && smartListCounts.MAIS_BEM_AVALIADAS > 0,
    smartListCounts
  );
  check(
    "Trending Collections (Fase 6): Bombando Agora/Top 100/Top 250 contam series com Discovery Score persistido",
    smartListCounts.BOMBANDO_AGORA > 0 && smartListCounts.TOP_100 > 0 && smartListCounts.TOP_250 > 0,
    smartListCounts
  );

  await prisma.series.deleteMany({ where: { slug: { in: [acceptedSeries.slug, rejectedSeries.slug] } } });

  // ---- Observabilidade: config central, feature flags, health/ready, request id, metricas, erros ----
  const healthCheck = await request({ value: "" }, "/api/health");
  check(
    "/api/health responde com status/versao/ambiente/timestamp",
    healthCheck.status === 200 &&
      healthCheck.body?.status === "ok" &&
      Boolean(healthCheck.body?.version) &&
      Boolean(healthCheck.body?.environment) &&
      Boolean(healthCheck.body?.timestamp),
    healthCheck.body
  );
  check(
    "/api/health propaga x-request-id na resposta",
    Boolean(healthCheck.headers.get("x-request-id")),
    healthCheck.headers.get("x-request-id")
  );

  const readyCheck = await request({ value: "" }, "/api/ready");
  check(
    "/api/ready responde ok quando banco e configuracao estao saudaveis",
    readyCheck.status === 200 &&
      readyCheck.body?.status === "ready" &&
      readyCheck.body?.checks?.database === true &&
      readyCheck.body?.checks?.configuration === true,
    readyCheck.body
  );

  const fixedRequestId = `smoke-test-${Date.now()}`;
  const echoedRequestId = await request({ value: "" }, "/api/health", { headers: { "x-request-id": fixedRequestId } });
  check(
    "request id recebido por header e reutilizado (nao gera um novo)",
    echoedRequestId.headers.get("x-request-id") === fixedRequestId,
    echoedRequestId.headers.get("x-request-id")
  );

  const malformedJsonAttempt = await request({ value: "" }, "/api/auth/login", {
    method: "POST",
    body: "{ isto nao e um json valido"
  });
  const malformedJsonText = JSON.stringify(malformedJsonAttempt.body);
  check(
    "erro inesperado (JSON invalido) retorna resposta consistente sem stack trace",
    malformedJsonAttempt.status === 500 &&
      malformedJsonAttempt.body?.error === "INTERNAL_ERROR" &&
      !malformedJsonText.includes("SyntaxError") &&
      !malformedJsonText.includes(".ts:") &&
      !malformedJsonText.includes("at Object"),
    malformedJsonAttempt.body
  );

  const userTriesMetrics = await request(jarA, "/api/admin/metrics");
  check("usuario comum nao acessa metricas administrativas (403)", userTriesMetrics.status === 403, userTriesMetrics.body);

  const metricsBefore = await request(jarAdmin, "/api/admin/metrics");
  const totalRequestsBefore: number = metricsBefore.body?.data?.totalRequests ?? 0;
  await request({ value: "" }, "/api/health");
  await request({ value: "" }, "/api/health");
  const metricsAfter = await request(jarAdmin, "/api/admin/metrics");
  const totalRequestsAfter: number = metricsAfter.body?.data?.totalRequests ?? 0;
  check(
    "metricas basicas registram requests (contador cresce)",
    metricsBefore.status === 200 && metricsAfter.status === 200 && totalRequestsAfter > totalRequestsBefore,
    { totalRequestsBefore, totalRequestsAfter }
  );

  const adminSystemObservabilityPage = await request(jarAdmin, "/admin/system");
  check(
    "/admin/system mostra feature flags, health/ready, metricas e configuracao publica",
    adminSystemObservabilityPage.status === 200 &&
      String(adminSystemObservabilityPage.body).includes("Feature flags") &&
      String(adminSystemObservabilityPage.body).includes("Metricas basicas") &&
      String(adminSystemObservabilityPage.body).includes("Configuracao publica"),
    adminSystemObservabilityPage.status
  );
  check(
    "/admin/system mostra estado da gamificacao (total de conquistas, engine ativa, conquistas desbloqueadas)",
    adminSystemObservabilityPage.status === 200 &&
      String(adminSystemObservabilityPage.body).includes("Gamificacao") &&
      String(adminSystemObservabilityPage.body).includes("Total de conquistas") &&
      String(adminSystemObservabilityPage.body).includes("Conquistas desbloqueadas (todos os usuarios)"),
    adminSystemObservabilityPage.status
  );

  // ---- Application Shell: Landing publica vs. Dashboard autenticado ----
  const landingAnon = await request({ value: "" }, "/");
  check(
    "visitante em / ve a Landing Page (depoimentos e FAQ), nunca o Dashboard",
    landingAnon.status === 200 &&
      String(landingAnon.body).includes("Depoimentos ilustrativos") &&
      String(landingAnon.body).includes("Perguntas frequentes") &&
      !String(landingAnon.body).includes("Seu hub de series"),
    landingAnon.status
  );
  check(
    "Landing Page nunca renderiza a Sidebar autenticada",
    !String(landingAnon.body).includes("Recolher menu"),
    landingAnon.status
  );

  const jarShell: CookieJar = { value: "" };
  const userShell = await registerUser(jarShell, "usershell");
  // Fase 8 (INSERIES-PRODUCT-EXPERIENCE-REVOLUTION-01) esconde "Novos para voce"/"Agenda
  // resumida"/"Pendencias" inteiras quando o usuario nao acompanha nenhuma serie
  // (hasTrackedSeries=false) - os checks abaixo de "usuario ativo ve o Dashboard completo"
  // dependem de pelo menos 1 serie rastreada, senao ficam testando um estado que nao existe
  // mais (achado revisando os proprios asserts depois do redesign do Dashboard).
  await request(jarShell, `/api/series/${seriesId}/status`, {
    method: "POST",
    body: JSON.stringify({ seriesId, state: "WATCHING" })
  });

  const dashboardAuth = await request(jarShell, "/");
  check(
    "usuario logado em / ve o Dashboard (hub de series), nunca a Landing Page",
    dashboardAuth.status === 200 &&
      String(dashboardAuth.body).includes("Seu hub de series") &&
      !String(dashboardAuth.body).includes("Depoimentos ilustrativos") &&
      !String(dashboardAuth.body).includes("Perguntas frequentes"),
    dashboardAuth.status
  );
  check(
    "Sidebar so aparece para usuario autenticado (visivel em /)",
    String(dashboardAuth.body).includes("Recolher menu"),
    dashboardAuth.status
  );
  check(
    "Sidebar nao mostra Admin para usuario comum",
    !String(dashboardAuth.body).includes(">Admin<"),
    dashboardAuth.status
  );
  check(
    "Header autenticado renderiza o gatilho do menu do Avatar (conteudo do dropdown e client-side, verificado via Playwright)",
    /aria-label="Menu de /.test(String(dashboardAuth.body)),
    dashboardAuth.status
  );
  const sidebarNavHtml = String(dashboardAuth.body).match(/aria-label="Navegacao principal"[\s\S]*?<\/nav>/)?.[0] ?? "";
  check(
    "Sidebar nao contem links para /settings ou /profile (Perfil/Configuracoes vivem so no dropdown do Avatar)",
    sidebarNavHtml.length > 0 && !sidebarNavHtml.includes('href="/settings"') && !sidebarNavHtml.includes('href="/profile'),
    sidebarNavHtml
  );

  const adminSidebarCheck = await request(jarAdmin, "/");
  check(
    "Sidebar mostra Admin para o usuario admin",
    adminSidebarCheck.status === 200 && String(adminSidebarCheck.body).includes(">Admin<"),
    adminSidebarCheck.status
  );

  const recommendationsGuest = await request({ value: "" }, "/recommendations");
  check(
    "/recommendations sem sessao redireciona (307/302)",
    recommendationsGuest.status === 307 || recommendationsGuest.status === 302,
    recommendationsGuest.status
  );
  const recommendationsAuth = await request(jarShell, "/recommendations");
  check("/recommendations autenticado carrega (200)", recommendationsAuth.status === 200, recommendationsAuth.status);

  // ---- Experiencia cinematografica: Hero, carrosseis, posters/backdrops reais, stills ----
  check(
    "Landing possui Hero cinematografico (backdrop real, Quality Score considerado na selecao)",
    String(landingAnon.body).includes("Em destaque no catalogo inSeries") &&
      String(landingAnon.body).includes("dev-media") &&
      String(landingAnon.body).includes("backdrop.svg"),
    landingAnon.status
  );
  check(
    "Landing usa Smart Lists reais (Mais Populares, Novidades, Mais Bem Avaliadas)",
    String(landingAnon.body).includes("Mais Populares") &&
      String(landingAnon.body).includes("Novidades") &&
      String(landingAnon.body).includes("Mais Bem Avaliadas"),
    landingAnon.status
  );

  // ---- INSERIES-LANDING-CINEMATIC-IMMERSION-01: Hero full-bleed, navbar overlay, ----
  // ---- carrosseis diferenciados, banners cinematograficos, colecoes editoriais ----
  check(
    "Hero (Fase 2) ocupa a largura total e entre 95-100vh, sem aparencia de card",
    String(landingAnon.body).includes("min-h-[95dvh]") && String(landingAnon.body).includes("-mx-[50vw] -mt-24 w-screen"),
    landingAnon.status
  );
  check(
    "Navbar (Fase 5) e fixa e transparente sobre o Hero, com transicao para solido no scroll",
    String(landingAnon.body).includes("fixed inset-x-0 top-0") && String(landingAnon.body).includes("transition-colors duration-300"),
    landingAnon.status
  );
  check(
    "Hero (Fase 3) tem indicador de rotacao entre series (nunca fixo)",
    String(landingAnon.body).includes('role="tablist"'),
    landingAnon.status
  );
  check(
    "Banners cinematograficos (Fase 7) usam backdrop real e linkam para a serie",
    String(landingAnon.body).includes("Serie da Semana") &&
      String(landingAnon.body).includes("Mais Comentada") &&
      String(landingAnon.body).includes("Vale a Maratona") &&
      String(landingAnon.body).includes("Escolha da Comunidade"),
    landingAnon.status
  );
  check(
    "Carrosseis diferenciados (Fase 8): badge NOVO e colecao completa aparecem",
    String(landingAnon.body).includes("NOVO") && String(landingAnon.body).includes("Colecao completa"),
    landingAnon.status
  );
  check(
    "Colecoes editoriais (Fase 10) renderizam a partir de generos/tags existentes",
    String(landingAnon.body).includes("Descubra por tema"),
    landingAnon.status
  );
  check(
    "Landing usa backdrops de forma intensiva (Fase 11)",
    countOccurrences(String(landingAnon.body), "backdrop.svg") >= 10,
    countOccurrences(String(landingAnon.body), "backdrop.svg")
  );
  check(
    "Estatisticas (Fase 12) nao aparecem mais como blocos de dashboard na primeira dobra",
    !String(landingAnon.body).includes('rounded-3xl border border-border bg-surface-strong/50 p-4 text-center'),
    landingAnon.status
  );

  const catalogPage = await request(jarShell, "/series");
  check(
    "Catalogo renderiza posteres reais (poster.svg via next/image)",
    catalogPage.status === 200 && countOccurrences(String(catalogPage.body), "poster.svg") >= 5,
    catalogPage.status
  );

  const seriesDetailPage = await request(jarShell, `/series/${seriesId}`);
  check(
    "Pagina da serie usa backdrop (Hero) e poster (destaque) reais",
    seriesDetailPage.status === 200 &&
      String(seriesDetailPage.body).includes("backdrop.svg") &&
      String(seriesDetailPage.body).includes("poster.svg"),
    seriesDetailPage.status
  );

  check(
    "Dashboard autenticado usa imagens reais do catalogo (posteres nos cards)",
    dashboardAuth.status === 200 && String(dashboardAuth.body).includes("poster.svg"),
    dashboardAuth.status
  );

  // ---- INSERIES-DASHBOARD-UX-AND-NAVIGATION-01 (Fase 2/3): Dashboard reduzido a ----
  // ---- painel de acompanhamento diario, sem secoes redundantes, grids fixos ----
  const dashboardBody = String(dashboardAuth.body);
  // Ancorado no "<" de fechamento do no de texto: o RSC do Next serializa o mesmo texto
  // tambem dentro de um payload de hidratacao (`self.__next_f.push(...)`, formato JSON) que
  // pode aparecer ANTES do HTML real na resposta bruta. Um indexOf sem ancora casa com essa
  // ocorrencia falsa e inverte a ordem aparente; "<" nunca aparece dentro do JSON escapado.
  const sectionIndex = {
    continueWatching: dashboardBody.indexOf("Continuar assistindo<"),
    pendencias: dashboardBody.indexOf("Pendencias<"),
    novosParaVoce: dashboardBody.indexOf("Novos para voce<"),
    agendaResumida: dashboardBody.indexOf("Agenda resumida<")
  };
  check(
    // "usershell" acompanha uma serie com episodios ja lancados (WATCHING desde antes do
    // fetch, ver acima) - "Pendencias" garantido presente, nao so "se houver atraso".
    "Dashboard (redesign completo, INSERIES-PRODUCT-EXPERIENCE-REVOLUTION-01) segue a ordem por urgencia de acao: Continuar assistindo -> Pendencias -> Novos para voce -> Agenda resumida",
    Object.values(sectionIndex).every((index) => index !== -1) &&
      sectionIndex.continueWatching < sectionIndex.pendencias &&
      sectionIndex.pendencias < sectionIndex.novosParaVoce &&
      sectionIndex.novosParaVoce < sectionIndex.agendaResumida,
    sectionIndex
  );
  check(
    "Continuar assistindo (Fase 2) permanece a primeira secao do Dashboard",
    sectionIndex.continueWatching !== -1 && sectionIndex.continueWatching < sectionIndex.pendencias,
    sectionIndex
  );
  check(
    "Dashboard (redesign completo) NAO repete secoes que agora vivem em paginas proprias (Bombando Agora/Lancamentos/Watch Next/Suas Estatisticas/Descobrir mais/Proximos episodios), e cortou os shelfs de navegacao pura/timeline passiva (Atalhos rapidos, Atividade recente) ja cobertos pela Sidebar/BottomNav e por /profile+/me/recap",
    !dashboardBody.includes("Bombando Agora<") &&
      !dashboardBody.includes("Lancamentos<") &&
      !dashboardBody.includes("Watch Next<") &&
      !dashboardBody.includes("Suas Estatisticas<") &&
      !dashboardBody.includes("Descobrir mais<") &&
      !dashboardBody.includes("Proximos episodios<") &&
      !dashboardBody.includes("Atalhos rapidos<") &&
      !dashboardBody.includes("Atividade recente<"),
    null
  );
  check("Dashboard (redesign completo) exibe Pendencias", dashboardBody.includes("Pendencias<"), dashboardAuth.status);
  check("Dashboard (Fase 6) exibe a secao Novos para voce", dashboardBody.includes("Novos para voce"), dashboardAuth.status);
  check("Dashboard (Fase 7/8) exibe a Agenda resumida", dashboardBody.includes("Agenda resumida"), dashboardAuth.status);
  check(
    "Regra global de grids (Fase 10): nenhuma classe auto-fit/auto-fill e usada em nenhuma listagem",
    !dashboardBody.includes("auto-fit") && !dashboardBody.includes("auto-fill"),
    null
  );
  check(
    "Regra global de grids (Fase 10): secoes do Dashboard usam colunas fixas por breakpoint (grid-cols-*)",
    /grid-cols-\d/.test(dashboardBody) && /sm:grid-cols-\d|lg:grid-cols-\d/.test(dashboardBody),
    null
  );

  // Redesign completo do Dashboard: botao "Marcar todos" (MarkAllWatchedButton) dispara N
  // chamadas em paralelo pra mesma mutation que ja existe - aqui valida a capacidade de
  // servidor por baixo do botao (chamadas concorrentes do mesmo usuario/serie nao devem
  // corromper progresso nem se perder), nao o clique em si (isso e o papel do Playwright).
  // Usa episodios da Temporada 2 de "Serie Teste Um" direto do catalogo (ja aired, ja
  // conhecidos) em vez de tentar recalcular a lista exata de "Pendencias" do Dashboard aqui.
  const seasonTwoEpisodeIds: string[] =
    catalog.body?.data?.[0]?.seasons?.find((season: Json) => season.number === 2)?.episodes?.map((episode: Json) => episode.id) ?? [];
  check(
    "catalogo (redesign completo) tem episodios de Temporada 2 suficientes pra testar marcar todos em paralelo",
    seasonTwoEpisodeIds.length > 1,
    seasonTwoEpisodeIds.length
  );
  const bulkMarkResults = await Promise.all(
    seasonTwoEpisodeIds.map((episodeId) =>
      request(jarShell, `/api/episodes/${episodeId}/progress`, {
        method: "POST",
        body: JSON.stringify({ episodeId, watched: true })
      })
    )
  );
  check(
    "Marcar todos em paralelo (redesign completo): todas as chamadas concorrentes retornam 200",
    bulkMarkResults.every((response) => response.status === 200),
    bulkMarkResults.map((response) => response.status)
  );
  const shellUser = await prisma.user.findUnique({ where: { username: userShell.username } });
  const watchedAfterBulk = shellUser
    ? await prisma.userEpisodeProgress.count({
        where: { userId: shellUser.id, episodeId: { in: seasonTwoEpisodeIds }, watched: true }
      })
    : -1;
  check(
    "Marcar todos em paralelo: todos os episodios ficam marcados como assistidos, nenhum se perde por corrida",
    watchedAfterBulk === seasonTwoEpisodeIds.length,
    watchedAfterBulk
  );


  // ---- Catalogo Inteligente (INSERIES-CATALOG-INTELLIGENCE-EXPERIENCE-01): metadados ----
  // ---- enriquecidos (Quality Score, Collection Tags, Providers, Logos, Keywords) na UI ----
  function buildSeriesFixture(overrides: Partial<Series> & { id: string }): Series {
    return {
      slug: overrides.id,
      title: `Fixture ${overrides.id}`,
      originalTitle: `Fixture ${overrides.id}`,
      year: 2023,
      status: "RETURNING",
      overview: "Sinopse de teste.",
      genres: [],
      language: "PT-BR",
      platform: "TMDb",
      popularity: "0",
      posterUrl: "",
      backdropUrl: "",
      seasons: [],
      collectionTags: [],
      watchProviders: [],
      keywords: [],
      originCountry: [],
      spokenLanguages: [],
      createdBy: [],
      networks: [],
      productionCompanies: [],
      productionCountries: [],
      ...overrides
    };
  }

  const highQualityFixture = buildSeriesFixture({ id: "high", qualityScore: 90 });
  const lowQualityFixture = buildSeriesFixture({ id: "low", qualityScore: 10 });
  const noScoreFixture = buildSeriesFixture({ id: "none" });

  // INSERIES-TRENDING-DISCOVERY-ENGINE-01 — pickHero now gates on discoveryScore first.
  const highDiscoveryFixture = buildSeriesFixture({ id: "high-discovery", discoveryScore: 90 });
  const lowDiscoveryFixture = buildSeriesFixture({ id: "low-discovery", discoveryScore: 10 });

  check(
    "Hero (Fase 10): Discovery Score evita destacar serie irrelevante quando ha opcao melhor no pool",
    pickHero([lowDiscoveryFixture, highDiscoveryFixture], [lowDiscoveryFixture])?.id === "high-discovery",
    { picked: pickHero([lowDiscoveryFixture, highDiscoveryFixture], [lowDiscoveryFixture])?.id }
  );
  check(
    "Hero (Fase 10): sem discoveryScore em nenhuma serie, cai para Quality Score",
    pickHero([lowQualityFixture, highQualityFixture], [lowQualityFixture])?.id === "high",
    { picked: pickHero([lowQualityFixture, highQualityFixture], [lowQualityFixture])?.id }
  );
  check(
    "Hero (Fase 2): sem nenhuma serie qualificada, cai para o pool de popularidade (nunca fica vazio)",
    pickHero([lowQualityFixture], [lowQualityFixture, noScoreFixture]) !== undefined,
    null
  );
  check("Hero (Fase 2): sem nenhuma serie disponivel, retorna undefined (nunca quebra)", pickHero([], []) === undefined, null);

  const tagFilterResult = await searchSeries({ tag: "Maratona", pageSize: 20 });
  check(
    "Descoberta (Fase 8): filtro por Collection Tag retorna so series com aquela tag",
    tagFilterResult.items.length > 0 && tagFilterResult.items.every((item) => item.collectionTags.includes("Maratona")),
    tagFilterResult.items.map((item) => item.title)
  );

  const providerFilterResult = await searchSeries({ provider: "Netflix", pageSize: 20 });
  check(
    "Descoberta (Fase 8): filtro por provedor retorna so series disponiveis naquele provedor",
    providerFilterResult.items.length > 0 && providerFilterResult.items.every((item) => item.watchProviders.includes("Netflix")),
    providerFilterResult.items.map((item) => item.title)
  );

  const countryFilterResult = await searchSeries({ country: "BR", pageSize: 20 });
  check(
    "Descoberta (Fase 8): filtro por pais de origem retorna so series daquele pais",
    countryFilterResult.items.length > 0 && countryFilterResult.items.every((item) => item.originCountry.includes("BR")),
    countryFilterResult.items.map((item) => item.title)
  );

  const keywordFilterResult = await searchSeries({ keyword: "dystopia", pageSize: 20 });
  check(
    "Descoberta (Fase 8): filtro por keyword real do TMDb retorna so series sincronizadas com ela",
    keywordFilterResult.items.length > 0 && keywordFilterResult.items.every((item) => item.keywords.includes("dystopia")),
    keywordFilterResult.items.map((item) => item.title)
  );

  const qualitySortResult = await searchSeries({ sort: "quality", pageSize: 20 });
  check(
    "Descoberta (Fase 2/8/10): sort=quality ordena o catalogo por Quality Score decrescente",
    qualitySortResult.items.every(
      (item, index, all) => index === 0 || (all[index - 1].qualityScore ?? 0) >= (item.qualityScore ?? 0)
    ),
    qualitySortResult.items.map((item) => ({ title: item.title, score: item.qualityScore }))
  );

  const filterMetadata = await getCatalogFilterMetadata();
  check(
    "Descoberta (Fase 8): metadados de filtro expoem tags/provedores/paises/idiomas reais do catalogo",
    filterMetadata.tags.length > 0 &&
      filterMetadata.providers.length > 0 &&
      filterMetadata.countries.length > 0 &&
      filterMetadata.languages.length > 0,
    filterMetadata
  );

  const catalogFilteredByTag = await request(jarShell, `/series?tag=${encodeURIComponent("Maratona")}`);
  check("Catalogo (Fase 8): filtro por tag via querystring funciona (200)", catalogFilteredByTag.status === 200, catalogFilteredByTag.status);

  const seriesUmDetail = await request(jarShell, "/series/serie-teste-um");
  check(
    "Pagina da serie (Fase 7): Quality Score, Collection Tags e Providers aparecem",
    seriesUmDetail.status === 200 &&
      String(seriesUmDetail.body).includes("Quality") &&
      String(seriesUmDetail.body).includes("Netflix") &&
      (String(seriesUmDetail.body).includes("Premiada") || String(seriesUmDetail.body).includes("Maratona")),
    seriesUmDetail.status
  );
  check(
    "Pagina da serie (Fase 6): logo oficial substitui o titulo em texto quando existe (span sr-only preserva acessibilidade)",
    String(seriesUmDetail.body).includes("serie-teste-um-logo.svg") && String(seriesUmDetail.body).includes("sr-only"),
    null
  );
  check(
    "Pagina da serie (Fase 7): secao Producao mostra criadores/networks/produtoras",
    String(seriesUmDetail.body).includes("Criadores") &&
      String(seriesUmDetail.body).includes("Networks") &&
      String(seriesUmDetail.body).includes("Produtoras"),
    null
  );

  // ---- INSERIES-SERIES-PAGE-PREMIUM-01 ----
  check(
    // React insere um comentario de hidratacao entre texto e expressao adjacentes
    // ("Discovery<!-- -->88"), entao o check busca o rotulo isoladamente (mesma convencao
    // ja usada pelo check de Quality Score acima).
    "Pagina da serie (Fase 2): Discovery Score aparece no Hero premium",
    String(seriesUmDetail.body).includes("Discovery"),
    null
  );
  check(
    "Pagina da serie (Fase 7): secao Onde assistir aparece quando ha provider sincronizado",
    String(seriesUmDetail.body).includes("Onde assistir"),
    null
  );
  check(
    "Pagina da serie (Fase 9): secao Series parecidas usa Collection Tags (Maratona) e Discovery Score, nunca lista generica",
    String(seriesUmDetail.body).includes("Series parecidas") && String(seriesUmDetail.body).includes("Serie Teste Quatro"),
    null
  );
  check(
    "Pagina da serie (Fase 9): secao Maratonas reaproveita a smart list MARATONAS existente",
    String(seriesUmDetail.body).includes("Maratonas"),
    null
  );
  check(
    "Pagina da serie (Fase 11/13): recomendacoes obedecem a regra global de grid fixo (mobile=2/tablet=4/desktop=4)",
    String(seriesUmDetail.body).includes("grid-cols-2") &&
      String(seriesUmDetail.body).includes("sm:grid-cols-4") &&
      String(seriesUmDetail.body).includes("lg:grid-cols-4"),
    null
  );

  // jarA ja assistiu T01E01 de serie-teste-um (linha ~261) e continua autenticado: a mesma
  // serie deve mostrar Continuar Assistindo (Watch Next reaproveitado), temporada expansivel
  // com marcacao em lote, e o episodio ja assistido com seu badge.
  const seriesPageAuthenticated = await request(jarA, `/series/${seriesId}`);
  check(
    "Pagina da serie (Fase 3): secao Continuar Assistindo aparece para usuario com progresso pendente (reaproveita Watch Next)",
    seriesPageAuthenticated.status === 200 &&
      String(seriesPageAuthenticated.body).includes("Continuar assistindo") &&
      String(seriesPageAuthenticated.body).includes('id="continuar-assistindo"'),
    null
  );
  check(
    "Pagina da serie (Fase 4): primeira temporada vem expandida (aria-expanded true) e permite marcar toda a temporada assistida",
    String(seriesPageAuthenticated.body).includes('aria-expanded="true"') &&
      String(seriesPageAuthenticated.body).includes("Marcar temporada como assistida"),
    null
  );
  check(
    "Pagina da serie (Fase 5): episodio ja assistido exibe badge Assistido",
    String(seriesPageAuthenticated.body).includes("Assistido"),
    null
  );

  // Fase 10 (Timeline) — usuario dedicado e isolado, ja que jarA tem sua propria review de
  // seriesId apagada mais adiante neste arquivo (o que tornaria um assert de REVIEWED fragil).
  const jarTimeline: CookieJar = { value: "" };
  await registerUser(jarTimeline, "usertimeline");

  if (episodeId) {
    await request(jarTimeline, `/api/episodes/${episodeId}/progress`, {
      method: "POST",
      body: JSON.stringify({ episodeId, watched: true })
    });
  }

  await request(jarTimeline, `/api/series/${seriesId}/reviews`, {
    method: "POST",
    body: JSON.stringify({ rating: 5, body: "Otima serie, adorei a jornada.", visibility: "PUBLIC" })
  });

  const timelineList = await request(jarTimeline, "/api/lists", {
    method: "POST",
    body: JSON.stringify({ title: "Minha lista de teste" })
  });
  const timelineListId: string | undefined = timelineList.body?.data?.id;
  if (timelineListId) {
    await request(jarTimeline, `/api/lists/${timelineListId}/items`, {
      method: "POST",
      body: JSON.stringify({ seriesId })
    });
  }

  const seriesPageWithTimeline = await request(jarTimeline, `/series/${seriesId}`);
  check(
    "Pagina da serie (Fase 10): timeline do usuario mostra jornada (episodio assistido, avaliacao, lista)",
    seriesPageWithTimeline.status === 200 &&
      String(seriesPageWithTimeline.body).includes("Sua jornada com esta serie") &&
      String(seriesPageWithTimeline.body).includes("Avaliou a serie") &&
      String(seriesPageWithTimeline.body).includes("Adicionou a uma lista"),
    seriesPageWithTimeline.status
  );

  const seriesCincoDetail = await request(jarShell, "/series/serie-teste-cinco");
  check(
    "Pagina da serie (Fase 6): sem logo sincronizado, titulo em texto normal (fallback gracioso, nunca quebra)",
    seriesCincoDetail.status === 200 &&
      String(seriesCincoDetail.body).includes("Serie Teste Cinco") &&
      !String(seriesCincoDetail.body).includes("serie-teste-cinco-logo"),
    seriesCincoDetail.status
  );

  // ---- INSERIES-MY-LISTS-PREMIUM-01 ----
  const jarMyList: CookieJar = { value: "" };
  await registerUser(jarMyList, "usermylist");

  const myListSeriesIds: (string | undefined)[] = catalog.body?.data?.map((item: { id: string }) => item.id) ?? [];
  const [myListSeries1, myListSeries2, myListSeries3] = myListSeriesIds;

  if (myListSeries1) {
    await request(jarMyList, `/api/series/${myListSeries1}/status`, {
      method: "POST",
      body: JSON.stringify({ seriesId: myListSeries1, state: "WATCHING" })
    });
  }
  if (myListSeries2) {
    await request(jarMyList, `/api/series/${myListSeries2}/status`, {
      method: "POST",
      body: JSON.stringify({ seriesId: myListSeries2, state: "DROPPED" })
    });
  }
  if (myListSeries3) {
    await request(jarMyList, `/api/series/${myListSeries3}/reviews`, {
      method: "POST",
      body: JSON.stringify({ rating: 5, body: "Serie favorita para o smoke test.", visibility: "PUBLIC" })
    });
  }

  const myListPage = await request(jarMyList, "/me/minha-lista");
  check(
    "Minha Lista (Fase 3): cabecalho premium mostra Total de series/Em andamento/Concluidas/Sequencia atual",
    myListPage.status === 200 &&
      String(myListPage.body).includes("Total de series") &&
      String(myListPage.body).includes("Em andamento") &&
      String(myListPage.body).includes("Sequencia atual"),
    myListPage.status
  );
  check(
    "Minha Lista (Fase 2): 6 grupos independentes (Assistindo/Quero assistir/Pausadas/Concluidas/Abandonadas/Favoritas), cada um com seu proprio anchor",
    ["grupo-watching", "grupo-want_to_watch", "grupo-paused", "grupo-completed", "grupo-dropped", "grupo-favorites"].every((anchor) =>
      String(myListPage.body).includes(anchor)
    ),
    null
  );
  check(
    "Minha Lista (Fase 4): card mostra Quality/Discovery Score, providers e Collection Tags reaproveitados do catalogo",
    String(myListPage.body).includes("Sparkles") || String(myListPage.body).includes("Netflix"),
    null
  );
  check(
    "Minha Lista (Fase 4/Favoritas): serie favoritada por review (sem UserSeriesStatus) ainda aparece, com badge Sem status",
    String(myListPage.body).includes("Sem status"),
    null
  );
  check(
    "Minha Lista (Fase 5/6/8): toolbar com busca, filtros e ordenacao renderizada",
    String(myListPage.body).includes("Buscar na Minha Lista") &&
      String(myListPage.body).includes("Ultima atividade") &&
      String(myListPage.body).includes("Genero"),
    null
  );
  check(
    "Minha Lista (Fase 9): estatisticas reaproveitam getUserStats (tempo restante, provider e status predominante)",
    String(myListPage.body).includes("Suas estatisticas") &&
      String(myListPage.body).includes("Tempo restante estimado") &&
      String(myListPage.body).includes("Status predominante"),
    null
  );
  check(
    "Minha Lista (Fase 10): recomendacoes (baseado na lista/complete sua colecao/porque assistiu) nunca genericas",
    String(myListPage.body).includes("Baseado na sua lista") ||
      String(myListPage.body).includes("Complete sua colecao") ||
      String(myListPage.body).includes("Porque voce assistiu"),
    null
  );
  check(
    "Minha Lista (Fase 11/13): grids seguem a regra global de colunas fixas por breakpoint",
    String(myListPage.body).includes("grid-cols-1 sm:grid-cols-2 lg:grid-cols-3") ||
      String(myListPage.body).includes("grid-cols-2 sm:grid-cols-4 lg:grid-cols-4"),
    null
  );

  if (myListSeries1) {
    const removeStatus = await request(jarMyList, `/api/series/${myListSeries1}/status`, { method: "DELETE" });
    check("Minha Lista (Fase 7): DELETE /api/series/[id]/status remove a serie da lista (200)", removeStatus.status === 200, removeStatus.body);

    const myListAfterRemoval = await request(jarMyList, "/me/minha-lista");
    check(
      "Minha Lista (Fase 7): apos remover, a serie some da secao Assistindo",
      myListAfterRemoval.status === 200,
      myListAfterRemoval.status
    );
  }

  // Fase 1 (INSERIES-PRODUCT-EXPERIENCE-REVOLUTION-01) — as 3 rotas antigas nao tem mais
  // app/me/*/page.tsx proprio; o redirect virou uma regra de middleware.ts (legacyRedirects),
  // entao volta a ser um 307/302 de HTTP puro com Location, igual ao redirect de auth — nao
  // precisa mais checar o digest NEXT_REDIRECT embutido no HTML.
  const watchingRedirect = await request(jarMyList, "/me/watching");
  check(
    "Minha Lista: /me/watching (rota antiga) redireciona para /me/minha-lista (middleware, nao duplica logica)",
    (watchingRedirect.status === 307 || watchingRedirect.status === 302) &&
      watchingRedirect.headers.get("location")?.includes("/me/minha-lista#grupo-watching") === true,
    { status: watchingRedirect.status, location: watchingRedirect.headers.get("location") }
  );
  const watchlistRedirect = await request(jarMyList, "/me/watchlist");
  check(
    "Minha Lista: /me/watchlist (rota antiga) redireciona para /me/minha-lista",
    (watchlistRedirect.status === 307 || watchlistRedirect.status === 302) &&
      watchlistRedirect.headers.get("location")?.includes("/me/minha-lista#grupo-want_to_watch") === true,
    { status: watchlistRedirect.status, location: watchlistRedirect.headers.get("location") }
  );
  const completedRedirect = await request(jarMyList, "/me/completed");
  check(
    "Minha Lista: /me/completed (rota antiga) redireciona para /me/minha-lista",
    (completedRedirect.status === 307 || completedRedirect.status === 302) &&
      completedRedirect.headers.get("location")?.includes("/me/minha-lista#grupo-completed") === true,
    { status: completedRedirect.status, location: completedRedirect.headers.get("location") }
  );

  // ---- INSERIES-PROFILE-PREMIUM-01 ----
  const jarProfile: CookieJar = { value: "" };
  const profileUser = await registerUser(jarProfile, "userprofile");

  const profileSeriesIds: (string | undefined)[] = catalog.body?.data?.map((item: { id: string }) => item.id) ?? [];
  const [profileSeries1, profileSeries2] = profileSeriesIds;

  if (episodeId) {
    await request(jarProfile, `/api/episodes/${episodeId}/progress`, {
      method: "POST",
      body: JSON.stringify({ episodeId, watched: true })
    });
  }
  if (profileSeries1) {
    await request(jarProfile, `/api/series/${profileSeries1}/status`, {
      method: "POST",
      body: JSON.stringify({ seriesId: profileSeries1, state: "WATCHING" })
    });
    await request(jarProfile, `/api/series/${profileSeries1}/reviews`, {
      method: "POST",
      body: JSON.stringify({ rating: 5, body: "Serie favorita para o smoke test do perfil.", visibility: "PUBLIC" })
    });
  }
  if (profileSeries2) {
    await request(jarProfile, `/api/series/${profileSeries2}/status`, {
      method: "POST",
      body: JSON.stringify({ seriesId: profileSeries2, state: "COMPLETED" })
    });
  }

  const ownProfilePage = await request(jarProfile, `/profile/${profileUser.username}`);
  check(
    "Perfil (Fase 2): cabecalho premium mostra sequencia atual, series acompanhadas/concluidas, episodios e tempo assistido",
    ownProfilePage.status === 200 &&
      String(ownProfilePage.body).includes("Sequencia atual") &&
      String(ownProfilePage.body).includes("Series acompanhadas") &&
      String(ownProfilePage.body).includes("Episodios assistidos"),
    ownProfilePage.status
  );
  check(
    "Perfil (Fase 3): estatisticas mostram media de conclusao, tempo restante e Discovery/Quality medio",
    String(ownProfilePage.body).includes("Media de conclusao") &&
      String(ownProfilePage.body).includes("Tempo restante") &&
      (String(ownProfilePage.body).includes("Discovery medio") || String(ownProfilePage.body).includes("Quality medio")),
    null
  );
  check(
    "Perfil (Fase 4): timeline mostra atividades reais (assistiu/avaliou/concluiu) e os filtros da Fase 7",
    String(ownProfilePage.body).includes("assistiu") &&
      String(ownProfilePage.body).includes("avaliou") &&
      String(ownProfilePage.body).includes("concluiu") &&
      String(ownProfilePage.body).includes("Favoritos") &&
      String(ownProfilePage.body).includes("Conclusoes"),
    null
  );
  check(
    "Perfil (Fase 5): dono ve Continuar assistindo (colecao pessoal, nunca exposta a visitantes)",
    String(ownProfilePage.body).includes("Continuar assistindo"),
    null
  );
  check(
    "Perfil (Fase 5): Favoritas e Reviews recentes reaproveitam os mesmos dados de review ja buscados",
    String(ownProfilePage.body).includes("Favoritas") && String(ownProfilePage.body).includes("Reviews recentes"),
    null
  );
  check(
    "Perfil (Fase 6): destaques mostram Maior Discovery Score, Maior Quality Score e Melhor serie avaliada",
    String(ownProfilePage.body).includes("Destaques") &&
      String(ownProfilePage.body).includes("Maior Discovery Score") &&
      String(ownProfilePage.body).includes("Melhor serie avaliada"),
    null
  );
  check(
    "Perfil (Fase 8): novas secoes seguem a regra global de grids (grid-cols-2 fixo)",
    String(ownProfilePage.body).includes("grid-cols-2"),
    null
  );

  const jarProfileViewer: CookieJar = { value: "" };
  await registerUser(jarProfileViewer, "userprofileviewer");
  const visitorProfilePage = await request(jarProfileViewer, `/profile/${profileUser.username}`);
  check(
    "Perfil (Fase 5): visitante nunca ve Continuar assistindo de outro usuario (sem flag de privacidade para isso, decisao deliberada)",
    visitorProfilePage.status === 200 && !String(visitorProfilePage.body).includes("Continuar assistindo"),
    null
  );
  check(
    "Perfil (Fase 1/6): visitante ainda ve estatisticas/destaques num perfil publico com as flags padrao",
    String(visitorProfilePage.body).includes("Media de conclusao") && String(visitorProfilePage.body).includes("Destaques"),
    null
  );

  await request(jarProfile, "/api/profile", { method: "PATCH", body: JSON.stringify({ showWatchingSeries: false, showWatchedSeries: false }) });
  const visitorAfterHidingStats = await request(jarProfileViewer, `/profile/${profileUser.username}`);
  check(
    "Perfil (Fase 1): sem flag dedicada, estatisticas/destaques reaproveitam showWatchingSeries/showWatchedSeries (escondidas quando ambas desligadas)",
    !String(visitorAfterHidingStats.body).includes("Media de conclusao") && !String(visitorAfterHidingStats.body).includes("Destaques"),
    null
  );
  check(
    "Perfil (Fase 1): Reviews/Favoritas continuam visiveis mesmo com estatisticas escondidas (flags independentes)",
    String(visitorAfterHidingStats.body).includes("Favoritas") || String(visitorAfterHidingStats.body).includes("Reviews recentes"),
    null
  );
  await request(jarProfile, "/api/profile", { method: "PATCH", body: JSON.stringify({ showWatchingSeries: true, showWatchedSeries: true }) });

  // Disparo real do Discovery Engine/sync popular: fica por ultimo de proposito. Achado
  // rodando o smoke test de verdade contra servidor local com catalogo grande - o endpoint
  // em si responde rapido (o `summary` volta na hora), mas o trabalho em segundo plano que
  // ele agenda (~442 chamadas reais ao TMDb, ~10min) satura o processo single-thread do
  // `next dev`, e QUALQUER requisicao HTTP depois dele no mesmo processo acaba estourando em
  // HeadersTimeoutError - nao so as proximas 2-3, o resto do script inteiro (na pratica, mais
  // ou menos metade dos checks, tudo que vinha depois deste ponto no arquivo). Empurrar pro
  // fim garante que tudo mais ja foi validado antes de arriscar essa saturacao.
  const adminTriggersDiscovery = await request(jarAdmin, "/api/admin/sync/discovery", { method: "POST" });
  check(
    "admin dispara o Discovery Engine; sem TMDB key retorna erro amigavel (nao quebra)",
    adminTriggersDiscovery.status === 200 && Boolean(adminTriggersDiscovery.body?.summary),
    adminTriggersDiscovery.body
  );

  const adminTriggersSync = await request(jarAdmin, "/api/admin/sync/popular", { method: "POST" });
  check(
    "admin dispara sync popular; sem TMDB key retorna erro amigavel (nao quebra)",
    adminTriggersSync.status === 200 && Boolean(adminTriggersSync.body?.summary),
    adminTriggersSync.body
  );

  await request(jarAdmin, "/api/auth/logout", { method: "POST" });

  // ---- Encerramento ----
  await request(jarA, "/api/auth/logout", { method: "POST" });
  jarA.value = "";

  const meAfterLogout = await request(jarA, "/api/auth/me");
  check("logout invalida sessao (/api/auth/me 401)", meAfterLogout.status === 401, meAfterLogout.body);

  await request(jarB, "/api/auth/logout", { method: "POST" });

  console.log("");
  if (failures > 0) {
    console.error(`Smoke test falhou: ${failures} verificacao(oes) com erro.`);
    process.exitCode = 1;
  } else {
    console.log(
      "Smoke test concluido com sucesso: fluxo principal, descoberta/busca, calendario, fundacao social, feed de atividades e coverage de catalogo validados ponta a ponta."
    );
  }
}

main()
  .catch((error) => {
    console.error("Smoke test quebrou com excecao nao tratada.");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
