import type { CombinedScore } from "@/lib/recommendations/scoring";

const STRONG_SHARE = 0.7;
const MEDIUM_SHARE = 0.2;
// The remaining share (~0.1) comes from the tail — "descobertas": still relevant (same
// exclusions, same eligible pool), just the lower-scored end of it, for variety without
// dropping relevance entirely. Never used to redirect towards low quality.

/**
 * INSERIES-RECOMMENDATION-ENGINE-02 — two rules applied together over the same already-sorted,
 * already-eligible `entries`:
 *
 * 1. "Reservar no maximo 20% pra tendencias": at most `Math.floor(limit * trendingMaxShare)`
 *    of the final list may have "trending" as their top (primary) reason — extras are skipped
 *    over (they can still appear later if some *other* signal also scored them well; this only
 *    stops trending from dominating on its own).
 * 2. "70% forte afinidade / 20% media / 10% descobertas": the surviving pool is split into
 *    thirds by rank (not raw score, since score scale varies a lot user to user) and sampled
 *    proportionally, so the tail of the ranked pool ("descobertas") always gets a small,
 *    guaranteed slice instead of never surfacing past a hard cutoff.
 *
 * The final slice is re-sorted by score — the ratios control *composition*, not *display
 * order*: a user should still see their strongest matches first.
 */
export function applyDiversityMix(entries: CombinedScore[], limit: number, trendingMaxShare: number): CombinedScore[] {
  if (entries.length <= limit) return entries;

  const maxTrending = Math.max(1, Math.floor(limit * trendingMaxShare));
  let trendingUsed = 0;
  const capped: CombinedScore[] = [];
  for (const entry of entries) {
    const isTrendingPrimary = entry.reasons[0]?.provider === "trending";
    if (isTrendingPrimary) {
      if (trendingUsed >= maxTrending) continue;
      trendingUsed += 1;
    }
    capped.push(entry);
  }

  const third = Math.max(1, Math.floor(capped.length / 3));
  const strongPool = capped.slice(0, third);
  const mediumPool = capped.slice(third, third * 2);
  const tailPool = capped.slice(third * 2);

  const strongCount = Math.round(limit * STRONG_SHARE);
  const mediumCount = Math.round(limit * MEDIUM_SHARE);
  const tailCount = Math.max(0, limit - strongCount - mediumCount);

  const picked = new Set<string>();
  const result: CombinedScore[] = [];

  function takeFrom(pool: CombinedScore[], count: number) {
    for (const entry of pool) {
      if (result.length >= limit) break;
      if (picked.has(entry.seriesId)) continue;
      if (count <= 0) break;
      picked.add(entry.seriesId);
      result.push(entry);
      count -= 1;
    }
  }

  takeFrom(strongPool, strongCount);
  takeFrom(mediumPool, mediumCount);
  takeFrom(tailPool, tailCount);

  // Underfilled buckets (small candidate pool) — top up from whatever is left, still capped.
  if (result.length < limit) {
    takeFrom(capped, limit - result.length);
  }

  return result.sort((a, b) => b.score - a.score);
}
