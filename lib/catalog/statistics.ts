import { prisma } from "@/lib/db/prisma";

/**
 * Fase 9 (INSERIES-TMDB-CATALOG-QUALITY-01) — catalog-wide composition metrics for the
 * sync report and `sync:stats`. This is one bounded `findMany` (only the scalar/array
 * fields needed, never the full row with seasons/episodes) followed by an in-memory
 * reduce — genres/originCountry/watchProviders are Postgres array columns, and Prisma's
 * `groupBy` can't "explode" an array column, so a single-query-then-reduce is both the
 * simplest and the only-one-query option (Fase 11 — no N+1: one query regardless of
 * catalog size).
 */
export type CatalogStatistics = {
  totalSeries: number;
  byGenre: Record<string, number>;
  byCountry: Record<string, number>;
  byLanguage: Record<string, number>;
  byStatus: Record<string, number>;
  byProvider: Record<string, number>;
  byDecade: Record<string, number>;
  averageQualityScore: number;
};

function increment(map: Record<string, number>, key: string) {
  map[key] = (map[key] ?? 0) + 1;
}

export async function computeCatalogStatistics(): Promise<CatalogStatistics> {
  const rows = await prisma.series.findMany({
    select: {
      genres: true,
      originCountry: true,
      language: true,
      status: true,
      watchProviders: true,
      firstAirYear: true,
      qualityScore: true
    }
  });

  const stats: CatalogStatistics = {
    totalSeries: rows.length,
    byGenre: {},
    byCountry: {},
    byLanguage: {},
    byStatus: {},
    byProvider: {},
    byDecade: {},
    averageQualityScore: 0
  };

  let qualityScoreSum = 0;
  let qualityScoreCount = 0;

  for (const row of rows) {
    row.genres.forEach((genre) => increment(stats.byGenre, genre));
    row.originCountry.forEach((country) => increment(stats.byCountry, country));
    row.watchProviders.forEach((provider) => increment(stats.byProvider, provider));
    if (row.language) increment(stats.byLanguage, row.language);
    increment(stats.byStatus, row.status);
    if (row.firstAirYear) increment(stats.byDecade, `${Math.floor(row.firstAirYear / 10) * 10}s`);
    if (row.qualityScore !== null) {
      qualityScoreSum += row.qualityScore;
      qualityScoreCount += 1;
    }
  }

  stats.averageQualityScore = qualityScoreCount > 0 ? Math.round((qualityScoreSum / qualityScoreCount) * 100) / 100 : 0;

  return stats;
}
