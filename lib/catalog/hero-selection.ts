import type { Series } from "@/lib/types";

/** Fase 2 (INSERIES-CATALOG-INTELLIGENCE-EXPERIENCE-01) — never highlight a low-quality series; below this bar, fall back to plain popularity. */
export const HERO_MIN_QUALITY_SCORE = 55;
export const HERO_POOL_SIZE = 10;

/**
 * The Hero rotates among relevant, high-quality series instead of always freezing on the
 * single most popular one. "Relevant" means qualityScore above the bar; if nothing in the
 * catalog clears it yet (e.g. a fresh catalog with no scored series), falls back to plain
 * popularity so the Hero is never empty. The rotation is hourly (deterministic per request,
 * changes over time) rather than random, so a page reload doesn't flicker between heroes.
 *
 * Kept in its own plain-.ts module (no JSX) so it can be imported both by the Landing page
 * component and directly by the smoke test — importing straight from a .tsx file would drag
 * the whole component tree (and its JSX runtime requirements) into the smoke test's plain
 * Node/tsx execution.
 */
export function pickHero(qualityPool: Series[], popularPool: Series[]): Series | undefined {
  const qualified = qualityPool.filter((item) => (item.qualityScore ?? 0) >= HERO_MIN_QUALITY_SCORE);
  const pool = qualified.length ? qualified : popularPool;
  if (!pool.length) return undefined;
  const bucket = Math.floor(Date.now() / (60 * 60 * 1000));
  return pool[bucket % pool.length];
}
