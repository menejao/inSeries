import type { CandidateSeries, RecommendationOptions } from "@/lib/recommendations/types";

export type ExclusionSets = {
  completed: Set<string>;
  dropped: Set<string>;
  watchlisted: Set<string>;
  watching: Set<string>;
};

/**
 * Fase 5's filters, applied in one pass. Completed/dropped are always
 * excluded (never configurable — "nunca recomendar series concluidas ou
 * abandonadas" is a hard rule of the engine, not an option). Watchlisted
 * and watching are configurable via `RecommendationOptions`, defaulting to
 * excluded (see types.ts for the reasoning).
 *
 * `admin-hidden` is intentionally not implemented: `Series` has no
 * `hiddenByAdminAt` field today (only `Review`/`List` do). This function is
 * the single place that would gain a `.filter(...)` line for it if that
 * field is ever added — no other part of the engine would need to change.
 */
export function excludeIneligibleSeries(
  candidates: CandidateSeries[],
  exclusions: ExclusionSets,
  options: RecommendationOptions
): CandidateSeries[] {
  const excludeWatchlisted = options.excludeWatchlisted ?? true;
  const excludeWatching = options.excludeWatching ?? true;

  return candidates.filter((candidate) => {
    if (exclusions.completed.has(candidate.id)) return false;
    if (exclusions.dropped.has(candidate.id)) return false;
    if (excludeWatchlisted && exclusions.watchlisted.has(candidate.id)) return false;
    if (excludeWatching && exclusions.watching.has(candidate.id)) return false;
    return true;
  });
}
