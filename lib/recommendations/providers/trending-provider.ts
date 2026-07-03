import type { ProviderSignal, RecommendationContext, RecommendationProvider } from "@/lib/recommendations/types";
import { trendingReason } from "@/lib/recommendations/reasons";

const RECENCY_BONUS = 15;

/**
 * The catalog has no real-time trending telemetry (no view counts, no
 * external "trending now" feed) — this is a deterministic proxy: series
 * currently airing (`status: "RETURNING"`), ranked by popularity within
 * that subset, with a small bonus for a first-air year in the last two
 * years. Documented as a proxy (not real trending data) in the README.
 */
export const trendingProvider: RecommendationProvider = {
  id: "trending",
  label: "Em alta (proxy determinístico)",
  run(context: RecommendationContext): ProviderSignal[] {
    const airing = context.candidates.filter((candidate) => candidate.status === "RETURNING");
    if (airing.length === 0) return [];

    const maxPopularity = Math.max(0, ...airing.map((c) => c.popularityScore ?? 0));
    if (maxPopularity <= 0) return [];

    const currentYear = new Date().getUTCFullYear();
    const signals: ProviderSignal[] = [];

    for (const candidate of airing) {
      if (!candidate.popularityScore || candidate.popularityScore <= 0) continue;

      const isRecent = typeof candidate.firstAirYear === "number" && candidate.firstAirYear >= currentYear - 1;
      const score = Math.min(100, Math.round((candidate.popularityScore / maxPopularity) * 100) + (isRecent ? RECENCY_BONUS : 0));

      signals.push({ seriesId: candidate.id, score, reason: trendingReason() });
    }

    return signals;
  }
};
