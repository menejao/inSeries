import type { CatalogSyncStatus, CatalogSyncType, SeriesLifecycleStatus } from "@prisma/client";
import { ExternalEntityType, ExternalSource } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { config, getTmdbCredentials } from "@/lib/config";
import { incrementSyncStarted } from "@/lib/metrics/service";
import { logger } from "@/lib/logger";
import { getTmdbCallStats, resetTmdbCallStats } from "@/lib/tmdb/rate-limit";
import { describeTmdbError } from "@/lib/tmdb/errors";
import { normalizeTmdbSeries, normalizeTmdbSeriesList, type TmdbListSeriesItem } from "@/lib/catalog/normalize";
import { upsertNormalizedSeriesWithCounts, type CatalogUpsertCounts } from "@/lib/catalog/repository";
import { collectCandidates, type AggregatedCandidate, type DiscoverySourceKey, type SourceDefinition } from "@/lib/catalog/aggregator";
import { createSyncCache, type SyncCache } from "@/lib/catalog/sync-cache";
import { isDueForUpdate } from "@/lib/catalog/update-policy";
import {
  fetchAiringTodayTmdbSeries,
  fetchDiscoverTmdbSeries,
  fetchOnTheAirTmdbSeries,
  fetchPopularTmdbSeries,
  fetchTmdbSeasonDetails,
  fetchTmdbSeriesDetails,
  fetchTopRatedTmdbSeries,
  fetchTrendingTmdbSeries
} from "@/lib/tmdb/service";

// TMDb's own list endpoints (popular/top_rated/discover/...) cap out around page 500 —
// this is a safety net against a misconfigured absurd value, not a product decision.
// The actual page count used is always config.catalogSync.*Pages (env-driven), never
// a fixed number baked into the sync itself.
const SAFETY_MAX_PAGES = 500;

export type SyncItemError = { series: string; message: string };

/** Fase 8 — per-run counters surfaced in CLI output, structured logs and CatalogSyncRun.metadata. */
export type CatalogSyncObservability = {
  pagesProcessed: number;
  requestCount: number;
  retryCount: number;
  rateLimitHitCount: number;
  averageRequestMs: number;
  lightweightUpdateCount: number;
  skippedCount: number;
};

export type CatalogSyncSummary = CatalogUpsertCounts & {
  runId: string;
  type: CatalogSyncType;
  status: CatalogSyncStatus;
  startedAt: Date;
  finishedAt: Date;
  durationMs: number;
  errorMessage: string | null;
  errors: SyncItemError[];
  observability?: CatalogSyncObservability;
};

function emptyCounts(): CatalogUpsertCounts {
  return {
    importedSeriesCount: 0,
    updatedSeriesCount: 0,
    importedSeasonCount: 0,
    updatedSeasonCount: 0,
    importedEpisodeCount: 0,
    updatedEpisodeCount: 0
  };
}

function addCounts(target: CatalogUpsertCounts, delta: CatalogUpsertCounts) {
  target.importedSeriesCount += delta.importedSeriesCount;
  target.updatedSeriesCount += delta.updatedSeriesCount;
  target.importedSeasonCount += delta.importedSeasonCount;
  target.updatedSeasonCount += delta.updatedSeasonCount;
  target.importedEpisodeCount += delta.importedEpisodeCount;
  target.updatedEpisodeCount += delta.updatedEpisodeCount;
}

const describeError = describeTmdbError;

async function createRun(type: CatalogSyncType) {
  const run = await prisma.catalogSyncRun.create({ data: { source: "TMDB", type, status: "RUNNING" } });
  incrementSyncStarted();
  return run;
}

/**
 * Prevents two syncs of the same type from running concurrently: if one is
 * already RUNNING, callers should short-circuit and report it instead of
 * starting a second run that would race the first for the same rows.
 */
async function findRunningRun(type: CatalogSyncType) {
  return prisma.catalogSyncRun.findFirst({
    where: { type, status: "RUNNING" },
    orderBy: { startedAt: "desc" }
  });
}

function alreadyRunningSummary(existingRun: { id: string; startedAt: Date }, type: CatalogSyncType): CatalogSyncSummary {
  return {
    ...emptyCounts(),
    runId: existingRun.id,
    type,
    status: "RUNNING",
    startedAt: existingRun.startedAt,
    finishedAt: existingRun.startedAt,
    durationMs: 0,
    errorMessage: "Ja existe uma sincronizacao deste tipo em andamento.",
    errors: []
  };
}

async function finishRun(
  runId: string,
  type: CatalogSyncType,
  startedAt: Date,
  status: CatalogSyncStatus,
  counts: CatalogUpsertCounts,
  errors: SyncItemError[],
  observability?: CatalogSyncObservability
): Promise<CatalogSyncSummary> {
  const finishedAt = new Date();
  const errorMessage = errors.length ? `${errors.length} erro(s) durante a sincronizacao. Veja metadata.errors.` : null;

  await prisma.catalogSyncRun.update({
    where: { id: runId },
    data: {
      status,
      finishedAt,
      ...counts,
      errorMessage,
      metadata: errors.length || observability ? { errors, observability } : undefined
    }
  });

  logger.info("catalog_sync_finished", {
    route: "catalog.sync",
    metadata: {
      runId,
      type,
      status,
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      counts,
      observability,
      errorCount: errors.length
    }
  });

  return {
    ...counts,
    runId,
    type,
    status,
    startedAt,
    finishedAt,
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    errorMessage,
    errors,
    observability
  };
}

