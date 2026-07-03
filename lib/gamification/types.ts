import type { AchievementCategory, AchievementRarity } from "@prisma/client";

export type { AchievementCategory, AchievementRarity };

/**
 * One event per real user action that can unlock achievements. Each variant
 * carries only the ids the engine needs to look up the relevant aggregate —
 * never the aggregate itself (that's computed once per event, see engine.ts).
 */
export type GamificationEvent =
  | { type: "EPISODE_WATCHED"; userId: string }
  | { type: "SERIES_COMPLETED"; userId: string; seriesId: string }
  | { type: "REVIEW_CREATED"; userId: string; seriesId: string }
  | { type: "LIST_CREATED"; userId: string; listId: string }
  | { type: "USER_FOLLOWED"; userId: string; followingId: string };

export type GamificationEventType = GamificationEvent["type"];

/**
 * Aggregates available to achievement rules. Built fresh per event by
 * engine.ts — only the fields relevant to that event's category are
 * populated with real numbers; the rest stay at their zero-value default,
 * which is harmless because no rule outside that category runs for this
 * event anyway (see the `triggers` filter in engine.ts).
 */
export type AchievementEvalContext = {
  userId: string;
  episodesWatchedCount: number;
  hoursWatched: number;
  genreEpisodeCounts: Record<string, number>;
  longestStreakDays: number;
  seriesCompletedCount: number;
  reviewsCount: number;
  listsCount: number;
  followingCount: number;
};

export type AchievementDefinition = {
  slug: string;
  name: string;
  description: string;
  /** Symbolic key resolved to an icon component in the UI layer (components/achievements) — never a component reference stored here. */
  icon: string;
  category: AchievementCategory;
  rarity: AchievementRarity;
  points: number;
  hidden: boolean;
  triggers: GamificationEventType[];
  isUnlocked: (context: AchievementEvalContext) => boolean;
};

export type UnlockedAchievementSummary = {
  slug: string;
  name: string;
  description: string;
  icon: string;
  category: AchievementCategory;
  rarity: AchievementRarity;
  points: number;
  unlockedAt: string;
};

export type LockedAchievementSummary = {
  slug: string;
  name: string;
  description: string;
  icon: string;
  category: AchievementCategory;
  rarity: AchievementRarity;
  points: number;
  hidden: boolean;
};

export type LevelProgress = {
  level: number;
  points: number;
  currentLevelThreshold: number;
  nextLevelThreshold: number;
  progressPercent: number;
  pointsToNextLevel: number;
};

export type AchievementsOverview = {
  points: number;
  level: LevelProgress;
  totalAchievements: number;
  unlocked: UnlockedAchievementSummary[];
  locked: LockedAchievementSummary[];
  lastUnlocked: UnlockedAchievementSummary | null;
  nextSuggested: LockedAchievementSummary | null;
};

export type AchievementsOverviewOutcome = { enabled: true; overview: AchievementsOverview } | { enabled: false; overview: null };

export type GamificationAdminSnapshot = {
  totalAchievements: number;
  totalUnlocks: number;
  engineEnabled: boolean;
};
