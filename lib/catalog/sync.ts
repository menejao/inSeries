import type { CatalogSyncStatus, CatalogSyncType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getTmdbCredentials } from "@/lib/config";
import { incrementSyncStarted } from "@/lib/metrics/service";
import { logger } from "@/lib/logger";
import { normalizeTmdbSeries } from "@/lib/catalog/normalize";
import { upsertNormalizedSeriesWithCounts, type CatalogUpsertCounts } from "@/lib/catalog/repository";
import {
  fetchPopularTmdbSeries,
  fetchTmdbSeasonDetails,
  fetchTmdbSeriesDetails,
  TmdbApiError,
  TmdbConfigurationError,
  TmdbTimeoutError
} from "@/lib/tmdb/service";

const MAX_POPULAR_PAGES = 5;

export type SyncItemError = { series: string; message: string };

export type CatalogSyncSummary = CatalogUpsertCounts & {
  runId: string;
  type: CatalogSyncType;
  status: CatalogSyncStatus;
  startedAt: Date;
  finishedAt: Date;
  durationMs: number;
  errorMessage: string | null;
  errors: SyncItemError[];
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

/** Never includes API keys/tokens — only safe, human-readable context. */
function describeError(error: unknown): string {
  if (error instanceof TmdbConfigurationError) return error.message;
  if (error instanceof TmdbTimeoutError) return error.message;
  if (error instanceof TmdbApiError) return `${error.message} (status ${error.status})`;
  if (error instanceof Error) return error.message;
  return "Erro desconhecido durante a sincronizacao.";
}

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
  errors: SyncItemError[]
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
      metadata: errors.length ? { errors } : undefined
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
    errors
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
 * Fetches full series details + all seasons/episodes for one TMDb id.
 * A season TMDb fails to return episodes for is kept as an "announced" season
 * (zero episodes) instead of aborting the whole series import — matches the
 * existing calendar "future season" convention.
 */
async function fetchFullSeriesFromTmdb(tmdbId: string | number) {
  const details = await fetchTmdbSeriesDetails(tmdbId);
  const seasonCount = details.number_of_seasons ?? 0;
  const fullSeasons = [];

  for (const seasonNumber of Array.from({ length: seasonCount }, (_, index) => index + 1)) {
    try {
      fullSeasons.push(await fetchTmdbSeasonDetails(tmdbId, seasonNumber));
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

/** Imports/updates one series by TMDb id; isolates a single series' failure from the rest of the run. */
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
 * Discovers and imports/updates TMDb's popular TV series (up to MAX_POPULAR_PAGES
 * pages, ~20 series/page). Idempotent: re-running never duplicates series, seasons
 * or episodes (matched by slug/number, TMDb external id) and only touches catalog
 * metadata — never UserSeriesStatus, UserEpisodeProgress, Review, List or Activity.
 */
export async function syncPopularSeries(options: { pages?: number } = {}): Promise<CatalogSyncSummary> {
  const type: CatalogSyncType = "POPULAR_SERIES";
  const runningRun = await findRunningRun(type);
  if (runningRun) return alreadyRunningSummary(runningRun, type);

  const run = await createRun(type);

  if (!getTmdbCredentials().isConfigured) {
    return abortRunUnconfigured(run.id, type, run.startedAt);
  }

  const pages = Math.max(1, Math.min(MAX_POPULAR_PAGES, options.pages ?? 1));
  const counts = emptyCounts();
  const errors: SyncItemError[] = [];

  for (let page = 1; page <= pages; page += 1) {
    let popularItems;
    try {
      popularItems = await fetchPopularTmdbSeries(page);
    } catch (error) {
      errors.push({ series: `pagina ${page}`, message: describeError(error) });
      continue;
    }

    for (const item of popularItems) {
      await syncOneSeries(item.id, item.name ?? String(item.id), counts, errors);
    }
  }

  const totalTouched = counts.importedSeriesCount + counts.updatedSeriesCount;
  const status: CatalogSyncStatus = errors.length === 0 ? "SUCCESS" : totalTouched > 0 ? "PARTIAL" : "FAILED";

  return finishRun(run.id, type, run.startedAt, status, counts, errors);
}

/**
 * Re-fetches details/seasons/episodes for series already in the catalog (via their
 * stored ExternalSourceMapping), refreshing metadata without rediscovering the
 * "popular" list. Pass seriesIds to scope to specific series, or omit to refresh all.
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

  const pages = Math.max(1, Math.min(MAX_POPULAR_PAGES, options.pages ?? 1));
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

export async function getRecentSyncRuns(limit = 10) {
  return prisma.catalogSyncRun.findMany({
    orderBy: { startedAt: "desc" },
    take: limit
  });
}