async function abortRunUnconfigured(runId: string, type: CatalogSyncType, startedAt: Date): Promise<CatalogSyncSummary> {
  const message = "TMDb nao configurado. Defina TMDB_API_KEY ou TMDB_ACCESS_TOKEN no ambiente.";
  await prisma.catalogSyncRun.update({
    where: { id: runId },
    data: { status: "FAILED", finishedAt: new Date(), errorMessage: message }
  });
  logger.warn("catalog_sync_unconfigured", { route: "catalog.sync", metadata: { runId, type } });

  return {
    ...emptyCounts(),
    runId,
    type,
    status: "FAILED",
    startedAt,
    finishedAt: new Date(),
    durationMs: 0,
    errorMessage: message,
    errors: []
  };
}

/**
 * Fase 3/7 — TMDB_MIN_VOTE_COUNT/TMDB_MIN_YEAR/TMDB_MAX_YEAR apply as a client-side
 * quality gate to every discovery source, not just Discover (whose own query params
 * additionally let TMDb filter server-side, avoiding wasted result pages). Popular/
 * Top Rated/On The Air/Airing Today/Trending don't accept these as query params at
 * all, so this is the only place they can be honored for those sources.
 */
function passesQualityFilters(item: TmdbListSeriesItem): boolean {
  const { minVoteCount, minYear, maxYear } = config.catalogSync;

  if (minVoteCount > 0 && (item.vote_count ?? 0) < minVoteCount) return false;

  const year = item.first_air_date ? Number(item.first_air_date.slice(0, 4)) : undefined;
  if (minYear !== undefined && (year === undefined || year < minYear)) return false;
  if (maxYear !== undefined && (year === undefined || year > maxYear)) return false;

  return true;
}

/**
 * Fetches full series details + all seasons/episodes for one TMDb id.
 * A season TMDb fails to return episodes for is kept as an "announced" season
 * (zero episodes) instead of aborting the whole series import — matches the
 * existing calendar "future season" convention.
 *
 * Fase 7 (INSERIES-TMDB-CATALOG-COVERAGE-01) — an optional session cache memoizes the
 * details/season calls; every existing caller keeps working unchanged (cache is opt-in).
 */
async function fetchFullSeriesFromTmdb(tmdbId: string | number, cache?: SyncCache) {
  const details = cache
    ? await cache.getOrFetchSeriesDetails(tmdbId, () => fetchTmdbSeriesDetails(tmdbId))
    : await fetchTmdbSeriesDetails(tmdbId);
  const seasonCount = details.number_of_seasons ?? 0;
  const fullSeasons = [];

  for (const seasonNumber of Array.from({ length: seasonCount }, (_, index) => index + 1)) {
    try {
      const season = cache
        ? await cache.getOrFetchSeasonDetails(tmdbId, seasonNumber, () => fetchTmdbSeasonDetails(tmdbId, seasonNumber))
        : await fetchTmdbSeasonDetails(tmdbId, seasonNumber);
      fullSeasons.push(season);
    } catch {
      fullSeasons.push({
        id: seasonNumber,
        season_number: seasonNumber,
        name: `Temporada ${seasonNumber}`,
        episodes: []
      });
    }
  }

  return normalizeTmdbSeries({ ...details, seasons: fullSeasons });
}

/** Imports/updates one series (full details+seasons+episodes) by TMDb id; isolates a single series' failure from the rest of the run. */
async function syncOneSeries(tmdbId: string | number, label: string, counts: CatalogUpsertCounts, errors: SyncItemError[]) {
  try {
    const normalized = await fetchFullSeriesFromTmdb(tmdbId);
    const { counts: itemCounts } = await upsertNormalizedSeriesWithCounts(normalized);
    addCounts(counts, itemCounts);
  } catch (error) {
    errors.push({ series: label, message: describeError(error) });
  }
}

/**
 * Fase 5/6 — the smart-update decision point for every discovery source (popular,
 * discover, top rated, on the air, airing today, trending). A series TMDb hasn't
 * been imported yet gets the full treatment (details+seasons+episodes, at least
 * once — a brand new series can't skip that). A series that's already catalogued
 * gets updated from the list item's own fields (poster/backdrop/overview/nota/
 * popularidade) with **zero extra TMDb calls** — seasons/episodes are left exactly
 * as they were. Dedicated full detail/season refreshes for already-catalogued
 * series remain `syncExistingSeriesDetails` (`npm run sync:series`) — unchanged.
 */
