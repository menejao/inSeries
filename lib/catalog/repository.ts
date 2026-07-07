import type { Prisma } from "@prisma/client";
import { ExternalEntityType, ExternalSource } from "@prisma/client";
import { mockSeries } from "@/lib/catalog/mock-data";
import {
  mapStatusToPrisma,
  normalizeTmdbSeries,
  normalizeTmdbSeriesList,
  type NormalizedCatalogSeries
} from "@/lib/catalog/normalize";
import { canUseDatabase, isMissingTableError } from "@/lib/db/health";
import { prisma } from "@/lib/db/prisma";
import type { Series } from "@/lib/types";
import { fetchPopularTmdbSeries, fetchTmdbSeasonDetails, fetchTmdbSeriesDetails, searchTmdbSeries } from "@/lib/tmdb/service";
import { CurationRejectedError, passesDetailCuration } from "@/lib/catalog/curation";
import { computeQualityScore } from "@/lib/catalog/quality-score";
import { deriveCollectionTags } from "@/lib/catalog/collection-tags";

export function toSeriesView(model: Prisma.SeriesGetPayload<{ include: { seasons: { include: { episodes: true } } } }>): Series {
  return {
    id: model.id,
    slug: model.slug,
    title: model.title,
    originalTitle: model.originalTitle ?? model.title,
    year: model.firstAirYear ?? 0,
    status: model.status.replaceAll("_", " "),
    overview: model.overview ?? "Sinopse indisponivel no momento.",
    genres: model.genres,
    language: model.language ?? "PT-BR",
    platform: model.network ?? "Catalogo interno",
    popularity: model.popularityScore ? model.popularityScore.toFixed(0) : "0",
    posterUrl: model.posterUrl ?? "",
    backdropUrl: model.backdropUrl ?? "",
    voteAverage: model.voteAverage ?? null,
    qualityScore: model.qualityScore ?? null,
    discoveryScore: model.discoveryScore ?? null,
    collectionTags: model.collectionTags,
    watchProviders: model.watchProviders,
    keywords: model.keywords,
    type: model.type ?? null,
    logoUrl: model.logoUrl ?? null,
    originCountry: model.originCountry,
    spokenLanguages: model.spokenLanguages,
    createdBy: model.createdBy,
    networks: model.networks,
    productionCompanies: model.productionCompanies,
    productionCountries: model.productionCountries,
    tagline: model.tagline ?? null,
    homepage: model.homepage ?? null,
    numberOfSeasons: model.numberOfSeasons ?? null,
    numberOfEpisodes: model.numberOfEpisodes ?? null,
    seasons: model.seasons
      .sort((a, b) => a.number - b.number)
      .map((season) => ({
        id: season.id,
        number: season.number,
        title: season.title,
        year: season.airYear ?? 0,
        episodeCount: season.episodeCount,
        posterUrl: season.posterUrl ?? "",
        overview: season.overview ?? "",
        episodes: season.episodes
          .sort((a, b) => a.number - b.number)
          .map((episode) => ({
            id: episode.id,
            number: episode.number,
            title: episode.title,
            overview: episode.overview ?? "Sinopse indisponivel.",
            runtimeMinutes: episode.runtimeMinutes ?? 0,
            airedOn: episode.airedAt?.toISOString().slice(0, 10) ?? "",
            watched: false,
            stillUrl: episode.stillUrl ?? ""
          }))
      }))
  };
}

function filterMockSeries(query?: string) {
  if (!query) return mockSeries;
  const normalized = query.toLowerCase();
  return mockSeries.filter((series) => {
    return (
      series.title.toLowerCase().includes(normalized) ||
      series.originalTitle.toLowerCase().includes(normalized) ||
      series.genres.some((genre) => genre.toLowerCase().includes(normalized))
    );
  });
}

export async function listCatalogSeries(query?: string) {
  if (!(await canUseDatabase())) {
    return filterMockSeries(query);
  }

  try {
    const rows = await prisma.series.findMany({
      where: query
        ? {
            OR: [
              { title: { contains: query, mode: "insensitive" } },
              { originalTitle: { contains: query, mode: "insensitive" } },
              { genres: { has: query } }
            ]
          }
        : undefined,
      include: {
        seasons: {
          include: {
            episodes: true
          }
        }
      },
      orderBy: [{ popularityScore: "desc" }, { createdAt: "desc" }]
    });

    return rows.map(toSeriesView);
  } catch (error) {
    if (isMissingTableError(error)) {
      return filterMockSeries(query);
    }

    throw error;
  }
}

