import { prisma } from "@/lib/db/prisma";
import { recordActivity } from "@/lib/social/activity";
import { invalidateRecommendationCache } from "@/lib/recommendations";
import { invalidateStatsCache } from "@/lib/stats";

/**
 * INSERIES-SERIES-STATUS-ENGINE-01 — "STATUS POR INATIVIDADE": Assistindo -> Pausada
 * automaticamente after `autoPauseInactiveDays` (per user, configuravel em Configuracoes,
 * "Nunca" = null desliga) without a new watched episode. Never touches Concluida (a series
 * with 100% of available episodes watched is never "inactive", per the ticket) and never
 * promotes to Abandonada — that stays a manual, deliberate choice by the user
 * ("regra recomendada": Abandonada por inatividade automatica NAO e o padrao).
 *
 * Runs from the daily cron (app/api/cron/inactivity-check/route.ts). Reuses `completionPercent`
 * (already computed from AVAILABLE episodes only, see lib/progress/calculate.ts) instead of
 * recomputing per row — `state === WATCHING && completionPercent < 100` already means "has at
 * least one available, unwatched episode", exactly the ticket's criterion.
 */
export async function pauseInactiveSeriesForAllUsers(): Promise<{ pausedCount: number }> {
  const candidates = await prisma.userSeriesStatus.findMany({
    where: {
      state: "WATCHING",
      completionPercent: { lt: 100 },
      user: { autoPauseInactiveSeries: true, autoPauseInactiveDays: { not: null } }
    },
    select: { userId: true, seriesId: true, lastActivityAt: true, user: { select: { autoPauseInactiveDays: true } } }
  });

  const now = new Date();
  let pausedCount = 0;

  for (const candidate of candidates) {
    const thresholdDays = candidate.user.autoPauseInactiveDays;
    if (!thresholdDays) continue;

    const inactiveSince = candidate.lastActivityAt ?? now;
    const daysSinceActivity = (now.getTime() - inactiveSince.getTime()) / (24 * 60 * 60 * 1000);
    if (daysSinceActivity < thresholdDays) continue;

    await prisma.userSeriesStatus.update({
      where: { userId_seriesId: { userId: candidate.userId, seriesId: candidate.seriesId } },
      data: { state: "PAUSED" }
    });

    // Marked as automatic so the feed/history can distinguish it from a deliberate manual pause.
    await recordActivity({
      userId: candidate.userId,
      type: "SERIES_STATUS_CHANGED",
      seriesId: candidate.seriesId,
      visibility: "PRIVATE",
      metadata: { from: "WATCHING", to: "PAUSED", automatic: true, reason: "inactivity", inactiveDays: Math.round(daysSinceActivity) }
    });

    invalidateRecommendationCache(candidate.userId);
    invalidateStatsCache(candidate.userId);
    pausedCount += 1;
  }

  return { pausedCount };
}
