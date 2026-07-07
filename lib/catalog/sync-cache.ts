/**
 * Fase 7 (INSERIES-TMDB-CATALOG-COVERAGE-01) — an in-memory cache scoped to exactly one
 * sync execution (created fresh at the start, discarded at the end — never persisted,
 * never shared across runs). Memoizes TMDb series-details/season-details/list-page
 * fetches by key, so if more than one part of a single run ever needs the same series'
 * details (e.g. a series discovered fresh this run that's also independently "due" for
 * a cadence-based refresh), the second request is served from memory instead of hitting
 * TMDb again. Deduplication (Fase 3) already prevents most of this by construction —
 * this cache is the defense-in-depth safety net, not the primary mechanism.
 */
export type SyncCacheStats = { hits: number; misses: number };

export type SyncCache = {
  getOrFetchSeriesDetails<T>(tmdbId: string | number, fetcher: () => Promise<T>): Promise<T>;
  getOrFetchSeasonDetails<T>(tmdbId: string | number, seasonNumber: number, fetcher: () => Promise<T>): Promise<T>;
  getOrFetchPage<T>(sourceKey: string, page: number, fetcher: () => Promise<T>): Promise<T>;
  stats(): SyncCacheStats;
};

export function createSyncCache(): SyncCache {
  const seriesDetails = new Map<string, Promise<unknown>>();
  const seasonDetails = new Map<string, Promise<unknown>>();
  const pages = new Map<string, Promise<unknown>>();
  const stats: SyncCacheStats = { hits: 0, misses: 0 };

  function getOrFetch<T>(store: Map<string, Promise<unknown>>, key: string, fetcher: () => Promise<T>): Promise<T> {
    const existing = store.get(key);
    if (existing) {
      stats.hits += 1;
      return existing as Promise<T>;
    }

    stats.misses += 1;
    const promise = fetcher();
    store.set(key, promise);
    // A failed fetch shouldn't poison the cache for the rest of this run — let a later
    // request for the same key try again instead of replaying the same rejection forever.
    promise.catch(() => store.delete(key));
    return promise;
  }

  return {
    getOrFetchSeriesDetails: (tmdbId, fetcher) => getOrFetch(seriesDetails, String(tmdbId), fetcher),
    getOrFetchSeasonDetails: (tmdbId, seasonNumber, fetcher) => getOrFetch(seasonDetails, `${tmdbId}:${seasonNumber}`, fetcher),
    getOrFetchPage: (sourceKey, page, fetcher) => getOrFetch(pages, `${sourceKey}:${page}`, fetcher),
    stats: () => ({ ...stats })
  };
}