export async function getCatalogSeriesBySlug(slug: string) {
  if (!(await canUseDatabase())) {
    return mockSeries.find((series) => series.slug === slug || series.id === slug);
  }

  try {
    const row = await prisma.series.findFirst({
      where: {
        OR: [{ slug }, { id: slug }]
      },
      include: {
        seasons: {
          include: {
            episodes: true
          }
        }
      }
    });

    return row ? toSeriesView(row) : mockSeries.find((series) => series.slug === slug || series.id === slug);
  } catch (error) {
    if (isMissingTableError(error)) {
      return mockSeries.find((series) => series.slug === slug || series.id === slug);
    }

    throw error;
  }
}

export type CatalogUpsertCounts = {
  importedSeriesCount: number;
  updatedSeriesCount: number;
  importedSeasonCount: number;
  updatedSeasonCount: number;
  importedEpisodeCount: number;
  updatedEpisodeCount: number;
};

function emptyUpsertCounts(): CatalogUpsertCounts {
  return {
    importedSeriesCount: 0,
    updatedSeriesCount: 0,
    importedSeasonCount: 0,
    updatedSeasonCount: 0,
    importedEpisodeCount: 0,
    updatedEpisodeCount: 0
  };
}

/**
 * Upserts a normalized TMDb series (and its seasons/episodes) and tracks how many
 * rows were created vs. updated, so callers (sync runs) can report accurate counts.
 * Never touches UserSeriesStatus, UserEpisodeProgress, Review, List or Activity —
 * only catalog metadata tables, so user-generated data is always preserved.
 *
 * Fase 12 (INSERIES-TMDB-CATALOG-SCALE-01) — series+mapping and each season+its episodes
 * are written inside their own scoped transaction (not the whole series in one giant
 * transaction, which would hold locks far longer than necessary for a series with many
 * seasons/episodes).
 *
 * Fase 6 — `series.seasons` may legitimately be empty even for an already-catalogued
 * series (the "lightweight" discovery-sync path only re-fetches summary fields, not
 * seasons/episodes) — in that case this function only refreshes series-level metadata
 * and leaves existing seasons/episodes untouched.
 */
