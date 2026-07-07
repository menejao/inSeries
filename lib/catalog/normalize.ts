import type { ExternalEntityType, ExternalSource, SeriesLifecycleStatus } from "@prisma/client";
import { config } from "@/lib/config";
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
  vote_average?: number;
  vote_count?: number;
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
  // Fase 9 (INSERIES-TMDB-CATALOG-SCALE-01) — all returned by the same `tv/{id}` details
  // call already being made (images/keywords via append_to_response, see lib/tmdb/service.ts).
  tagline?: string;
  homepage?: string;
  spoken_languages?: Array<{ english_name?: string; name?: string; iso_639_1?: string }>;
  production_countries?: Array<{ iso_3166_1?: string; name: string }>;
  production_companies?: Array<{ id: number; name: string }>;
  created_by?: Array<{ id: number; name: string }>;
  images?: { logos?: Array<{ file_path?: string | null }> };
  keywords?: { results?: Array<{ id: number; name: string }> };
  // Fase 4/8 (INSERIES-TMDB-CATALOG-QUALITY-01) — `type` (Scripted/Reality/Miniseries/...)
  // and watch/providers both come from the same `tv/{id}` call (append_to_response), never
  // an extra one. TMDb's key is literally "watch/providers" (with the slash).
  type?: string;
  "watch/providers"?: { results?: Record<string, TmdbWatchProviderCountry> };
};

export type TmdbWatchProviderCountry = {
  flatrate?: Array<{ provider_name: string }>;
  free?: Array<{ provider_name: string }>;
  ads?: Array<{ provider_name: string }>;
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
  voteAverage?: number;
  voteCount?: number;
  // Fase 9 — richer catalog metadata, persisted (lib/catalog/repository.ts) but not yet
  // surfaced by the shared `Series` view type/UI. Kept off `Series` itself on purpose,
  // to keep this sprint scoped to the sync pipeline (per the ticket's own restriction).
  tagline?: string;
  homepage?: string;
  originCountry?: string[];
  spokenLanguages?: string[];
  numberOfSeasons?: number;
  numberOfEpisodes?: number;
  networks?: string[];
  productionCountries?: string[];
  productionCompanies?: string[];
  createdBy?: string[];
  logoUrl?: string;
  keywords?: string[];
  // Fase 4/8 (INSERIES-TMDB-CATALOG-QUALITY-01)
  type?: string;
  watchProviders?: string[];
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

/** Fase 4 — union of flatrate/free/ad-supported provider names for the configured region; rent/buy (transactional, not "streaming") are deliberately excluded. */
function extractWatchProviders(payload: TmdbSeriesDetails): string[] | undefined {
  const region = payload["watch/providers"]?.results?.[config.catalogQuality.watchProvidersRegion];
  if (!region) return undefined;

  const names = new Set<string>();
  for (const entry of [...(region.flatrate ?? []), ...(region.free ?? []), ...(region.ads ?? [])]) {
    if (entry.provider_name) names.add(entry.provider_name);
  }
  return names.size ? Array.from(names) : undefined;
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
    voteAverage: payload.vote_average,
    voteCount: payload.vote_count,
    tagline: payload.tagline || undefined,
    homepage: payload.homepage || undefined,
    originCountry: payload.origin_country ?? [],
    spokenLanguages:
      payload.spoken_languages?.map((language) => language.english_name || language.name || language.iso_639_1 || "").filter(Boolean) ?? [],
    numberOfSeasons: payload.number_of_seasons,
    numberOfEpisodes: payload.number_of_episodes,
    networks: payload.networks?.map((network) => network.name) ?? [],
    productionCountries: payload.production_countries?.map((country) => country.name) ?? [],
    productionCompanies: payload.production_companies?.map((company) => company.name) ?? [],
    createdBy: payload.created_by?.map((creator) => creator.name) ?? [],
    logoUrl: toImageUrl(payload.images?.logos?.[0]?.file_path, "w300") || undefined,
    keywords: payload.keywords?.results?.map((keyword) => keyword.name) ?? [],
    watchProviders: extractWatchProviders(payload) ?? [],
    type: payload.type,
    // Computed downstream by lib/catalog/collection-tags.ts (repository.ts, right before
    // persisting) from genres/type/keywords/etc. — never read from here, just satisfies
    // the `Series` base type's required field.
    collectionTags: [],
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
    stillUrl: toImageUrl(payload.still_path, "w300"),
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
