import type { CatalogSyncStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { config, getTmdbCredentials } from "@/lib/config";
import { logger } from "@/lib/logger";
import { getTmdbCallStats } from "@/lib/tmdb/rate-limit";
import { describeTmdbError } from "@/lib/tmdb/errors";
import { collectCandidates, type AggregatedCandidate, type SourceDefinition } from "@/lib/catalog/aggregator";
import { createSyncCache } from "@/lib/catalog/sync-cache";
import { mapStatusToPrisma } from "@/lib/catalog/normalize";
import { fetchFullSeriesFromTmdb } from "@/lib/catalog/sync";
import { upsertNormalizedSeriesWithCounts, type CatalogUpsertCounts } from "@/lib/catalog/repository";
import { CurationRejectedError } from "@/lib/catalog/curation";
import { passesDetailBlacklist, passesListItemBlacklist } from "@/lib/discovery/blacklist";
import { computeSourceWeightScore } from "@/lib/discovery/source-weight";
import { computeDiscoveryScore } from "@/lib/discovery/discovery-score";
import { computeCatalogStatistics, type CatalogStatistics } from "@/lib/catalog/statistics";
import { createTmdbDiscoveryProvider } from "@/lib/discovery/providers/tmdb-provider";
import type { DiscoveryProvider } from "@/lib/discovery/providers/types";

/**
 * Fase 2 (INSERIES-TRENDING-DISCOVERY-ENGINE-01) — the single engine responsible for
 * deciding which series enter the queue at all, ranked by how many (and how strongly)
 * weighted discovery sources back them up, then filtered by a dedicated blacklist
 * (Fase 5) and capped to `maxCandidatesPerRun` (Fase 2's "importar as séries certas, não
 * mais séries"). Entirely additive: `collectCandidates`, `fetchFullSeriesFromTmdb` and
 * `upsertNormalizedSeriesWithCounts` are the exact same functions the existing
 * syncCoverage/syncPopularSeries/etc. pipeline already uses, imported here unchanged.
 */
export type DiscoveryEngineOptions = {
  provider?: DiscoveryProvider;
  pages?: Partial<Record<string, number>>;
};

export type DiscoveryEngineObservability = {
  candidatesCollected: number;
  candidatesRanked: number;
  discardedCount: number;
  discardReasons: Record<string, number>;
  skippedByRankCount: number;
  processedCount: number;
  discoveryScoreAverage: number;
  trendingScoreAverage: number;
  providersFoundCount: number;
  requestCount: number;
  retryCount: number;
  rateLimitHitCount: number;
};

export type DiscoveryEngineSummary = {
  runId: string;
  provider: string;
  status: CatalogSyncStatus;
  startedAt: Date;
  finishedAt: Date;
  durationMs: number;
  totals: CatalogUpsertCounts;
  errors: Array<{ series: string; message: string }>;
  observability: DiscoveryEngineObservability;
  /** Fase 11 — catalog-wide snapshot (streaming/status/genre/country/language distribution), same timing convention as CoverageSummary.catalogStatistics. */
  catalogStatistics: CatalogStatistics;
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

function recordDiscard(reasons: Record<string, number>, reason: string | undefined) {
  const key = reason ?? "motivo nao informado";
  reasons[key] = (reasons[key] ?? 0) + 1;
}

async function findRunningDiscoveryEngineRun() {
  return prisma.catalogSyncRun.findFirst({ where: { type: "DISCOVERY_ENGINE", status: "RUNNING" }, orderBy: { startedAt: "desc" } });
}

/**
 * Fase 2/5/9/10/11 — runs the Discovery Engine once: aggregates the provider's weighted
 * sources (reusing the existing aggregator/cache/rate-limiter unchanged), ranks candidates
 * by source-weight score, blacklists obviously-irrelevant ones, processes only the
 * top-ranked `maxCandidatesPerRun`, and persists a Premium Discovery Score for each —
 * distinct from (and computed alongside, never replacing) `qualityScore`.
 */
export async function runDiscoveryEngine(options: DiscoveryEngineOptions = {}): Promise<DiscoveryEngineSummary> {
  const provider = options.provider ?? createTmdbDiscoveryProvider();

  const runningRun = await findRunningDiscoveryEngineRun();
  if (runningRun) {
    return {
      runId: runningRun.id,
      provider: provider.name,
      status: "RUNNING",
      startedAt: runningRun.startedAt,
      finishedAt: runningRun.startedAt,
      durationMs: 0,
      totals: emptyCounts(),
      errors: [{ series: "-", message: "Ja existe uma execucao do Discovery Engine em andamento." }],
      observability: {
        candidatesCollected: 0,
        candidatesRanked: 0,
        discardedCount: 0,
        discardReasons: {},
        skippedByRankCount: 0,
        processedCount: 0,
        discoveryScoreAverage: 0,
        trendingScoreAverage: 0,
        providersFoundCount: 0,
        requestCount: 0,
        retryCount: 0,
        rateLimitHitCount: 0
      },
      catalogStatistics: await computeCatalogStatistics()
    };
  }

  const run = await prisma.catalogSyncRun.create({ data: { source: "TMDB", type: "DISCOVERY_ENGINE", status: "RUNNING" } });

  if (!getTmdbCredentials().isConfigured) {
    const message = "TMDb nao configurado. Defina TMDB_API_KEY ou TMDB_ACCESS_TOKEN no ambiente.";
    await prisma.catalogSyncRun.update({ where: { id: run.id }, data: { status: "FAILED", finishedAt: new Date(), errorMessage: message } });
    logger.warn("discovery_engine_unconfigured", { route: "discovery.engine", metadata: { runId: run.id } });
    return {
      runId: run.id,
      provider: provider.name,
      status: "FAILED",
      startedAt: run.startedAt,
      finishedAt: new Date(),
      durationMs: 0,
      totals: emptyCounts(),
      errors: [],
      observability: {
        candidatesCollected: 0,
        candidatesRanked: 0,
        discardedCount: 0,
        discardReasons: {},
        skippedByRankCount: 0,
        processedCount: 0,
        discoveryScoreAverage: 0,
        trendingScoreAverage: 0,
        providersFoundCount: 0,
        requestCount: 0,
        retryCount: 0,
        rateLimitHitCount: 0
      },
      catalogStatistics: await computeCatalogStatistics()
    };
  }

  const weightedSources = provider.buildWeightedSources({ pages: options.pages });
  const cache = createSyncCache();
  const statsBefore = getTmdbCallStats();

  const aggregation = await collectCandidates(weightedSources as SourceDefinition[], cache);

  const discardReasons: Record<string, number> = {};
  let discardedCount = 0;

  const ranked: Array<{ candidate: AggregatedCandidate; sourceWeightScore: number }> = [];
  for (const candidate of aggregation.candidates) {
    const verdict = passesListItemBlacklist(candidate.item);
    if (!verdict.passes) {
      discardedCount += 1;
      recordDiscard(discardReasons, verdict.reason);
      continue;
    }
    ranked.push({ candidate, sourceWeightScore: computeSourceWeightScore(candidate.sources, weightedSources) });
  }

  ranked.sort((a, b) => b.sourceWeightScore - a.sourceWeightScore || b.candidate.priorityScore - a.candidate.priorityScore);

  const maxCandidates = config.discoveryEngine.maxCandidatesPerRun;
  const toProcess = ranked.slice(0, maxCandidates);
  const skippedByRankCount = Math.max(0, ranked.length - toProcess.length);

  const totals = emptyCounts();
  const errors: Array<{ series: string; message: string }> = [];
  let curatedOutCount = 0;
  let processedCount = 0;
  let providersFoundCount = 0;
  let discoveryScoreSum = 0;
  let trendingScoreSum = 0;

  for (const { candidate, sourceWeightScore } of toProcess) {
    const label = candidate.item.name ?? candidate.tmdbId;

    try {
      const normalized = await fetchFullSeriesFromTmdb(candidate.tmdbId, cache);

      const detailVerdict = passesDetailBlacklist(normalized);
      if (!detailVerdict.passes) {
        discardedCount += 1;
        recordDiscard(discardReasons, detailVerdict.reason);
        continue;
      }

      const { series, counts, quality } = await upsertNormalizedSeriesWithCounts(normalized);
      addCounts(totals, counts);

      const discoveryScore = computeDiscoveryScore({
        sourceWeightScore,
        popularity: normalized.popularityScore,
        voteAverage: normalized.voteAverage,
        voteCount: normalized.voteCount,
        firstAirYear: normalized.year || null,
        status: mapStatusToPrisma(normalized.status),
        watchProviders: normalized.watchProviders,
        numberOfSeasons: normalized.numberOfSeasons,
        numberOfEpisodes: normalized.numberOfEpisodes,
        posterUrl: normalized.posterUrl,
        backdropUrl: normalized.backdropUrl,
        collectionTagsCount: quality.tagsGenerated,
        qualityScore: quality.qualityScore
      });

      // A dedicated, bounded (never per-catalog-row) update — repository.ts's shared
      // upsert path stays completely unmodified for every other caller.
      await prisma.series.update({ where: { id: series.id }, data: { discoveryScore } });

      processedCount += 1;
      discoveryScoreSum += discoveryScore;
      trendingScoreSum += sourceWeightScore;
      if (quality.hasProviders) providersFoundCount += 1;
    } catch (error) {
      if (error instanceof CurationRejectedError) {
        curatedOutCount += 1;
        continue;
      }
      errors.push({ series: label, message: describeTmdbError(error) });
    }
  }

  const statsAfter = getTmdbCallStats();
  const finishedAt = new Date();
  const totalTouched = totals.importedSeriesCount + totals.updatedSeriesCount;
  const status: CatalogSyncStatus = errors.length === 0 ? "SUCCESS" : totalTouched > 0 ? "PARTIAL" : "FAILED";

  const observability: DiscoveryEngineObservability = {
    candidatesCollected: aggregation.uniqueCount,
    candidatesRanked: ranked.length,
    discardedCount: discardedCount + curatedOutCount,
    discardReasons: curatedOutCount > 0 ? { ...discardReasons, "reprovado pela curadoria automatica": curatedOutCount } : discardReasons,
    skippedByRankCount,
    processedCount,
    discoveryScoreAverage: processedCount > 0 ? Math.round((discoveryScoreSum / processedCount) * 100) / 100 : 0,
    trendingScoreAverage: processedCount > 0 ? Math.round((trendingScoreSum / processedCount) * 100) / 100 : 0,
    providersFoundCount,
    requestCount: statsAfter.requestCount - statsBefore.requestCount,
    retryCount: statsAfter.retryCount - statsBefore.retryCount,
    rateLimitHitCount: statsAfter.rateLimitHitCount - statsBefore.rateLimitHitCount
  };

  await prisma.catalogSyncRun.update({
    where: { id: run.id },
    data: {
      status,
      finishedAt,
      ...totals,
      errorMessage: errors.length ? `${errors.length} erro(s) durante a execucao do Discovery Engine. Veja metadata.errors.` : null,
      metadata: { provider: provider.name, errors, observability }
    }
  });

  logger.info("discovery_engine_finished", {
    route: "discovery.engine",
    metadata: { runId: run.id, provider: provider.name, status, durationMs: finishedAt.getTime() - run.startedAt.getTime(), totals, observability }
  });

  return {
    runId: run.id,
    provider: provider.name,
    status,
    startedAt: run.startedAt,
    finishedAt,
    durationMs: finishedAt.getTime() - run.startedAt.getTime(),
    totals,
    errors,
    observability,
    catalogStatistics: await computeCatalogStatistics()
  };
}
