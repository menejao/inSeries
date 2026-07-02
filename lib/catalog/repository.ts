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

async function upsertNormalizedSeries(series: NormalizedCatalogSeries) {
  const baseSeries = await prisma.series.upsert({
    where: { slug: series.slug },
    update: {
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
      popularityScore: series.popularityScore ?? null
    },
    create: {
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
      popularityScore: series.popularityScore ?? null
    }
  });

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
    const baseSeason = await prisma.season.upsert({
      where: {
        seriesId_number: {
          seriesId: baseSeries.id,
          number: season.number
        }
      },
      update: {
        title: season.title,
        overview: season.overview || null,
        posterUrl: season.posterUrl || null,
        airYear: season.year || null,
        episodeCount: season.episodeCount,
        externalSource: season.external ? ExternalSource.TMDB : null,
        externalId: season.external?.externalId ?? null
      },
      create: {
        seriesId: baseSeries.id,
        number: season.number,
        title: season.title,
        overview: season.overview || null,
        posterUrl: season.posterUrl || null,
        airYear: season.year || null,
        episodeCount: season.episodeCount,
        externalSource: season.external ? ExternalSource.TMDB : null,
        externalId: season.external?.externalId ?? null
      }
    });

    for (const episode of season.episodes) {
      await prisma.episode.upsert({
        where: {
          seasonId_number: {
            seasonId: baseSeason.id,
            number: episode.number
          }
        },
        update: {
          title: episode.title,
          overview: episode.overview,
          stillUrl: null,
          runtimeMinutes: episode.runtimeMinutes || null,
          airedAt: episode.airedOn ? new Date(episode.airedOn) : null,
          externalSource: episode.external ? ExternalSource.TMDB : null,
          externalId: episode.external?.externalId ?? null
        },
        create: {
          seasonId: baseSeason.id,
          number: episode.number,
          title: episode.title,
          overview: episode.overview,
          stillUrl: null,
          runtimeMinutes: episode.runtimeMinutes || null,
          airedAt: episode.airedOn ? new Date(episode.airedOn) : null,
          externalSource: episode.external ? ExternalSource.TMDB : null,
          externalId: episode.external?.externalId ?? null
        }
      });
    }
  }

  return baseSeries;
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
