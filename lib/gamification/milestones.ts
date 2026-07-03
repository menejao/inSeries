import type { AchievementEvalContext } from "@/lib/gamification/types";

/** Reusable "numeric aggregate crossed a threshold" rule — most achievements are exactly this. */
export function atLeast(selector: (context: AchievementEvalContext) => number, threshold: number) {
  return (context: AchievementEvalContext) => selector(context) >= threshold;
}

/** Same idea, scoped to one genre's episode count (see `genreEpisodeCounts` in the eval context). */
export function genreAtLeast(genre: string, threshold: number) {
  return (context: AchievementEvalContext) => (context.genreEpisodeCounts[genre] ?? 0) >= threshold;
}
