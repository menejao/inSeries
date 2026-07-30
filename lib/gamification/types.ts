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
 * engine.ts's `buildContextForEvent` — only the fields relevant to that
 * event's category are populated with real numbers, the rest stay at zero
 * (harmless, since no rule outside that category runs for this event — see
 * the `triggers` filter). `buildFullContext` (also engine.ts) populates
 * every field at once, for the Conquistas page's progress bars.
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

/**
 * INSERIES-ACHIEVEMENTS-REDESIGN-01 — `metric`/`target` replace the old opaque `isUnlocked`
 * predicate: the exact same pair of numbers now drives BOTH the unlock check
 * (`metric(ctx) >= target`, see engine.ts) AND the "18/50 series" progress bar on locked
 * achievements — one source of truth instead of a boolean-only rule plus a separate,
 * hand-maintained progress calculation.
 */
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
  metric: (context: AchievementEvalContext) => number;
  target: number;
  /** Short unit label for the progress line, e.g. "series", "episodios", "horas", "dias". */
  unit: string;
};

export type AchievementProgress = { current: number; target: number; unit: string };

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
  progress: AchievementProgress;
};

export type LevelProgress = {
  level: number;
  title: string;
  points: number;
  currentLevelThreshold: number;
  nextLevelThreshold: number;
  progressPercent: number;
  pointsToNextLevel: number;
  isMaxLevel: boolean;
};

export type AchievementsOverview = {
  points: number;
  level: LevelProgress;
  totalAchievements: number;
  unlocked: UnlockedAchievementSummary[];
  locked: LockedAchievementSummary[];
  lastUnlocked: UnlockedAchievementSummary | null;
  /** 3-5 locked achievements closest to unlocking (highest progress ratio first) — "Proximas conquistas". */
  nextAchievements: LockedAchievementSummary[];
  /** Most recently unlocked, capped for the "Recentemente desbloqueadas" section (subset of `unlocked`). */
  recentlyUnlocked: UnlockedAchievementSummary[];
};

export type AchievementsOverviewOutcome = { enabled: true; overview: AchievementsOverview } | { enabled: false; overview: null };

export type GamificationAdminSnapshot = {
  totalAchievements: number;
  totalUnlocks: number;
  engineEnabled: boolean;
};
