import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { isFeatureEnabled } from "@/lib/config/flags";
import { createNotification } from "@/lib/notifications/service";
import { ACHIEVEMENT_DEFINITIONS } from "@/lib/gamification/achievements";
import { buildFullContext } from "@/lib/gamification/context";
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
    body: `Voce desbloqueou "${achievement.name}" (+${achievement.points} pts).`,
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
  const lockedAchievements = catalog.filter((achievement) => !unlockedSlugs.has(achievement.slug) && !achievement.hidden);

  // INSERIES-ACHIEVEMENTS-REDESIGN-01 — a full aggregate context, only computed when there's
  // at least one locked achievement to show progress for (skips the extra queries entirely
  // for a user who's somehow unlocked everything).
  const context = lockedAchievements.length ? await buildFullContext(userId) : null;
  const definitionBySlug = new Map(ACHIEVEMENT_DEFINITIONS.map((definition) => [definition.slug, definition]));

  const locked: LockedAchievementSummary[] = lockedAchievements.map((achievement) => {
    const definition = definitionBySlug.get(achievement.slug);
    const current = definition && context ? definition.metric(context) : 0;
    const target = definition?.target ?? 1;
    return {
      slug: achievement.slug,
      name: achievement.name,
      description: achievement.description,
      icon: achievement.icon,
      category: achievement.category,
      rarity: achievement.rarity,
      points: achievement.points,
      hidden: achievement.hidden,
      progress: { current: Math.min(current, target), target, unit: definition?.unit ?? "" }
    };
  });

  // "Proximas conquistas": closest to unlocking first (highest progress ratio), ties broken by lowest points (easier next win first).
  const nextAchievements = [...locked]
    .sort((a, b) => b.progress.current / b.progress.target - a.progress.current / a.progress.target || a.points - b.points)
    .slice(0, 5);

  return {
    enabled: true,
    overview: {
      points,
      level: getLevelProgress(points),
      totalAchievements: catalog.length,
      unlocked,
      locked,
      lastUnlocked: unlocked[0] ?? null,
      nextAchievements,
      recentlyUnlocked: unlocked.slice(0, 6)
    }
  };
}

/**
 * INSERIES-ACHIEVEMENTS-REDESIGN-01 — "os titulos devem aparecer no Hero e no perfil":
 * a cheap version of `getUserAchievementsOverview` for the profile header, where only the
 * level/title badge is needed — never runs `buildFullContext` (the analytics dataset fetch +
 * 4 counts that power locked-achievement progress bars), just sums `Achievement.points`.
 */
export async function getUserLevel(userId: string) {
  if (!isFeatureEnabled("gamification")) return null;

  const unlocks = await prisma.userAchievement.findMany({ where: { userId }, select: { achievement: { select: { points: true } } } });
  const points = unlocks.reduce((sum, unlock) => sum + unlock.achievement.points, 0);
  return getLevelProgress(points);
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