async function upsertDiscoveredItem(
  item: TmdbListSeriesItem,
  counts: CatalogUpsertCounts,
  errors: SyncItemError[],
  lightweightUpdates: { count: number }
) {
  const label = item.name ?? String(item.id);

  try {
    const existingMapping = await prisma.externalSourceMapping.findUnique({
      where: {
        source_entityType_externalId: {
          source: ExternalSource.TMDB,
          entityType: ExternalEntityType.SERIES,
          externalId: String(item.id)
        }
      },
      select: { seriesId: true }
    });

    if (!existingMapping) {
      const normalized = await fetchFullSeriesFromTmdb(item.id);
      const { counts: itemCounts } = await upsertNormalizedSeriesWithCounts(normalized);
      addCounts(counts, itemCounts);
      return;
    }

    const [normalized] = normalizeTmdbSeriesList([item]);
    const { counts: itemCounts } = await upsertNormalizedSeriesWithCounts(normalized);
    addCounts(counts, itemCounts);
    lightweightUpdates.count += 1;
  } catch (error) {
    errors.push({ series: label, message: describeError(error) });
  }
}

/**
 * Shared runner for every "discovery" source (Popular, Discover, Top Rated, On The
 * Air, Airing Today, Trending): same run-tracking, same quality filters, same
 * smart-update logic, same observability — only how pages are fetched differs.
 */
async function runDiscoverySync(
  type: CatalogSyncType,
  pages: number,
  fetchPage: (page: number) => Promise<TmdbListSeriesItem[]>
): Promise<CatalogSyncSummary> {
  const runningRun = await findRunningRun(type);
  if (runningRun) return alreadyRunningSummary(runningRun, type);

  const run = await createRun(type);

  if (!getTmdbCredentials().isConfigured) {
    return abortRunUnconfigured(run.id, type, run.startedAt);
  }

  const statsBefore = getTmdbCallStats();
  const counts = emptyCounts();
  const errors: SyncItemError[] = [];
  const lightweightUpdates = { count: 0 };
  let skippedCount = 0;
  let pagesProcessed = 0;

  for (let page = 1; page <= pages; page += 1) {
    let items: TmdbListSeriesItem[];
    try {
      items = await fetchPage(page);
    } catch (error) {
      errors.push({ series: `pagina ${page}`, message: describeError(error) });
      continue;
    }
    pagesProcessed += 1;

    for (const item of items) {
      if (!passesQualityFilters(item)) {
        skippedCount += 1;
        continue;
      }
      await upsertDiscoveredItem(item, counts, errors, lightweightUpdates);
    }
  }

  const statsAfter = getTmdbCallStats();
  const requestCount = statsAfter.requestCount - statsBefore.requestCount;
  const observability: CatalogSyncObservability = {
    pagesProcessed,
    requestCount,
    retryCount: statsAfter.retryCount - statsBefore.retryCount,
    rateLimitHitCount: statsAfter.rateLimitHitCount - statsBefore.rateLimitHitCount,
    averageRequestMs: requestCount > 0 ? Math.round((statsAfter.totalRequestMs - statsBefore.totalRequestMs) / requestCount) : 0,
    lightweightUpdateCount: lightweightUpdates.count,
    skippedCount
  };

  const totalTouched = counts.importedSeriesCount + counts.updatedSeriesCount;
  const status: CatalogSyncStatus = errors.length === 0 ? "SUCCESS" : totalTouched > 0 ? "PARTIAL" : "FAILED";

  return finishRun(run.id, type, run.startedAt, status, counts, errors, observability);
}

function resolvePages(requested: number | undefined, configured: number) {
  return Math.max(1, Math.min(SAFETY_MAX_PAGES, requested ?? configured));
}

/**
 * Discovers and imports/updates TMDb's popular TV series. Idempotent: re-running
 * never duplicates series, seasons or episodes (matched by slug/number, TMDb
 * external id) and only touches catalog metadata — never UserSeriesStatus,
 * UserEpisodeProgress, Review, List or Activity.
 */
export async function syncPopularSeries(options: { pages?: number } = {}): Promise<CatalogSyncSummary> {
  const pages = resolvePages(options.pages, config.catalogSync.popularPages);
  return runDiscoverySync("POPULAR_SERIES", pages, fetchPopularTmdbSeries);
}

export type DiscoverSyncOptions = {
  pages?: number;
  sortBy?: string;
  withGenres?: string;
  withStatus?: string;
  withOriginalLanguage?: string;
  withOriginCountry?: string;
};

