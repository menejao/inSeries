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

function toSeriesView(model: Prisma.SeriesGetPayload<{ include: { seasons: { include: { episodes: true } } } }>): Series {
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
            watched: false
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

  const existingSeries = existingMapping
    ? await prisma.series.findUnique({ where: { id: existingMapping.seriesId }, select: { id: true } })
    : await prisma.series.findUnique({ where: { slug: series.slug }, select: { id: true } });

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
    voteCount: series.voteCount ?? null
  };

  const baseSeries = existingSeries
    ? await prisma.series.update({ where: { id: existingSeries.id }, data: seriesData })
    : await prisma.series.create({ data: seriesData });

  if (existingSeries) {
    counts.updatedSeriesCount += 1;
  } else {
    counts.importedSeriesCount += 1;
  }

  await prisma.externalSourceMapping.upsert({
    where: {
      source_entityType_externalId: {
        source: ExternalSource.TMDB,
        entityType: ExternalEntityType.SERIES,
        externalId: series.external.externalId
      }
    },
    update: {
      seriesId: baseSeries.id,
      lastSyncedAt: new Date()
    },
    create: {
      source: ExternalSource.TMDB,
      entityType: ExternalEntityType.SERIES,
      externalId: series.external.externalId,
      seriesId: baseSeries.id,
      lastSyncedAt: new Date()
    }
  });

  for (const season of series.seasons) {
    const existingSeason = await prisma.season.findUnique({
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
      ? await prisma.season.update({ where: { id: existingSeason.id }, data: seasonData })
      : await prisma.season.create({ data: { seriesId: baseSeries.id, number: season.number, ...seasonData } });

    if (existingSeason) {
      counts.updatedSeasonCount += 1;
    } else {
      counts.importedSeasonCount += 1;
    }

    for (const episode of season.episodes) {
      const existingEpisode = await prisma.episode.findUnique({
        where: { seasonId_number: { seasonId: baseSeason.id, number: episode.number } },
        select: { id: true }
      });

      // Same rationale as Season above: Episode also has two unique constraints,
      // so branch explicitly instead of relying on Prisma's upsert().
      const episodeData = {
        title: episode.title,
        overview: episode.overview,
        stillUrl: null,
        runtimeMinutes: episode.runtimeMinutes || null,
        airedAt: episode.airedOn ? new Date(episode.airedOn) : null,
        externalSource: episode.external ? ExternalSource.TMDB : null,
        externalId: episode.external?.externalId ?? null
      };
      if (existingEpisode) {
        await prisma.episode.update({ where: { id: existingEpisode.id }, data: episodeData });
      } else {
        await prisma.episode.create({ data: { seasonId: baseSeason.id, number: episode.number, ...episodeData } });
      }

      if (existingEpisode) {
        counts.updatedEpisodeCount += 1;
      } else {
        counts.importedEpisodeCount += 1;
      }
    }
  }

  return { series: baseSeries, counts };
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
