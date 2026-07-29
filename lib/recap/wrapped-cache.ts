import type { WrappedData } from "@/lib/recap/wrapped-types";

/**
 * INSERIES-RECAP-ENGINE-01 — "todo o Recap deve ser pre-processado... durante a apresentacao,
 * nao realizar consultas pesadas." Same globalThis TTL-map pattern as lib/stats/cache.ts,
 * keyed by `userId:year` (a Wrapped for a past year never changes once the year is over, so
 * this effectively becomes permanent for closed years and only really expires for admin
 * previews of the current, still-accumulating year).
 */
type CacheEntry = { data: WrappedData; expiresAt: number };

declare global {
  var __inSeriesWrappedCache: Map<string, CacheEntry> | undefined;
}

const store = globalThis.__inSeriesWrappedCache ?? new Map<string, CacheEntry>();
globalThis.__inSeriesWrappedCache = store;

function cacheKey(userId: string, year: number) {
  return `${userId}:${year}`;
}

export function getCachedWrapped(userId: string, year: number): WrappedData | null {
  const entry = store.get(cacheKey(userId, year));
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    store.delete(cacheKey(userId, year));
    return null;
  }
  return entry.data;
}

export function setCachedWrapped(userId: string, year: number, data: WrappedData, ttlSeconds: number): void {
  store.set(cacheKey(userId, year), { data, expiresAt: Date.now() + ttlSeconds * 1000 });
}

export function invalidateWrappedCache(userId: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(`${userId}:`)) store.delete(key);
  }
}
