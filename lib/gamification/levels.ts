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

/**
 * INSERIES-ACHIEVEMENTS-REDESIGN-01 — "os titulos devem aparecer no Hero e no perfil":
 * level is capped at MAX_LEVEL (20) — the ticket's own title bands stop there ("Mestre das
 * Series", niveis 17-20), and with 31 achievements now ranging up to 500 pts each, level 20
 * (9500 pts) already represents months of real usage, matching "o usuario nunca deve sentir
 * que terminou rapidamente".
 */
const MAX_LEVEL = 20;

const LEVEL_TITLE_BANDS: Array<{ min: number; max: number; title: string }> = [
  { min: 1, max: 2, title: "Iniciante" },
  { min: 3, max: 5, title: "Maratonista" },
  { min: 6, max: 8, title: "Especialista" },
  { min: 9, max: 12, title: "Veterano" },
  { min: 13, max: 16, title: "Lenda" },
  { min: 17, max: 20, title: "Mestre das Series" }
];

export function getLevelTitle(level: number): string {
  const band = LEVEL_TITLE_BANDS.find((entry) => level >= entry.min && level <= entry.max);
  return band?.title ?? LEVEL_TITLE_BANDS[LEVEL_TITLE_BANDS.length - 1].title;
}

function thresholdForLevel(level: number): number {
  return POINTS_PER_LEVEL_STEP * ((level * (level - 1)) / 2);
}

export function getLevelProgress(points: number): LevelProgress {
  let level = 1;
  while (level < MAX_LEVEL && thresholdForLevel(level + 1) <= points) {
    level += 1;
  }

  const isMaxLevel = level >= MAX_LEVEL;
  const currentLevelThreshold = thresholdForLevel(level);
  const nextLevelThreshold = isMaxLevel ? currentLevelThreshold : thresholdForLevel(level + 1);
  const span = nextLevelThreshold - currentLevelThreshold;
  const progressPercent = isMaxLevel ? 100 : span > 0 ? Math.round(((points - currentLevelThreshold) / span) * 100) : 100;

  return {
    level,
    title: getLevelTitle(level),
    points,
    currentLevelThreshold,
    nextLevelThreshold,
    progressPercent,
    pointsToNextLevel: isMaxLevel ? 0 : Math.max(0, nextLevelThreshold - points),
    isMaxLevel
  };
}