export async function upsertNormalizedSeriesWithCounts(series: NormalizedCatalogSeries) {
  const counts = emptyUpsertCounts();

  // Match by the stable TMDb external id first, not by slug: a series' title (and
  // therefore its derived slug) can change on TMDb, and matching by slug alone
  // would create a duplicate series instead of updating the existing one.
  const existingMapping = await prisma.externalSourceMapping.findUnique({
    where: {
      source_entityType_externalId: {
        source: ExternalSource.TMDB,
        entityType: ExternalEntityType.SERIES,
        externalId: series.external.externalId
      }
    },
    select: { seriesId: true }
  });

  // Selected consistently on both branches (matched-by-id and fallback-by-slug) so the
  // scoring/tagging merge logic below can rely on a single shape either way.
  const existingSeriesSelect = {
    id: true,
    posterUrl: true,
    backdropUrl: true,
    overview: true,
    logoUrl: true,
    numberOfSeasons: true,
    numberOfEpisodes: true,
    watchProviders: true,
    originCountry: true,
    language: true,
    keywords: true,
    type: true
  } satisfies Prisma.SeriesSelect;

  const existingSeries = existingMapping
    ? await prisma.series.findUnique({ where: { id: existingMapping.seriesId }, select: existingSeriesSelect })
    : await prisma.series.findUnique({ where: { slug: series.slug }, select: existingSeriesSelect });

  // Fase 3 (INSERIES-TMDB-CATALOG-QUALITY-01) — curation only gates first-time intake,
  // never an already-catalogued series (that would be a destructive retroactive purge).
  if (!existingSeries) {
    const verdict = passesDetailCuration(series);
    if (!verdict.passes) {
      throw new CurationRejectedError(verdict.reason ?? "reprovado pela curadoria automatica");
    }
  }

  // Fase 2/7 — quality score and collection tags are computed from the *effective* value
  // of each signal (new value if present, otherwise whatever's already persisted) so a
  // lightweight update (which only carries list-item fields) never drags an already-rich
  // series' score/tags down just because this particular payload lacks e.g. numberOfSeasons.
  const effective = {
    posterUrl: series.posterUrl || existingSeries?.posterUrl || null,
    backdropUrl: series.backdropUrl || existingSeries?.backdropUrl || null,
    overview: series.overview ?? existingSeries?.overview ?? null,
    logoUrl: series.logoUrl ?? existingSeries?.logoUrl ?? null,
    numberOfSeasons: series.numberOfSeasons ?? existingSeries?.numberOfSeasons ?? null,
    numberOfEpisodes: series.numberOfEpisodes ?? existingSeries?.numberOfEpisodes ?? null,
    watchProviders: series.watchProviders ?? existingSeries?.watchProviders ?? [],
    originCountry: series.originCountry ?? existingSeries?.originCountry ?? [],
    language: series.language ?? existingSeries?.language ?? null,
    keywords: series.keywords ?? existingSeries?.keywords ?? [],
    type: series.type ?? existingSeries?.type ?? null
  };

  const qualityScore = computeQualityScore({
    popularity: series.popularityScore,
    voteAverage: series.voteAverage,
    voteCount: series.voteCount,
    firstAirYear: series.year || null,
    status: mapStatusToPrisma(series.status),
    numberOfSeasons: effective.numberOfSeasons,
    numberOfEpisodes: effective.numberOfEpisodes,
    posterUrl: effective.posterUrl,
    backdropUrl: effective.backdropUrl,
    overview: effective.overview,
    logoUrl: effective.logoUrl,
    watchProviders: effective.watchProviders,
    originCountry: effective.originCountry,
    language: effective.language
  });

  const collectionTags = deriveCollectionTags({
    genres: series.genres,
    type: effective.type,
    keywords: effective.keywords,
    originCountry: effective.originCountry,
    numberOfSeasons: effective.numberOfSeasons,
    numberOfEpisodes: effective.numberOfEpisodes,
    status: mapStatusToPrisma(series.status),
    popularity: series.popularityScore,
    voteAverage: series.voteAverage,
    voteCount: series.voteCount
  });

  // Fields with `undefined` are skipped by Prisma's update (existing value preserved) —
  // important for the lightweight discovery-sync path, which normalizes a plain list
  // item and therefore never has tagline/homepage/networks/etc. to overwrite with.
  const seriesData = {
    slug: series.slug,
    title: series.title,
    originalTitle: series.originalTitle,
    overview: series.overview,
    posterUrl: series.posterUrl || null,
    backdropUrl: series.backdropUrl || null,
    firstAirYear: series.year || null,
    language: series.language,
    network: series.platform,
    genres: series.genres,
    status: mapStatusToPrisma(series.status),
    popularityScore: series.popularityScore ?? null,
    voteAverage: series.voteAverage ?? null,
    voteCount: series.voteCount ?? null,
    tagline: series.tagline,
    homepage: series.homepage,
    originCountry: series.originCountry,
    spokenLanguages: series.spokenLanguages,
    numberOfSeasons: series.numberOfSeasons,
    numberOfEpisodes: series.numberOfEpisodes,
    networks: series.networks,
    productionCountries: series.productionCountries,
    productionCompanies: series.productionCompanies,
    createdBy: series.createdBy,
    logoUrl: series.logoUrl,
    keywords: series.keywords,
    type: series.type,
    watchProviders: series.watchProviders,
    qualityScore,
    collectionTags
  };

  const [baseSeries] = await prisma.$transaction(async (tx) => {
    const row = existingSeries
      ? await tx.series.update({ where: { id: existingSeries.id }, data: seriesData })
      : await tx.series.create({ data: seriesData });

    await tx.externalSourceMapping.upsert({
      where: {
        source_entityType_externalId: {
          source: ExternalSource.TMDB,
          entityType: ExternalEntityType.SERIES,
          externalId: series.external.externalId
        }
      },
      update: {
        seriesId: row.id,
        lastSyncedAt: new Date()
      },
      create: {
        source: ExternalSource.TMDB,
        entityType: ExternalEntityType.SERIES,
        externalId: series.external.externalId,
        seriesId: row.id,
        lastSyncedAt: new Date()
      }
    });

    return [row];
  });

  if (existingSeries) {
    counts.updatedSeriesCount += 1;
  } else {
    counts.importedSeriesCount += 1;
  }

  for (const season of series.seasons) {
    const seasonCounts = await prisma.$transaction(
      async (tx) => {
        const existingSeason = await tx.season.findUnique({
          where: { seriesId_number: { seriesId: baseSeries.id, number: season.number } },
          select: { id: true }
        });

        // Season has two unique constraints (seriesId+number, externalSource+externalId).
        // Prisma's upsert() compiles to a Postgres INSERT ... ON CONFLICT that only
        // targets one constraint, so a raw upsert can throw a unique violation on the
        // other constraint when re-syncing. Branch explicitly instead.
        const seasonData = {
          title: season.title,
          overview: season.overview || null,
          posterUrl: season.posterUrl || null,
          airYear: season.year || null,
          episodeCount: season.episodeCount,
          externalSource: season.external ? ExternalSource.TMDB : null,
          externalId: season.external?.externalId ?? null
        };
        const baseSeason = existingSeason
          ? await tx.season.update({ where: { id: existingSeason.id }, data: seasonData })
          : await tx.season.create({ data: { seriesId: baseSeries.id, number: season.number, ...seasonData } });

        let importedEpisodeCount = 0;
        let updatedEpisodeCount = 0;

        for (const episode of season.episodes) {
          const existingEpisode = await tx.episode.findUnique({
            where: { seasonId_number: { seasonId: baseSeason.id, number: episode.number } },
            select: { id: true }
          });

          // Same rationale as Season above: Episode also has two unique constraints,
          // so branch explicitly instead of relying on Prisma's upsert().
          const episodeData = {
            title: episode.title,
            overview: episode.overview,
            stillUrl: episode.stillUrl || null,
            runtimeMinutes: episode.runtimeMinutes || null,
            airedAt: episode.airedOn ? new Date(episode.airedOn) : null,
            externalSource: episode.external ? ExternalSource.TMDB : null,
            externalId: episode.external?.externalId ?? null
          };
          if (existingEpisode) {
            await tx.episode.update({ where: { id: existingEpisode.id }, data: episodeData });
          } else {
            await tx.episode.create({ data: { seasonId: baseSeason.id, number: episode.number, ...episodeData } });
          }

          if (existingEpisode) {
            updatedEpisodeCount += 1;
          } else {
            importedEpisodeCount += 1;
          }
        }

        return { isNewSeason: !existingSeason, importedEpisodeCount, updatedEpisodeCount };
      },
      { timeout: 20_000 }
    );

    if (seasonCounts.isNewSeason) {
      counts.importedSeasonCount += 1;
    } else {
      counts.updatedSeasonCount += 1;
    }
    counts.importedEpisodeCount += seasonCounts.importedEpisodeCount;
    counts.updatedEpisodeCount += seasonCounts.updatedEpisodeCount;
  }

  return {
    series: baseSeries,
    counts,
    // Fase 12 — per-item enrichment signals, aggregated by callers (lib/catalog/sync.ts)
    // into the run's "providers found"/"logos found"/"keywords synced"/"tags generated" metrics.
    quality: {
      qualityScore,
      hasProviders: effective.watchProviders.length > 0,
      hasLogo: Boolean(effective.logoUrl),
      hasKeywords: effective.keywords.length > 0,
      tagsGenerated: collectionTags.length
    }
  };
}