/** Fase 4 — Discover TV, with the quality/date-range filters TMDB_MIN_VOTE_COUNT/TMDB_MIN_YEAR/TMDB_MAX_YEAR apply to natively. */
export async function syncDiscoverSeries(options: DiscoverSyncOptions = {}): Promise<CatalogSyncSummary> {
  const pages = resolvePages(options.pages, config.catalogSync.discoverPages);
  const { minYear, maxYear, minVoteCount } = config.catalogSync;

  return runDiscoverySync("DISCOVER", pages, (page) =>
    fetchDiscoverTmdbSeries({
      page,
      sortBy: options.sortBy ?? "popularity.desc",
      voteCountGte: minVoteCount > 0 ? minVoteCount : undefined,
      firstAirDateGte: minYear !== undefined ? `${minYear}-01-01` : undefined,
      firstAirDateLte: maxYear !== undefined ? `${maxYear}-12-31` : undefined,
      withGenres: options.withGenres,
      withStatus: options.withStatus,
      withOriginalLanguage: options.withOriginalLanguage,
      withOriginCountry: options.withOriginCountry
    })
  );
}

export async function syncTopRatedSeries(options: { pages?: number } = {}): Promise<CatalogSyncSummary> {
  const pages = resolvePages(options.pages, 1);
  return runDiscoverySync("TOP_RATED", pages, fetchTopRatedTmdbSeries);
}

export async function syncOnTheAirSeries(options: { pages?: number } = {}): Promise<CatalogSyncSummary> {
  const pages = resolvePages(options.pages, 1);
  return runDiscoverySync("ON_THE_AIR", pages, fetchOnTheAirTmdbSeries);
}

export async function syncAiringTodaySeries(options: { pages?: number } = {}): Promise<CatalogSyncSummary> {
  const pages = resolvePages(options.pages, 1);
  return runDiscoverySync("AIRING_TODAY", pages, fetchAiringTodayTmdbSeries);
}

export async function syncTrendingSeries(options: { pages?: number; window?: "day" | "week" } = {}): Promise<CatalogSyncSummary> {
  const pages = resolvePages(options.pages, 1);
  const window = options.window ?? "week";
  return runDiscoverySync("TRENDING", pages, (page) => fetchTrendingTmdbSeries(page, window));
}

/**
 * Re-fetches full details/seasons/episodes for series already in the catalog (via
 * their stored ExternalSourceMapping), refreshing metadata without rediscovering
 * any list. Pass seriesIds to scope to specific series, or omit to refresh all.
 * Unlike the discovery syncs above, this always does the full fetch — it exists
 * specifically to deep-refresh seasons/episodes for series the discovery syncs
 * only lightweight-update.
 */
export async function syncExistingSeriesDetails(seriesIds?: string[]): Promise<CatalogSyncSummary> {
  const type: CatalogSyncType = "SERIES_DETAILS";
  const runningRun = await findRunningRun(type);
  if (runningRun) return alreadyRunningSummary(runningRun, type);

  const run = await createRun(type);

  if (!getTmdbCredentials().isConfigured) {
    return abortRunUnconfigured(run.id, type, run.startedAt);
  }

  const mappings = await prisma.externalSourceMapping.findMany({
    where: {
      source: "TMDB",
      entityType: "SERIES",
      ...(seriesIds ? { seriesId: { in: seriesIds } } : {})
    },
    select: { externalId: true, series: { select: { title: true } } }
  });

  const counts = emptyCounts();
  const errors: SyncItemError[] = [];

  for (const mapping of mappings) {
    await syncOneSeries(mapping.externalId, mapping.series.title, counts, errors);
  }

  const status: CatalogSyncStatus = errors.length === 0 ? "SUCCESS" : counts.updatedSeriesCount > 0 ? "PARTIAL" : "FAILED";

  return finishRun(run.id, type, run.startedAt, status, counts, errors);
}

/** Combines popular-series discovery with a refresh of already-catalogued series, in a single tracked run. */
export async function syncFullRefresh(options: { pages?: number } = {}): Promise<CatalogSyncSummary> {
  const type: CatalogSyncType = "FULL_REFRESH";
  const runningRun = await findRunningRun(type);
  if (runningRun) return alreadyRunningSummary(runningRun, type);

  const run = await createRun(type);

  if (!getTmdbCredentials().isConfigured) {
    return abortRunUnconfigured(run.id, type, run.startedAt);
  }

  const pages = Math.max(1, Math.min(5, options.pages ?? 1));
  const counts = emptyCounts();
  const errors: SyncItemError[] = [];
  const seenTmdbIds = new Set<string>();

  for (let page = 1; page <= pages; page += 1) {
    try {
      const popularItems = await fetchPopularTmdbSeries(page);
      for (const item of popularItems) {
        seenTmdbIds.add(String(item.id));
        await syncOneSeries(item.id, item.name ?? String(item.id), counts, errors);
      }
    } catch (error) {
      errors.push({ series: `pagina ${page}`, message: describeError(error) });
    }
  }

  const mappings = await prisma.externalSourceMapping.findMany({
    where: { source: "TMDB", entityType: "SERIES" },
    select: { externalId: true, series: { select: { title: true } } }
  });

  for (const mapping of mappings) {
    if (seenTmdbIds.has(mapping.externalId)) continue;
    await syncOneSeries(mapping.externalId, mapping.series.title, counts, errors);
  }

  const totalTouched = counts.importedSeriesCount + counts.updatedSeriesCount;
  const status: CatalogSyncStatus = errors.length === 0 ? "SUCCESS" : totalTouched > 0 ? "PARTIAL" : "FAILED";

  return finishRun(run.id, type, run.startedAt, status, counts, errors);
}

