import type { StatsPageData } from "@/lib/stats/types";

/**
 * INSERIES-STATISTICS-ENGINE-01 — "todas as estatisticas devem utilizar cache inteligente."
 * Same `globalThis` TTL-map pattern as lib/recommendations/cache.ts (survives dev HMR, one
 * instance per process) — invalidated explicitly on episode/status/review/list writes rather
 * than left to expire (see invalidateStatsCache call sites in lib/progress/mutations.ts and
 * lib/social/reviews.ts), so the TTL is a safety net, not the primary freshness mechanism.
 */
type CacheEntry = { data: StatsPageData; expiresAt: number };

declare global {
  var __inSeriesStatsCache: Map<string, CacheEntry> | undefined;
}

const store = globalThis.__inSeriesStatsCache ?? new Map<string, CacheEntry>();
globalThis.__inSeriesStatsCache = store;

export function getCachedStats(userId: string): StatsPageData | null {
  const entry = store.get(userId);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    store.delete(userId);
    return null;
  }
  return entry.data;
}

export function setCachedStats(userId: string, data: StatsPageData, ttlSeconds: number): void {
  store.set(userId, { data, expiresAt: Date.now() + ttlSeconds * 1000 });
}

export function invalidateStatsCache(userId: string): void {
  store.delete(userId);
}
