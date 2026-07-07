import type { Series } from "@/lib/types";

/**
 * Fase 10 (INSERIES-TRENDING-DISCOVERY-ENGINE-01) — the Hero now gates on the Premium
 * Discovery Score (trending-weighted relevance), not just editorial completeness. A series
 * with a high qualityScore but zero real-world discovery signal (never trending, no
 * streaming presence, obscure) no longer qualifies on that alone. `HERO_MIN_QUALITY_SCORE`
 * is kept as a second-tier fallback for catalogs where the Discovery Engine hasn't run yet
 * (discoveryScore still null everywhere) — so a freshly-seeded/imported catalog isn't stuck
 * with an empty Hero pool.
 */
export const HERO_MIN_DISCOVERY_SCORE = 55;
export const HERO_MIN_QUALITY_SCORE = 55;
export const HERO_POOL_SIZE = 10;

/**
 * The Hero rotates among relevant, high-Discovery-Score series instead of always freezing
 * on the single most popular one. "Relevant" means discoveryScore above the bar; if nothing
 * in the catalog clears it yet (Discovery Engine never ran), falls back to qualityScore,
 * then to plain popularity — never an empty Hero.
 *
 * Kept in its own plain-.ts module (no JSX) so it can be imported both by the Landing page
 * component and directly by the smoke test — importing straight from a .tsx file would drag
 * the whole component tree (and its JSX runtime requirements) into the smoke test's plain
 * Node/tsx execution.
 */
export function pickHero(discoveryPool: Series[], popularPool: Series[]): Series | undefined {
  const byDiscovery = discoveryPool.filter((item) => (item.discoveryScore ?? 0) >= HERO_MIN_DISCOVERY_SCORE);
  const byQuality = byDiscovery.length
    ? []
    : discoveryPool.filter((item) => item.discoveryScore == null && (item.qualityScore ?? 0) >= HERO_MIN_QUALITY_SCORE);
  const pool = byDiscovery.length ? byDiscovery : byQuality.length ? byQuality : popularPool;
  if (!pool.length) return undefined;
  const bucket = Math.floor(Date.now() / (60 * 60 * 1000));
  return pool[bucket % pool.length];
}