export type FullCatalogSyncSummary = {
  runId: string;
  status: CatalogSyncStatus;
  startedAt: Date;
  finishedAt: Date;
  durationMs: number;
  sources: Array<{ type: CatalogSyncType; summary: CatalogSyncSummary }>;
  totals: CatalogUpsertCounts;
};

/** Fase 10/11 (`npm run sync:catalog`) — every discovery source, in order, aggregated into one top-level tracked run. */
export async function syncFullCatalog(): Promise<FullCatalogSyncSummary> {
  const type: CatalogSyncType = "CATALOG_FULL";
  const startedAt = new Date();
  const run = await prisma.catalogSyncRun.create({ data: { source: "TMDB", type, status: "RUNNING" } });
  incrementSyncStarted();

  if (!getTmdbCredentials().isConfigured) {
    const finishedAt = new Date();
    const message = "TMDb nao configurado. Defina TMDB_API_KEY ou TMDB_ACCESS_TOKEN no ambiente.";
    await prisma.catalogSyncRun.update({ where: { id: run.id }, data: { status: "FAILED", finishedAt, errorMessage: message } });
    return { runId: run.id, status: "FAILED", startedAt, finishedAt, durationMs: finishedAt.getTime() - startedAt.getTime(), sources: [], totals: emptyCounts() };
  }

  const steps: Array<[CatalogSyncType, () => Promise<CatalogSyncSummary>]> = [
    ["POPULAR_SERIES", () => syncPopularSeries()],
    ["DISCOVER", () => syncDiscoverSeries()],
    ["TOP_RATED", () => syncTopRatedSeries()],
    ["ON_THE_AIR", () => syncOnTheAirSeries()],
    ["AIRING_TODAY", () => syncAiringTodaySeries()],
    ["TRENDING", () => syncTrendingSeries()]
  ];

  const sources: Array<{ type: CatalogSyncType; summary: CatalogSyncSummary }> = [];
  const totals = emptyCounts();

  for (const [stepType, runStep] of steps) {
    const summary = await runStep();
    sources.push({ type: stepType, summary });
    addCounts(totals, summary);
  }

  const finishedAt = new Date();
  const allSucceeded = sources.every((source) => source.summary.status === "SUCCESS");
  const anyTouched = totals.importedSeriesCount + totals.updatedSeriesCount > 0;
  const status: CatalogSyncStatus = allSucceeded ? "SUCCESS" : anyTouched ? "PARTIAL" : "FAILED";

  await prisma.catalogSyncRun.update({
    where: { id: run.id },
    data: {
      status,
      finishedAt,
      ...totals,
      metadata: { sources: sources.map((source) => ({ type: source.type, runId: source.summary.runId, status: source.summary.status })) }
    }
  });

  logger.info("catalog_sync_finished", {
    route: "catalog.sync",
    metadata: { runId: run.id, type, status, durationMs: finishedAt.getTime() - startedAt.getTime(), totals }
  });

  return { runId: run.id, status, startedAt, finishedAt, durationMs: finishedAt.getTime() - startedAt.getTime(), sources, totals };
}

export async function getRecentSyncRuns(limit = 10) {
  return prisma.catalogSyncRun.findMany({
    orderBy: { startedAt: "desc" },
    take: limit
  });
}

export async function getLatestCoverageRun() {
  return prisma.catalogSyncRun.findFirst({
    where: { type: "COVERAGE" },
    orderBy: { startedAt: "desc" }
  });
}

// ============================================================================
// Fase 2-9 (INSERIES-TMDB-CATALOG-COVERAGE-01) — the aggregated "coverage" pipeline:
// consolidate all six discovery sources into one deduplicated, prioritized queue,
// separate new from existing series, apply status-based update cadence to existing
// ones, cache within the run, persist enough progress to resume if interrupted, and
// report everything the ticket's Fase 11 template asks for.
// ============================================================================

export type CoverageOptions = {
  popularPages?: number;
  discoverPages?: number;
  topRatedPages?: number;
  onTheAirPages?: number;
  airingTodayPages?: number;
  trendingPages?: number;
  trendingWindow?: "day" | "week";
};

export type CoverageObservability = CatalogSyncObservability & {
  cacheHits: number;
  cacheMisses: number;
  /** duplicatesRemoved (Fase 3) + series skipped by cadence (Fase 6) + cache hits (Fase 7) — every TMDb call the pipeline avoided making. */
  callsSaved: number;
};

export type CoverageSummary = {
  runId: string;
  status: CatalogSyncStatus;
  startedAt: Date;
  finishedAt: Date;
  durationMs: number;
  resumed: boolean;
  perSourceCounts: Record<DiscoverySourceKey, number>;
  totalCollected: number;
  uniqueCount: number;
  duplicatesRemoved: number;
  totals: CatalogUpsertCounts;
  skippedByCadenceCount: number;
  errors: SyncItemError[];
  observability: CoverageObservability;
};

