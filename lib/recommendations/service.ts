import { config } from "@/lib/config";
import { isFeatureEnabled } from "@/lib/config/flags";
import { computeRecommendations, computeDiscoveryRecommendations } from "@/lib/recommendations/engine";
import { createRecommendationCache } from "@/lib/recommendations/cache";
import {
  incrementRecommendationCacheHit,
  incrementRecommendationCacheMiss,
  incrementRecommendationsGenerated
} from "@/lib/metrics/service";
import type { RecommendationOptions, RecommendationResult } from "@/lib/recommendations/types";

const cache = createRecommendationCache(config.recommendations.cacheTtlSeconds);

/**
 * The single entry point for the recommendation engine — used by the API
 * route, the /me dashboard section, and (read-only) the admin page. Nothing
 * outside this file decides whether to compute, cache, or skip: every
 * caller just gets a `RecommendationResult` back.
 */
export async function getRecommendationsForUser(userId: string, options: RecommendationOptions = {}): Promise<RecommendationResult> {
  if (!isFeatureEnabled("recommendations")) {
    return { generatedAt: new Date().toISOString(), fromCache: false, enabled: false, items: [] };
  }

  const cached = cache.get(userId);
  if (cached) {
    incrementRecommendationCacheHit();
    return { ...cached, fromCache: true };
  }
  incrementRecommendationCacheMiss();

  const items = await computeRecommendations(userId, options);
  incrementRecommendationsGenerated(items.length);

  const result: RecommendationResult = {
    generatedAt: new Date().toISOString(),
    fromCache: false,
    enabled: true,
    items
  };

  cache.set(userId, result);
  return result;
}

/** "Talvez voce goste" (INSERIES-RECOMMENDATION-ENGINE-02) — deliberately not cached with the main result (small, separate query, not worth its own cache key churn on every mutation). */
export async function getDiscoveryRecommendations(userId: string, limit = 10): Promise<RecommendationResult> {
  if (!isFeatureEnabled("recommendations")) {
    return { generatedAt: new Date().toISOString(), fromCache: false, enabled: false, items: [] };
  }
  const items = await computeDiscoveryRecommendations(userId, limit);
  return { generatedAt: new Date().toISOString(), fromCache: false, enabled: true, items };
}

/** Exposed for admin/observability — never used to serve a request's data. */
export function getRecommendationCacheSnapshot() {
  return { ttlSeconds: config.recommendations.cacheTtlSeconds };
}

/**
 * Called by lib/progress/mutations.ts whenever a user's watched episodes or
 * series status change — those are exactly the signals the engine scores
 * against, so a cached result would otherwise keep recommending (or keep
 * excluding) based on stale data until the TTL expires. A pure side-effect,
 * not a scoring change: it never runs the engine, just drops the entry.
 */
export function invalidateRecommendationCache(userId: string) {
  cache.invalidate(userId);
}
