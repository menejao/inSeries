import { genreProvider } from "@/lib/recommendations/providers/genre-provider";
import { similarSeriesProvider } from "@/lib/recommendations/providers/similar-series-provider";
import { popularProvider } from "@/lib/recommendations/providers/popular-provider";
import { ratingProvider } from "@/lib/recommendations/providers/rating-provider";
import { trendingProvider } from "@/lib/recommendations/providers/trending-provider";
import { editorialProvider } from "@/lib/recommendations/providers/editorial-provider";
import type { RecommendationProvider } from "@/lib/recommendations/types";

/**
 * Every active provider, in no particular order (the engine scores and
 * combines them independently). Adding a new provider is: implement
 * `RecommendationProvider`, add it here, add its weight in lib/config.
 */
export const RECOMMENDATION_PROVIDERS: RecommendationProvider[] = [
  genreProvider,
  similarSeriesProvider,
  popularProvider,
  ratingProvider,
  trendingProvider,
  editorialProvider
];

export { genreProvider, similarSeriesProvider, popularProvider, ratingProvider, trendingProvider, editorialProvider };