type CoverageResumeState = {
  remainingQueue: AggregatedCandidate[];
  processedCount: number;
  perSourceCounts: Record<DiscoverySourceKey, number>;
  totalCollected: number;
  uniqueCount: number;
  duplicatesRemoved: number;
  pagesProcessed: number;
  totals: CatalogUpsertCounts;
  skippedByCadenceCount: number;
  errors: SyncItemError[];
  cacheHits: number;
  cacheMisses: number;
};

function buildSourceDefinitions(options: CoverageOptions): SourceDefinition[] {
  const window = options.trendingWindow ?? "week";
  const { minVoteCount, minYear, maxYear } = config.catalogSync;

  return [
    { key: "POPULAR_SERIES", pages: resolvePages(options.popularPages, config.catalogSync.popularPages), fetchPage: fetchPopularTmdbSeries },
    {
      key: "DISCOVER",
      pages: resolvePages(options.discoverPages, config.catalogSync.discoverPages),
      fetchPage: (page) =>
        fetchDiscoverTmdbSeries({
          page,
          sortBy: "popularity.desc",
          voteCountGte: minVoteCount > 0 ? minVoteCount : undefined,
          firstAirDateGte: minYear !== undefined ? `${minYear}-01-01` : undefined,
          firstAirDateLte: maxYear !== undefined ? `${maxYear}-12-31` : undefined
        })
    },
    { key: "TOP_RATED", pages: resolvePages(options.topRatedPages, 1), fetchPage: fetchTopRatedTmdbSeries },
    { key: "ON_THE_AIR", pages: resolvePages(options.onTheAirPages, 1), fetchPage: fetchOnTheAirTmdbSeries },
    { key: "AIRING_TODAY", pages: resolvePages(options.airingTodayPages, 1), fetchPage: fetchAiringTodayTmdbSeries },
    { key: "TRENDING", pages: resolvePages(options.trendingPages, 1), fetchPage: (page) => fetchTrendingTmdbSeries(page, window) }
  ];
}

async function persistResumeState(runId: string, state: CoverageResumeState) {
  await prisma.catalogSyncRun.update({
    where: { id: runId },
    data: {
      ...state.totals,
      metadata: { resumeState: state }
    }
  });
}

async function findLatestCoverageRun() {
  return prisma.catalogSyncRun.findFirst({
    where: { type: "COVERAGE", status: "RUNNING" },
    orderBy: { startedAt: "desc" }
  });
}

function extractResumeState(run: { metadata: unknown } | null | undefined): CoverageResumeState | null {
  if (!run || !run.metadata || typeof run.metadata !== "object") return null;
  const state = (run.metadata as { resumeState?: CoverageResumeState }).resumeState;
  return state && Array.isArray(state.remainingQueue) ? state : null;
}

function emptyCoverageObservability(): CoverageObservability {
  return {
    pagesProcessed: 0,
    requestCount: 0,
    retryCount: 0,
    rateLimitHitCount: 0,
    averageRequestMs: 0,
    lightweightUpdateCount: 0,
    skippedCount: 0,
    cacheHits: 0,
    cacheMisses: 0,
    callsSaved: 0
  };
}

function toCoverageSummary(base: CatalogSyncSummary, resumed: boolean): CoverageSummary {
  return {
    runId: base.runId,
    status: base.status,
    startedAt: base.startedAt,
    finishedAt: base.finishedAt,
    durationMs: base.durationMs,
    resumed,
    perSourceCounts: {} as Record<DiscoverySourceKey, number>,
    totalCollected: 0,
    uniqueCount: 0,
    duplicatesRemoved: 0,
    totals: {
      importedSeriesCount: base.importedSeriesCount,
      updatedSeriesCount: base.updatedSeriesCount,
      importedSeasonCount: base.importedSeasonCount,
      updatedSeasonCount: base.updatedSeasonCount,
      importedEpisodeCount: base.importedEpisodeCount,
      updatedEpisodeCount: base.updatedEpisodeCount
    },
    skippedByCadenceCount: 0,
    errors: base.errors,
    observability: emptyCoverageObservability()
  };
}

/**
 * Fase 8 — processes (or continues processing) a candidate queue, checkpointing progress
 * to `CatalogSyncRun.metadata` every `TMDB_COVERAGE_BATCH_SIZE` items so an interruption
 * never loses more than one batch of work. A single batched existence/cadence lookup
 * (Fase 12 — no N+1) decides, for every candidate up front, whether it's new, due for a
 * lightweight update, or not due yet (skipped).
 */
