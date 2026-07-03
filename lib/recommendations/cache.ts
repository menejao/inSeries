import type { RecommendationResult } from "@/lib/recommendations/types";

/**
 * In-memory TTL cache keyed by userId, same `globalThis` pattern as
 * lib/rate-limit and lib/metrics (survives Next.js dev hot-reload, one
 * instance per process). `RecommendationCache` is an interface so a future
 * Redis-backed implementation can be swapped in at `service.ts` without
 * touching the engine or any call site — see the README for the swap plan.
 */
export interface RecommendationCache {
  get(userId: string): RecommendationResult | null;
  set(userId: string, result: RecommendationResult): void;
  invalidate(userId: string): void;
}

type CacheEntry = { result: RecommendationResult; expiresAt: number };

declare global {
  var __inSeriesRecommendationCache: Map<string, CacheEntry> | undefined;
}

const store = globalThis.__inSeriesRecommendationCache ?? new Map<string, CacheEntry>();
globalThis.__inSeriesRecommendationCache = store;

class InMemoryRecommendationCache implements RecommendationCache {
  constructor(private readonly ttlSeconds: number) {}

  get(userId: string): RecommendationResult | null {
    const entry = store.get(userId);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      store.delete(userId);
      return null;
    }
    return entry.result;
  }

  set(userId: string, result: RecommendationResult): void {
    store.set(userId, { result, expiresAt: Date.now() + this.ttlSeconds * 1000 });
  }

  invalidate(userId: string): void {
    store.delete(userId);
  }
}

export function createRecommendationCache(ttlSeconds: number): RecommendationCache {
  return new InMemoryRecommendationCache(ttlSeconds);
}
