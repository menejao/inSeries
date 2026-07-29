export {
  getRecommendationsForUser,
  getDiscoveryRecommendations,
  getRecommendationCacheSnapshot,
  invalidateRecommendationCache
} from "@/lib/recommendations/service";
export { computeRecommendations, computeDiscoveryRecommendations } from "@/lib/recommendations/engine";
export { RECOMMENDATION_PROVIDERS } from "@/lib/recommendations/providers";
export type * from "@/lib/recommendations/types";
