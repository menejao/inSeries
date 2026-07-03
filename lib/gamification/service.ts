import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { isFeatureEnabled } from "@/lib/config/flags";
import { createNotification } from "@/lib/notifications/service";
import { ACHIEVEMENT_DEFINITIONS } from "@/lib/gamification/achievements";
import { getLevelProgress } from "@/lib/gamification/levels";
import type {
  AchievementsOverviewOutcome,
  GamificationAdminSnapshot,
  LockedAchievementSummary,
  UnlockedAchievementSummary
} from "@/lib/gamification/types";

declare global {
  var __inSeriesAchievementsCatalogSeeded: boolean | undefined;
}

/**
 * Idempotent upsert of the code-defined catalog (achievements.ts) into the
 * `Achievement` table, by `slug`. Runs at most once per process — guarded by
 * a globalThis flag, the same pattern lib/rate-limit and lib/metrics use to
 * survive Next dev hot-reload without redoing work. This is what makes the
 * feature work in any environment without a manual seed step.
 */
async function ensureAchievementCatalogSeeded() {
  if (globalThis.__inSeriesAchievementsCatalogSeeded) return;

  await Promise.all(
    ACHIEVEMENT_DEFINITIONS.map((definition) =>
      prisma.achievement.upsert({
        where: { slug: definition.slug },
        update: {
          name: definition.name,
          description: definition.description,
          icon: definition.icon,
          category: definition.category,
          rarity: definition.rarity,
          points: definition.points,
          hidden: definition.hidden
        },
        create: {
          slug: definition.slug,
          name: definition.name,
          description: definition.description,
          icon: definition.icon,
          category: definition.category,
          rarity: definition.rarity,
          points: definition.points,
          hidden: definition.hidden
        }
      })
    )
  );

  globalThis.__inSeriesAchievementsCatalogSeeded = true;
}

/**
 * Idempotent: relies on `UserAchievement`'s `@@unique([userId, achievementId])`
 * so a duplicate call (two events racing for the same achievement) can never
 * create two rows or send two notifications — "uma notificacao por conquista" (Fase 10).
 */
export async function unlockAchievement(userId: string, slug: string, metadata?: Prisma.InputJsonValue) {
  await ensureAchievementCatalogSeeded();

  const achievement = await prisma.achievement.findUnique({ where: { slug } });
  if (!achievement) return null;

  const existing = await prisma.userAchievement.findUnique({
    where: { userId_achievementId: { userId, achievementId: achievement.id } }
  });
  if (existing) return null;

  const unlock = await prisma.userAchievement
    .create({ data: { userId, achievementId: achievement.id, metadata } })
    .catch(() => null);
  if (!unlock) return null;

  await createNotification({
    userId,
    type: "ACHIEVEMENT_UNLOCKED",
    title: "Conquista desbloqueada",
    body: `Voce desbloqueou "${achievement.name}".`,
    href: "/me/achievements",
    achievementId: achievement.id
  });

  return unlock;
}

export async function getAchievementCatalog() {
  await ensureAchievementCatalogSeeded();
  return prisma.achievement.findMany({ orderBy: { points: "asc" } });
}

export async function getUserAchievementsOverview(userId: string): Promise<AchievementsOverviewOutcome> {
  if (!isFeatureEnabled("gamification")) return { enabled: false, overview: null };

  await ensureAchievementCatalogSeeded();

  const [catalog, unlocks] = await Promise.all([
    prisma.achievement.findMany({ orderBy: { points: "asc" } }),
    prisma.userAchievement.findMany({
      where: { userId },
      include: { achievement: true },
      orderBy: { unlockedAt: "desc" }
    })
  ]);

  const unlockedSlugs = new Set(unlocks.map((unlock) => unlock.achievement.slug));
  const points = unlocks.reduce((sum, unlock) => sum + unlock.achievement.points, 0);

  const unlocked: UnlockedAchievementSummary[] = unlocks.map((unlock) => ({
    slug: unlock.achievement.slug,
    name: unlock.achievement.name,
    description: unlock.achievement.description,
    icon: unlock.achievement.icon,
    category: unlock.achievement.category,
    rarity: unlock.achievement.rarity,
    points: unlock.achievement.points,
    unlockedAt: unlock.unlockedAt.toISOString()
  }));

  // Hidden-but-unearned achievements never appear in `locked` — no secret achievements are defined yet, but the filter is ready for one.
  const locked: LockedAchievementSummary[] = catalog
    .filter((achievement) => !unlockedSlugs.has(achievement.slug) && !achievement.hidden)
    .map((achievement) => ({
      slug: achievement.slug,
      name: achievement.name,
      description: achievement.description,
      icon: achievement.icon,
      category: achievement.category,
      rarity: achievement.rarity,
      points: achievement.points,
      hidden: achievement.hidden
    }));

  return {
    enabled: true,
    overview: {
      points,
      level: getLevelProgress(points),
      totalAchievements: catalog.length,
      unlocked,
      locked,
      lastUnlocked: unlocked[0] ?? null,
      nextSuggested: locked[0] ?? null
    }
  };
}

export async function getGamificationAdminSnapshot(): Promise<GamificationAdminSnapshot> {
  await ensureAchievementCatalogSeeded();

  const [totalAchievements, totalUnlocks] = await Promise.all([prisma.achievement.count(), prisma.userAchievement.count()]);

  return {
    totalAchievements,
    totalUnlocks,
    engineEnabled: isFeatureEnabled("gamification")
  };
}
