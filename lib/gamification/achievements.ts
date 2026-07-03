import type { AchievementDefinition } from "@/lib/gamification/types";
import { atLeast, genreAtLeast } from "@/lib/gamification/milestones";

/**
 * Fase 5 — the 15 initial achievements. This array is the single source of
 * truth: `lib/gamification/service.ts` upserts it into the `Achievement`
 * table by `slug` (idempotent), so adding/tuning an achievement never means
 * touching a migration, only this file.
 *
 * Genre-based achievements match "Comedy"/"Drama"/"Sci-Fi" — the canonical
 * English genre names produced by the real TMDb sync (see
 * lib/catalog/normalize.ts's genreMap) — not the ad-hoc Portuguese
 * "Comedia" used only by scripts/seed-dev.ts's local test fixtures.
 */
export const ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = [
  {
    slug: "first-episode",
    name: "Primeiro Episodio",
    description: "Assista ao seu primeiro episodio.",
    icon: "play",
    category: "WATCHING",
    rarity: "COMMON",
    points: 10,
    hidden: false,
    triggers: ["EPISODE_WATCHED"],
    isUnlocked: atLeast((c) => c.episodesWatchedCount, 1)
  },
  {
    slug: "ten-episodes",
    name: "10 Episodios",
    description: "Assista a 10 episodios.",
    icon: "film",
    category: "WATCHING",
    rarity: "COMMON",
    points: 20,
    hidden: false,
    triggers: ["EPISODE_WATCHED"],
    isUnlocked: atLeast((c) => c.episodesWatchedCount, 10)
  },
  {
    slug: "hundred-episodes",
    name: "100 Episodios",
    description: "Assista a 100 episodios.",
    icon: "film",
    category: "WATCHING",
    rarity: "RARE",
    points: 50,
    hidden: false,
    triggers: ["EPISODE_WATCHED"],
    isUnlocked: atLeast((c) => c.episodesWatchedCount, 100)
  },
  {
    slug: "hundred-hours",
    name: "100 Horas Assistidas",
    description: "Acumule 100 horas assistindo series.",
    icon: "trophy",
    category: "WATCHING",
    rarity: "RARE",
    points: 50,
    hidden: false,
    triggers: ["EPISODE_WATCHED"],
    isUnlocked: atLeast((c) => c.hoursWatched, 100)
  },
  {
    slug: "drama-lover",
    name: "Drama Lover",
    description: "Assista a 10 episodios de series de Drama.",
    icon: "heart",
    category: "SPECIAL",
    rarity: "RARE",
    points: 25,
    hidden: false,
    triggers: ["EPISODE_WATCHED"],
    isUnlocked: genreAtLeast("Drama", 10)
  },
  {
    slug: "comedy-lover",
    name: "Comedy Lover",
    description: "Assista a 10 episodios de series de Comedy.",
    icon: "heart",
    category: "SPECIAL",
    rarity: "RARE",
    points: 25,
    hidden: false,
    triggers: ["EPISODE_WATCHED"],
    isUnlocked: genreAtLeast("Comedy", 10)
  },
  {
    slug: "scifi-lover",
    name: "Sci-Fi Lover",
    description: "Assista a 10 episodios de series de Sci-Fi.",
    icon: "heart",
    category: "SPECIAL",
    rarity: "RARE",
    points: 25,
    hidden: false,
    triggers: ["EPISODE_WATCHED"],
    isUnlocked: genreAtLeast("Sci-Fi", 10)
  },
  {
    slug: "streak-7",
    name: "7 Dias de Sequencia",
    description: "Assista series por 7 dias seguidos.",
    icon: "flame",
    category: "STREAK",
    rarity: "RARE",
    points: 30,
    hidden: false,
    triggers: ["EPISODE_WATCHED"],
    isUnlocked: atLeast((c) => c.longestStreakDays, 7)
  },
  {
    slug: "streak-30",
    name: "30 Dias de Sequencia",
    description: "Assista series por 30 dias seguidos.",
    icon: "flame",
    category: "STREAK",
    rarity: "EPIC",
    points: 100,
    hidden: false,
    triggers: ["EPISODE_WATCHED"],
    isUnlocked: atLeast((c) => c.longestStreakDays, 30)
  },
  {
    slug: "first-series-completed",
    name: "Primeira Serie Concluida",
    description: "Conclua sua primeira serie.",
    icon: "check-circle",
    category: "WATCHING",
    rarity: "COMMON",
    points: 20,
    hidden: false,
    triggers: ["SERIES_COMPLETED"],
    isUnlocked: atLeast((c) => c.seriesCompletedCount, 1)
  },
  {
    slug: "complete-10-series",
    name: "Concluir 10 Series",
    description: "Conclua 10 series.",
    icon: "trophy",
    category: "COLLECTION",
    rarity: "EPIC",
    points: 60,
    hidden: false,
    triggers: ["SERIES_COMPLETED"],
    isUnlocked: atLeast((c) => c.seriesCompletedCount, 10)
  },
  {
    slug: "complete-50-series",
    name: "Concluir 50 Series",
    description: "Conclua 50 series.",
    icon: "trophy",
    category: "COLLECTION",
    rarity: "LEGENDARY",
    points: 150,
    hidden: false,
    triggers: ["SERIES_COMPLETED"],
    isUnlocked: atLeast((c) => c.seriesCompletedCount, 50)
  },
  {
    slug: "first-review",
    name: "Primeira Review",
    description: "Escreva sua primeira review.",
    icon: "star",
    category: "REVIEW",
    rarity: "COMMON",
    points: 10,
    hidden: false,
    triggers: ["REVIEW_CREATED"],
    isUnlocked: atLeast((c) => c.reviewsCount, 1)
  },
  {
    slug: "first-list",
    name: "Primeira Lista",
    description: "Crie sua primeira lista.",
    icon: "list",
    category: "COLLECTION",
    rarity: "COMMON",
    points: 10,
    hidden: false,
    triggers: ["LIST_CREATED"],
    isUnlocked: atLeast((c) => c.listsCount, 1)
  },
  {
    slug: "first-follow",
    name: "Primeiro Follow",
    description: "Siga outro usuario pela primeira vez.",
    icon: "user",
    category: "SOCIAL",
    rarity: "COMMON",
    points: 10,
    hidden: false,
    triggers: ["USER_FOLLOWED"],
    isUnlocked: atLeast((c) => c.followingCount, 1)
  }
];
