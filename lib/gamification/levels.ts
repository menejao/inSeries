import type { LevelProgress } from "@/lib/gamification/types";

/**
 * Fase 7 — level progression, purely an indicator over the points already
 * awarded by unlocked achievements. Never alters any existing functionality;
 * points come only from Achievement.points on unlock (lib/gamification/service.ts).
 *
 * Triangular XP curve, centralized here so tuning the pace only ever means
 * changing this one constant: level 1 starts at 0, level 2 at 50, level 3 at
 * 150, level 4 at 300, level 5 at 500 points, etc. (thresholdForLevel(n) =
 * STEP * n*(n-1)/2).
 */
const POINTS_PER_LEVEL_STEP = 50;

function thresholdForLevel(level: number): number {
  return POINTS_PER_LEVEL_STEP * ((level * (level - 1)) / 2);
}

export function getLevelProgress(points: number): LevelProgress {
  let level = 1;
  while (thresholdForLevel(level + 1) <= points) {
    level += 1;
  }

  const currentLevelThreshold = thresholdForLevel(level);
  const nextLevelThreshold = thresholdForLevel(level + 1);
  const span = nextLevelThreshold - currentLevelThreshold;
  const progressPercent = span > 0 ? Math.round(((points - currentLevelThreshold) / span) * 100) : 100;

  return {
    level,
    points,
    currentLevelThreshold,
    nextLevelThreshold,
    progressPercent,
    pointsToNextLevel: Math.max(0, nextLevelThreshold - points)
  };
}
