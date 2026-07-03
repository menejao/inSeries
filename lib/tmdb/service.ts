import { getTmdbBaseUrl, getTmdbCredentials, getTmdbLanguage } from "@/lib/config";
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

async function tmdbFetch<T>(path: string, searchParams?: URLSearchParams): Promise<T> {
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

export async function searchTmdbSeries(query: string, page = 1) {
  const payload = await withLanguageFallback<{ results: TmdbListSeriesItem[] }>(
    "search/tv",
    new URLSearchParams({ query, page: String(page), include_adult: "false" })
  );
  return payload.results;
}

export async function fetchTmdbSeriesDetails(seriesId: string | number) {
  return withLanguageFallback<TmdbSeriesDetails>(`tv/${seriesId}`);
}

export async function fetchTmdbSeasonDetails(seriesId: string | number, seasonNumber: string | number) {
  return withLanguageFallback<TmdbSeasonDetails>(`tv/${seriesId}/season/${seasonNumber}`);
}

export async function fetchTmdbEpisodeDetails(seriesId: string | number, seasonNumber: string | number, episodeNumber: string | number) {
  return withLanguageFallback<TmdbEpisodeDetails>(`tv/${seriesId}/season/${seasonNumber}/episode/${episodeNumber}`);
}