async function continueCoverageRun(
  run: { id: string; startedAt: Date },
  state: CoverageResumeState,
  resumed: boolean,
  cache: SyncCache
): Promise<CoverageSummary> {
  const errors = [...state.errors];
  const totals = { ...state.totals };
  let skippedByCadenceCount = state.skippedByCadenceCount;
  let processedCount = state.processedCount;
  const queue = state.remainingQueue;
  const batchSize = config.catalogSync.coverageBatchSize;

  const idsToCheck = queue.map((candidate) => candidate.tmdbId);
  const existingMappings = idsToCheck.length
    ? await prisma.externalSourceMapping.findMany({
        where: { source: ExternalSource.TMDB, entityType: ExternalEntityType.SERIES, externalId: { in: idsToCheck } },
        select: { externalId: true, lastSyncedAt: true, series: { select: { status: true } } }
      })
    : [];
  const existingByTmdbId = new Map<string, { lastSyncedAt: Date | null; status: SeriesLifecycleStatus }>(
    existingMappings.map((mapping) => [mapping.externalId, { lastSyncedAt: mapping.lastSyncedAt, status: mapping.series.status }])
  );

  const statsBefore = getTmdbCallStats();

  while (queue.length > 0) {
    const candidate = queue.shift() as AggregatedCandidate;
    const existingInfo = existingByTmdbId.get(candidate.tmdbId) ?? null;
    const label = candidate.item.name ?? candidate.tmdbId;

    try {
      if (!existingInfo) {
        const normalized = await fetchFullSeriesFromTmdb(candidate.tmdbId, cache);
        const { counts } = await upsertNormalizedSeriesWithCounts(normalized);
        addCounts(totals, counts);
      } else if (isDueForUpdate(existingInfo.status, existingInfo.lastSyncedAt)) {
        const [normalized] = normalizeTmdbSeriesList([candidate.item]);
        const { counts } = await upsertNormalizedSeriesWithCounts(normalized);
        addCounts(totals, counts);
      } else {
        skippedByCadenceCount += 1;
      }
    } catch (error) {
      errors.push({ series: label, message: describeError(error) });
    }

    processedCount += 1;

    if (processedCount % batchSize === 0 || queue.length === 0) {
      await persistResumeState(run.id, {
        remainingQueue: queue,
        processedCount,
        perSourceCounts: state.perSourceCounts,
        totalCollected: state.totalCollected,
        uniqueCount: state.uniqueCount,
        duplicatesRemoved: state.duplicatesRemoved,
        pagesProcessed: state.pagesProcessed,
        totals,
        skippedByCadenceCount,
        errors,
        cacheHits: state.cacheHits + cache.stats().hits,
        cacheMisses: state.cacheMisses + cache.stats().misses
      });
    }
  }

  const statsAfter = getTmdbCallStats();
  const requestCount = statsAfter.requestCount - statsBefore.requestCount;
  const cacheStats = cache.stats();
  const totalCacheHits = state.cacheHits + cacheStats.hits;
  const totalCacheMisses = state.cacheMisses + cacheStats.misses;

  const observability: CoverageObservability = {
    pagesProcessed: state.pagesProcessed,
    requestCount,
    retryCount: statsAfter.retryCount - statsBefore.retryCount,
    rateLimitHitCount: statsAfter.rateLimitHitCount - statsBefore.rateLimitHitCount,
    averageRequestMs: requestCount > 0 ? Math.round((statsAfter.totalRequestMs - statsBefore.totalRequestMs) / requestCount) : 0,
    lightweightUpdateCount: totals.updatedSeriesCount,
    skippedCount: skippedByCadenceCount,
    cacheHits: totalCacheHits,
    cacheMisses: totalCacheMisses,
    callsSaved: state.duplicatesRemoved + skippedByCadenceCount + totalCacheHits
  };

  const totalTouched = totals.importedSeriesCount + totals.updatedSeriesCount;
  const status: CatalogSyncStatus = errors.length === 0 ? "SUCCESS" : totalTouched > 0 ? "PARTIAL" : "FAILED";

  const summary = await finishRun(run.id, "COVERAGE", run.startedAt, status, totals, errors, observability);

  return {
    runId: summary.runId,
    status: summary.status,
    startedAt: summary.startedAt,
    finishedAt: summary.finishedAt,
    durationMs: summary.durationMs,
    resumed,
    perSourceCounts: state.perSourceCounts,
    totalCollected: state.totalCollected,
    uniqueCount: state.uniqueCount,
    duplicatesRemoved: state.duplicatesRemoved,
    totals,
    skippedByCadenceCount,
    errors,
    observability
  };
}

export type ResumeCoverageResult = { resumed: boolean; summary?: CoverageSummary };

/**
 * Fase 8 — resumes the most recent interrupted COVERAGE run, if one exists with a
 * non-empty remaining queue. Never starts new work — that's `syncCoverage`'s job.
 * `npm run sync:resume` calls this directly; `syncCoverage` also calls it first so a
 * plain `npm run sync:coverage` continues unfinished work instead of racing it.
 */
export async function resumeCoverage(): Promise<ResumeCoverageResult> {
  const existingRun = await findLatestCoverageRun();
  const resumeState = extractResumeState(existingRun);

  if (!existingRun || !resumeState || resumeState.remainingQueue.length === 0) {
    return { resumed: false };
  }

  const summary = await continueCoverageRun(existingRun, resumeState, true, createSyncCache());
  return { resumed: true, summary };
}

