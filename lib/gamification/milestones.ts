import type { AchievementEvalContext } from "@/lib/gamification/types";

/** Reusable metric selectors — paired with a `target` on each `AchievementDefinition` (achievements.ts) to drive both the unlock check and the progress bar from one place. */
export const episodesWatched = (context: AchievementEvalContext) => context.episodesWatchedCount;
export const hoursWatched = (context: AchievementEvalContext) => context.hoursWatched;
export const seriesCompleted = (context: AchievementEvalContext) => context.seriesCompletedCount;
export const reviewsWritten = (context: AchievementEvalContext) => context.reviewsCount;
export const listsCreated = (context: AchievementEvalContext) => context.listsCount;
export const followingCount = (context: AchievementEvalContext) => context.followingCount;
export const streakDays = (context: AchievementEvalContext) => context.longestStreakDays;

/** Same idea, scoped to one genre's episode count (see `genreEpisodeCounts` in the eval context). */
export function genreEpisodes(genre: string) {
  return (context: AchievementEvalContext) => context.genreEpisodeCounts[genre] ?? 0;
}
