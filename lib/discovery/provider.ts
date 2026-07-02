import { searchSeries, type SeriesDiscoveryParams, type SeriesSearchResult } from "@/lib/discovery/search";

/**
 * Contract every search backend must satisfy. Isolates callers (catalog page,
 * calendar, lists, profile, /api/search, future recommendations/admin panel)
 * from the concrete implementation, so a dedicated search engine can be
 * swapped in later without touching call sites.
 */
export type SearchProvider = {
  name: string;
  searchSeries(params: SeriesDiscoveryParams): Promise<SeriesSearchResult>;
};

/** Current implementation: queries Postgres directly via lib/discovery/search.ts. */
export class DatabaseSearchProvider implements SearchProvider {
  name = "database" as const;

  async searchSeries(params: SeriesDiscoveryParams): Promise<SeriesSearchResult> {
    return searchSeries(params);
  }
}

/**
 * Future providers (not implemented this sprint):
 * - MeilisearchProvider: typo-tolerant full-text search, same SearchProvider shape,
 *   would sync from Postgres via the sync jobs already planned in lib/jobs/registry.ts.
 * - ElasticsearchProvider: same contract, for larger-scale/self-hosted deployments.
 * Swapping providers only requires changing `searchProvider` below.
 */
export const searchProvider: SearchProvider = new DatabaseSearchProvider();
