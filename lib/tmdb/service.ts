import { getTmdbBaseUrl, getTmdbCredentials, getTmdbLanguage } from "@/lib/config";
import { withTmdbRateLimit } from "@/lib/tmdb/rate-limit";
import type {
  TmdbEpisodeDetails,
  TmdbListSeriesItem,
  TmdbSeasonDetails,
  TmdbSeriesDetails
} from "@/lib/catalog/normalize";

const REQUEST_TIMEOUT_MS = 10_000;

export class TmdbConfigurationError extends Error {}
export class TmdbApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}
export class TmdbTimeoutError extends Error {}

function createHeaders() {
  const credentials = getTmdbCredentials();

  if (!credentials.isConfigured) {
    throw new TmdbConfigurationError("TMDb nao configurado. Defina TMDB_API_KEY ou TMDB_ACCESS_TOKEN.");
  }

  const headers = new Headers({
    accept: "application/json"
  });

  if (credentials.accessToken) {
    headers.set("Authorization", `Bearer ${credentials.accessToken}`);
  }

  return { headers, apiKey: credentials.apiKey };
}

/** Rate-limit-eligible errors always retry; timeouts and 5xx are also worth retrying — auth/not-found/config errors are not. */
function isRateLimitError(error: unknown) {
  return error instanceof TmdbApiError && error.status === 429;
}

function isRetryableError(error: unknown) {
  if (error instanceof TmdbTimeoutError) return true;
  return error instanceof TmdbApiError && error.status >= 500;
}

async function tmdbFetchOnce<T>(path: string, searchParams?: URLSearchParams): Promise<T> {
  const { headers, apiKey } = createHeaders();
  const preferredLanguage = getTmdbLanguage();
  const baseUrl = getTmdbBaseUrl();
  const url = new URL(path, `${baseUrl}/`);

  url.searchParams.set("language", preferredLanguage);
  searchParams?.forEach((value, key) => url.searchParams.set(key, value));
  if (apiKey) {
    url.searchParams.set("api_key", apiKey);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      headers,
      next: { revalidate: 60 * 60 },
      signal: controller.signal
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new TmdbTimeoutError(`TMDb nao respondeu em ${REQUEST_TIMEOUT_MS}ms.`);
    }
    // Network-level failures can carry the request URL (with api_key) in their
    // message/stack; never let that reach logs. Re-throw a sanitized error instead.
    throw new TmdbApiError("Falha de rede ao contatar o TMDb.", 0);
  } finally {
    clearTimeout(timeout);
  }

  if (response.status === 401) {
    throw new TmdbApiError("TMDb rejeitou as credenciais (401). Verifique TMDB_API_KEY/TMDB_ACCESS_TOKEN.", 401);
  }

  if (response.status === 404) {
    throw new TmdbApiError("Recurso nao encontrado no TMDb (404).", 404);
  }

  if (response.status === 429) {
    throw new TmdbApiError("TMDb rate limit atingido. Tente novamente em instantes.", 429);
  }

  if (!response.ok) {
    throw new TmdbApiError(`TMDb respondeu com status ${response.status}.`, response.status);
  }

  return response.json() as Promise<T>;
}

/** Every real HTTP call to TMDb goes through here: concurrency queue, pacing, retry/backoff (Fase 7). */
function tmdbFetch<T>(path: string, searchParams?: URLSearchParams): Promise<T> {
  return withTmdbRateLimit(() => tmdbFetchOnce<T>(path, searchParams), {
    isRateLimit: isRateLimitError,
    isRetryable: isRetryableError
  });
}

async function withLanguageFallback<T>(path: string, searchParams?: URLSearchParams): Promise<T> {
  try {
    return await tmdbFetch<T>(path, searchParams);
  } catch (error) {
    if (error instanceof TmdbConfigurationError || getTmdbLanguage() === "en-US") {
      throw error;
    }

    const fallbackParams = new URLSearchParams(searchParams);
    fallbackParams.set("language", "en-US");
    return tmdbFetch<T>(path, fallbackParams);
  }
}

export async function fetchPopularTmdbSeries(page = 1) {
  const payload = await withLanguageFallback<{ results: TmdbListSeriesItem[] }>("tv/popular", new URLSearchParams({ page: String(page) }));
  return payload.results;
}

