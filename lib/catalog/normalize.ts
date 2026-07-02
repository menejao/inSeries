import type { ExternalEntityType, ExternalSource, SeriesLifecycleStatus } from "@prisma/client";
import type { Episode, Season, Series } from "@/lib/types";

export type TmdbListSeriesItem = {
  id: number;
  name: string;
  original_name?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  first_air_date?: string;
  original_language?: string;
  popularity?: number;
  genres?: Array<{ id: number; name: string }>;
  genre_ids?: number[];
  origin_country?: string[];
};

export type TmdbSeriesDetails = TmdbListSeriesItem & {
  genres?: Array<{ id: number; name: string }>;
  number_of_seasons?: number;
  number_of_episodes?: number;
  networks?: Array<{ id: number; name: string }>;
  status?: string;
  seasons?: TmdbSeasonDetails[];
};

export type TmdbSeasonDetails = {
  id: number;
  season_number: number;
  name: string;
  overview?: string;
  poster_path?: string | null;
  air_date?: string;
  episode_count?: number;
  episodes?: TmdbEpisodeDetails[];
};

export type TmdbEpisodeDetails = {
  id: number;
  episode_number: number;
  name: string;
  overview?: string;
  still_path?: string | null;
  runtime?: number | null;
  air_date?: string;
};

export type NormalizedCatalogSeries = Series & {
  external: {
    source: ExternalSource;
    entityType: ExternalEntityType;
    externalId: string;
  };
  seasons: NormalizedCatalogSeason[];
  popularityScore?: number;
};

export type NormalizedCatalogSeason = Season & {
  external?: {
    source: ExternalSource;
    entityType: ExternalEntityType;
    externalId: string;
  };
  episodes: NormalizedCatalogEpisode[];
};

export type NormalizedCatalogEpisode = Episode & {
  external?: {
    source: ExternalSource;
    entityType: ExternalEntityType;
    externalId: string;
  };
};

const imageBaseUrl = "https://image.tmdb.org/t/p";

const genreMap = new Map<number, string>([
  [18, "Drama"],
  [35, "Comedy"],
  [80, "Crime"],
  [9648, "Mystery"],
  [10765, "Sci-Fi"],
  [10759, "Action & Adventure"],
  [99, "Documentary"]
]);

function toImageUrl(path: string | null | undefined, size: "w300" | "w500" | "original") {
  if (!path) return "";
  return `${imageBaseUrl}/${size}${path}`;
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function mapStatus(status?: string): SeriesLifecycleStatus {
  switch (status?.toLowerCase()) {
    case "ended":
      return "ENDED";
    case "canceled":
      return "CANCELED";
    case "in production":
      return "IN_PRODUCTION";
    case "pilot":
      return "PILOT";
    default:
      return "RETURNING";
  }
}

function genresFromPayload(payload: TmdbListSeriesItem | TmdbSeriesDetails) {
  if (payload.genres?.length) {
    return payload.genres.map((genre) => genre.name);
  }

  return payload.genre_ids?.map((id) => genreMap.get(id) ?? `Genre ${id}`) ?? [];
}

export function normalizeTmdbSeries(payload: TmdbSeriesDetails): NormalizedCatalogSeries {
  const seasons = (payload.seasons ?? []).map(normalizeTmdbSeason);

  return {
    id: `tmdb-${payload.id}`,
    slug: slugify(payload.name),
    title: payload.name,
    originalTitle: payload.original_name ?? payload.name,
    year: payload.first_air_date ? Number(payload.first_air_date.slice(0, 4)) : 0,
    status: payload.status ?? "Returning",
    overview: payload.overview ?? "Sinopse indisponivel no momento.",
    genres: genresFromPayload(payload),
    language: payload.original_language?.toUpperCase() ?? "PT-BR",
    platform: payload.networks?.[0]?.name ?? "TMDb",
    popularity: payload.popularity ? payload.popularity.toFixed(0) : "0",
    posterUrl: toImageUrl(payload.poster_path, "w500"),
    backdropUrl: toImageUrl(payload.backdrop_path, "original"),
    seasons,
    popularityScore: payload.popularity,
    external: {
      source: "TMDB",
      entityType: "SERIES",
      externalId: String(payload.id)
    }
  };
}

export function normalizeTmdbSeason(payload: TmdbSeasonDetails): NormalizedCatalogSeason {
  return {
    id: `tmdb-season-${payload.id}`,
    number: payload.season_number,
    title: payload.name,
    year: payload.air_date ? Number(payload.air_date.slice(0, 4)) : 0,
    episodeCount: payload.episode_count ?? payload.episodes?.length ?? 0,
    posterUrl: toImageUrl(payload.poster_path, "w500"),
    overview: payload.overview ?? "",
    episodes: (payload.episodes ?? []).map(normalizeTmdbEpisode),
    external: {
      source: "TMDB",
      entityType: "SEASON",
      externalId: String(payload.id)
    }
  };
}

export function normalizeTmdbEpisode(payload: TmdbEpisodeDetails): NormalizedCatalogEpisode {
  return {
    id: `tmdb-episode-${payload.id}`,
    number: payload.episode_number,
    title: payload.name,
    overview: payload.overview ?? "Sinopse indisponivel.",
    runtimeMinutes: payload.runtime ?? 0,
    airedOn: payload.air_date ?? "",
    watched: false,
    external: {
      source: "TMDB",
      entityType: "EPISODE",
      externalId: String(payload.id)
    }
  };
}

export function normalizeTmdbSeriesList(payload: TmdbListSeriesItem[]): NormalizedCatalogSeries[] {
  return payload.map((item) =>
    normalizeTmdbSeries({
      ...item,
      genres: item.genres,
      status: "Returning",
      seasons: []
    })
  );
}

export function mapStatusToPrisma(status?: string): SeriesLifecycleStatus {
  return mapStatus(status);
}