async function upsertNormalizedSeries(series: NormalizedCatalogSeries) {
  const { series: row } = await upsertNormalizedSeriesWithCounts(series);
  return row;
}

export async function importPopularSeriesToCatalog(page = 1) {
  const results = await fetchPopularTmdbSeries(page);
  const normalized = normalizeTmdbSeriesList(results);

  for (const item of normalized) {
    const details = await fetchTmdbSeriesDetails(item.external.externalId);
    const seasonCount = details.number_of_seasons ?? 0;
    const seasonNumbers = Array.from({ length: seasonCount }, (_, index) => index + 1);
    const fullSeasons = [];

    for (const seasonNumber of seasonNumbers) {
      try {
        fullSeasons.push(await fetchTmdbSeasonDetails(item.external.externalId, seasonNumber));
      } catch {
        fullSeasons.push({
          id: seasonNumber,
          season_number: seasonNumber,
          name: `Temporada ${seasonNumber}`,
          episodes: []
        });
      }
    }

    await upsertNormalizedSeries(normalizeTmdbSeries({ ...details, seasons: fullSeasons }));
  }
}

export async function importSeriesFromTmdb(tmdbId: string) {
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

  const normalized = normalizeTmdbSeries({ ...details, seasons: fullSeasons });
  await upsertNormalizedSeries(normalized);
  return getCatalogSeriesBySlug(normalized.slug);
}

export async function searchCatalogSeries(query?: string) {
  if (query && !(await canUseDatabase())) {
    return filterMockSeries(query);
  }

  return listCatalogSeries(query);
}

export async function searchExternalSeries(query: string) {
  const results = await searchTmdbSeries(query);
  return normalizeTmdbSeriesList(results);
}

/**
 * Fase 6 (INSERIES-TMDB-CATALOG-QUALITY-01) — queries the catalog by a real TMDb keyword
 * (e.g. "time travel", "anti-hero"), synced onto `Series.keywords` since SCALE-01. Not
 * wired to any route/page yet (no navigation change this sprint) — prepared for a future
 * keyword-based discovery/filter feature.
 */
export async function findSeriesByKeyword(keyword: string, limit = 20) {
  if (!(await canUseDatabase())) return [];

  const rows = await prisma.series.findMany({
    where: { keywords: { has: keyword } },
    include: { seasons: { include: { episodes: true } } },
    orderBy: [{ qualityScore: "desc" }, { popularityScore: "desc" }],
    take: limit
  });

  return rows.map(toSeriesView);
}
