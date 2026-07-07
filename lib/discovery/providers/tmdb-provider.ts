import { config } from "@/lib/config";
import {
  fetchDiscoverTmdbSeries,
  fetchOnTheAirTmdbSeries,
  fetchPopularTmdbSeries,
  fetchTopRatedTmdbSeries,
  fetchTrendingTmdbSeries
} from "@/lib/tmdb/service";
import type { DiscoveryProvider, DiscoveryProviderOptions, WeightedSourceDefinition } from "@/lib/discovery/providers/types";

const DEFAULT_PAGES = 1;

/**
 * Fase 2/8 — the TMDb implementation of `DiscoveryProvider`. Deliberately only 5 of the 6
 * sources the existing coverage pipeline (lib/catalog/aggregator.ts) knows about — the
 * ticket's Fase 2 weight example omits Airing Today (already folded into "On The Air"
 * territory: both mean "currently airing"). Every fetcher here is the exact, unmodified
 * lib/tmdb/service.ts function the old pipeline already uses — no new TMDb call shape.
 */
export function createTmdbDiscoveryProvider(): DiscoveryProvider {
  return {
    key: "TMDB",
    name: "TMDb Discovery Provider",
    buildWeightedSources(options?: DiscoveryProviderOptions): WeightedSourceDefinition[] {
      const { sourceWeights } = config.discoveryEngine;
      const pages = options?.pages ?? {};

      return [
        {
          key: "TRENDING",
          pages: pages.TRENDING ?? DEFAULT_PAGES,
          weight: sourceWeights.trending,
          fetchPage: (page) => fetchTrendingTmdbSeries(page, "week")
        },
        {
          key: "ON_THE_AIR",
          pages: pages.ON_THE_AIR ?? DEFAULT_PAGES,
          weight: sourceWeights.onTheAir,
          fetchPage: fetchOnTheAirTmdbSeries
        },
        {
          key: "POPULAR_SERIES",
          pages: pages.POPULAR_SERIES ?? DEFAULT_PAGES,
          weight: sourceWeights.popular,
          fetchPage: fetchPopularTmdbSeries
        },
        {
          key: "TOP_RATED",
          pages: pages.TOP_RATED ?? DEFAULT_PAGES,
          weight: sourceWeights.topRated,
          fetchPage: fetchTopRatedTmdbSeries
        },
        {
          key: "DISCOVER",
          pages: pages.DISCOVER ?? DEFAULT_PAGES,
          weight: sourceWeights.discover,
          fetchPage: (page) => fetchDiscoverTmdbSeries({ page, sortBy: "popularity.desc" })
        }
      ];
    }
  };
}