export async function fetchTopRatedTmdbSeries(page = 1) {
  const payload = await withLanguageFallback<{ results: TmdbListSeriesItem[] }>("tv/top_rated", new URLSearchParams({ page: String(page) }));
  return payload.results;
}

export async function fetchOnTheAirTmdbSeries(page = 1) {
  const payload = await withLanguageFallback<{ results: TmdbListSeriesItem[] }>("tv/on_the_air", new URLSearchParams({ page: String(page) }));
  return payload.results;
}

export async function fetchAiringTodayTmdbSeries(page = 1) {
  const payload = await withLanguageFallback<{ results: TmdbListSeriesItem[] }>("tv/airing_today", new URLSearchParams({ page: String(page) }));
  return payload.results;
}

/** `window` matches TMDb's own `trending/tv/{day|week}` path segment. */
export async function fetchTrendingTmdbSeries(page = 1, window: "day" | "week" = "week") {
  const payload = await withLanguageFallback<{ results: TmdbListSeriesItem[] }>(
    `trending/tv/${window}`,
    new URLSearchParams({ page: String(page) })
  );
  return payload.results;
}

export type DiscoverTmdbSeriesOptions = {
  page?: number;
  /** TMDb sort_by value, e.g. "popularity.desc", "vote_average.desc", "first_air_date.desc". */
  sortBy?: string;
  voteCountGte?: number;
  firstAirDateGte?: string;
  firstAirDateLte?: string;
  withStatus?: string;
  withOriginalLanguage?: string;
  withOriginCountry?: string;
  withGenres?: string;
};

/** Fase 4 — the flexible Discover TV endpoint, for filters `tv/popular` etc. don't expose (min votes, date range, genre, status, language, country). */
export async function fetchDiscoverTmdbSeries(options: DiscoverTmdbSeriesOptions = {}) {
  const params = new URLSearchParams({ page: String(options.page ?? 1) });
  if (options.sortBy) params.set("sort_by", options.sortBy);
  if (options.voteCountGte !== undefined) params.set("vote_count.gte", String(options.voteCountGte));
  if (options.firstAirDateGte) params.set("first_air_date.gte", options.firstAirDateGte);
  if (options.firstAirDateLte) params.set("first_air_date.lte", options.firstAirDateLte);
  if (options.withStatus) params.set("with_status", options.withStatus);
  if (options.withOriginalLanguage) params.set("with_original_language", options.withOriginalLanguage);
  if (options.withOriginCountry) params.set("with_origin_country", options.withOriginCountry);
  if (options.withGenres) params.set("with_genres", options.withGenres);

  const payload = await withLanguageFallback<{ results: TmdbListSeriesItem[] }>("discover/tv", params);
  return payload.results;
}

export async function searchTmdbSeries(query: string, page = 1) {
  const payload = await withLanguageFallback<{ results: TmdbListSeriesItem[] }>(
    "search/tv",
    new URLSearchParams({ query, page: String(page), include_adult: "false" })
  );
  return payload.results;
}

export async function fetchTmdbSeriesDetails(seriesId: string | number) {
  // append_to_response piggybacks keywords+images (logos)+watch/providers onto the same
  // request — Fase 5/6 (logos/keywords, INSERIES-TMDB-CATALOG-SCALE-01) and Fase 4/11
  // (streaming providers, INSERIES-TMDB-CATALOG-QUALITY-01), all without any extra HTTP call.
  return withLanguageFallback<TmdbSeriesDetails>(
    `tv/${seriesId}`,
    new URLSearchParams({ append_to_response: "keywords,images,watch/providers" })
  );
}

export async function fetchTmdbSeasonDetails(seriesId: string | number, seasonNumber: string | number) {
  return withLanguageFallback<TmdbSeasonDetails>(`tv/${seriesId}/season/${seasonNumber}`);
}

export async function fetchTmdbEpisodeDetails(seriesId: string | number, seasonNumber: string | number, episodeNumber: string | number) {
  return withLanguageFallback<TmdbEpisodeDetails>(`tv/${seriesId}/season/${seasonNumber}/episode/${episodeNumber}`);
}