/**
 * Fase 2-9 — the full aggregated coverage sync. Consolidates all six discovery sources
 * (Fase 2), deduplicates by TMDb id (Fase 3), prioritizes (Fase 4), separates new from
 * existing series and applies status-based update cadence to existing ones (Fase 5/6),
 * caches within the run (Fase 7), checkpoints for resumability (Fase 8), and returns
 * every metric Fase 9/11 asks for.
 */
export async function syncCoverage(options: CoverageOptions = {}): Promise<CoverageSummary> {
  const resumeResult = await resumeCoverage();
  if (resumeResult.resumed && resumeResult.summary) {
    return resumeResult.summary;
  }

  const staleRunningRun = await findLatestCoverageRun();
  if (staleRunningRun) {
    return toCoverageSummary(alreadyRunningSummary(staleRunningRun, "COVERAGE"), false);
  }

  if (!getTmdbCredentials().isConfigured) {
    const run = await createRun("COVERAGE");
    return toCoverageSummary(await abortRunUnconfigured(run.id, "COVERAGE", run.startedAt), false);
  }

  return runCoverageWithSources(buildSourceDefinitions(options));
}

/**
 * The actual aggregate→dedupe→prioritize→process pipeline, parameterized over which
 * source definitions to use. `syncCoverage` calls this with the real TMDb fetchers;
 * tests call it directly with synthetic `fetchPage` functions to exercise dedup/
 * priority/cadence/resume against the real database without any network access.
 */
export async function runCoverageWithSources(sourceDefs: SourceDefinition[]): Promise<CoverageSummary> {
  const run = await createRun("COVERAGE");
  const cache = createSyncCache();
  const aggregation = await collectCandidates(sourceDefs, cache);

  const initialState: CoverageResumeState = {
    remainingQueue: aggregation.candidates,
    processedCount: 0,
    perSourceCounts: aggregation.perSourceCounts,
    totalCollected: aggregation.totalCollected,
    uniqueCount: aggregation.uniqueCount,
    duplicatesRemoved: aggregation.duplicatesRemoved,
    pagesProcessed: aggregation.pagesProcessed,
    totals: emptyCounts(),
    skippedByCadenceCount: 0,
    errors: aggregation.errors.map((error) => ({ series: error.source, message: error.message })),
    cacheHits: cache.stats().hits,
    cacheMisses: cache.stats().misses
  };

  await persistResumeState(run.id, initialState);

  return continueCoverageRun(run, initialState, false, cache);
}

/**
 * Fase 6 standalone (`npm run sync:update`) — refreshes only the already-catalogued
 * series that are actually due per their status-based cadence; no new discovery. Unlike
 * `syncExistingSeriesDetails` (`sync:series`, unchanged), which always fully refreshes
 * every mapped series, this is the "don't do it if it was just done" smart version.
 */
export async function syncUpdateDue(): Promise<CatalogSyncSummary> {
  const type: CatalogSyncType = "SERIES_DETAILS";
  const runningRun = await findRunningRun(type);
  if (runningRun) return alreadyRunningSummary(runningRun, type);

  const run = await createRun(type);

  if (!getTmdbCredentials().isConfigured) {
    return abortRunUnconfigured(run.id, type, run.startedAt);
  }

  const mappings = await prisma.externalSourceMapping.findMany({
    where: { source: "TMDB", entityType: "SERIES" },
    select: { externalId: true, lastSyncedAt: true, series: { select: { title: true, status: true } } }
  });

  const counts = emptyCounts();
  const errors: SyncItemError[] = [];
  let skippedByCadenceCount = 0;
  const statsBefore = getTmdbCallStats();

  for (const mapping of mappings) {
    if (!isDueForUpdate(mapping.series.status, mapping.lastSyncedAt)) {
      skippedByCadenceCount += 1;
      continue;
    }
    await syncOneSeries(mapping.externalId, mapping.series.title, counts, errors);
  }

  const statsAfter = getTmdbCallStats();
  const requestCount = statsAfter.requestCount - statsBefore.requestCount;
  const observability: CatalogSyncObservability = {
    pagesProcessed: 0,
    requestCount,
    retryCount: statsAfter.retryCount - statsBefore.retryCount,
    rateLimitHitCount: statsAfter.rateLimitHitCount - statsBefore.rateLimitHitCount,
    averageRequestMs: requestCount > 0 ? Math.round((statsAfter.totalRequestMs - statsBefore.totalRequestMs) / requestCount) : 0,
    lightweightUpdateCount: 0,
    skippedCount: skippedByCadenceCount
  };

  const status: CatalogSyncStatus = errors.length === 0 ? "SUCCESS" : counts.updatedSeriesCount > 0 ? "PARTIAL" : "FAILED";

  return finishRun(run.id, type, run.startedAt, status, counts, errors, observability);
}

export { resetTmdbCallStats };
