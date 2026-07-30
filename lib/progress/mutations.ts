import { prisma } from "@/lib/db/prisma";
import { calculateSeriesProgress } from "@/lib/progress/calculate";
import { recordActivity } from "@/lib/social/activity";
import { notifySeriesCompleted } from "@/lib/notifications/events";
import { invalidateRecommendationCache } from "@/lib/recommendations";
import { invalidateStatsCache } from "@/lib/stats";
import { recordGamificationEvent } from "@/lib/gamification";

export async function upsertSeriesStatus(userId: string, seriesId: string, state: "WATCHING" | "COMPLETED" | "PAUSED" | "DROPPED" | "WANT_TO_WATCH") {
  const previous = await prisma.userSeriesStatus.findUnique({
    where: { userId_seriesId: { userId, seriesId } },
    select: { state: true, startedAt: true }
  });

  // Bulk-mark all aired episodes as watched when explicitly setting COMPLETED
  if (state === "COMPLETED") {
    const now = new Date();
    const airedEpisodes = await prisma.episode.findMany({
      where: { season: { seriesId }, OR: [{ airedAt: null }, { airedAt: { lte: now } }] },
      select: { id: true }
    });
    const episodeIds = airedEpisodes.map((e) => e.id);
    if (episodeIds.length > 0) {
      await prisma.$transaction([
        prisma.userEpisodeProgress.updateMany({
          where: { userId, episodeId: { in: episodeIds }, watched: false },
          data: { watched: true, watchedAt: now }
        }),
        prisma.userEpisodeProgress.createMany({
          data: episodeIds.map((episodeId) => ({ userId, episodeId, watched: true, watchedAt: now })),
          skipDuplicates: true
        })
      ]);
    }
  }

  const progress = await calculateSeriesProgress(userId, seriesId);
  const now = new Date();
  const trackingStart = previous?.startedAt ?? (state !== "WANT_TO_WATCH" ? now : null);

  const status = await prisma.userSeriesStatus.upsert({
    where: {
      userId_seriesId: {
        userId,
        seriesId
      }
    },
    update: {
      state,
      completionPercent: progress?.percentage ?? 0,
      lastActivityAt: now,
      completedAt: state === "COMPLETED" ? now : null,
      ...(state === "WATCHING" || state === "COMPLETED" ? { lastWatchedAt: now } : {})
    },
    create: {
      userId,
      seriesId,
      state,
      completionPercent: progress?.percentage ?? 0,
      lastActivityAt: now,
      startedAt: trackingStart,
      completedAt: state === "COMPLETED" ? now : null,
      ...(state === "WATCHING" || state === "COMPLETED" ? { lastWatchedAt: now } : {})
    }
  });

  if (!previous || previous.state !== state) {
    if (state === "COMPLETED" && previous?.state !== "COMPLETED") {
      await recordActivity({
        userId,
        type: "SERIES_COMPLETED",
        seriesId,
        metadata: { from: previous?.state ?? null }
      });
      await notifySeriesCompleted(userId, seriesId);
      await recordGamificationEvent({ type: "SERIES_COMPLETED", userId, seriesId });
    } else if (state !== "COMPLETED") {
      await recordActivity({
        userId,
        type: "SERIES_STATUS_CHANGED",
        seriesId,
        metadata: { from: previous?.state ?? null, to: state }
      });
    }
  }

  invalidateRecommendationCache(userId);
  invalidateStatsCache(userId);

  return status;
}

/**
 * Fase 7 (INSERIES-MY-LISTS-PREMIUM-01) — "Remover" da Minha Lista. Nao havia nenhum jeito
 * de apagar um `UserSeriesStatus` (so criar/atualizar via `upsertSeriesStatus`); esta e a
 * unica peca de CRUD que faltava, nao uma regra de negocio nova. Sem efeito de atividade/
 * gamificacao — remover o status nao e um evento a ser comemorado ou registrado no feed,
 * so a limpeza reversa de um `upsertSeriesStatus` anterior.
 */
export async function removeSeriesStatus(userId: string, seriesId: string) {
  await prisma.userSeriesStatus.deleteMany({ where: { userId, seriesId } });
  invalidateRecommendationCache(userId);
  invalidateStatsCache(userId);
}

export async function toggleEpisodeProgress(userId: string, episodeId: string, watched: boolean) {
  const episode = await prisma.episode.findUnique({
    where: { id: episodeId },
    include: {
      season: {
        select: { seriesId: true }
      }
    }
  });

  if (!episode) {
    return null;
  }

  const previousProgress = await prisma.userEpisodeProgress.findUnique({
    where: { userId_episodeId: { userId, episodeId } },
    select: { watched: true }
  });
  const wasWatched = previousProgress?.watched ?? false;

  await prisma.userEpisodeProgress.upsert({
    where: {
      userId_episodeId: {
        userId,
        episodeId
      }
    },
    update: {
      watched,
      watchedAt: watched ? new Date() : null
    },
    create: {
      userId,
      episodeId,
      watched,
      watchedAt: watched ? new Date() : null
    }
  });

  if (watched && !wasWatched) {
    await recordActivity({
      userId,
      type: "EPISODE_WATCHED",
      seriesId: episode.season.seriesId,
      episodeId
    });
    await recordGamificationEvent({ type: "EPISODE_WATCHED", userId });
  }

  const previousStatus = await prisma.userSeriesStatus.findUnique({
    where: { userId_seriesId: { userId, seriesId: episode.season.seriesId } },
    select: { state: true, startedAt: true }
  });

  const progress = await calculateSeriesProgress(userId, episode.season.seriesId);
  const now = new Date();
  const currentState = previousStatus?.state;

  // State transition rules:
  // - Always promote to COMPLETED when all aired episodes are watched
  // - WANT_TO_WATCH → WATCHING on first episode watch
  // - COMPLETED → WATCHING when unwatching an episode
  // - PAUSED/DROPPED are preserved unless the series becomes COMPLETED
  // - New trackers default to WATCHING
  let inferredState: "WATCHING" | "COMPLETED" | "PAUSED" | "DROPPED" | "WANT_TO_WATCH";
  if (progress?.completed) {
    inferredState = "COMPLETED";
  } else if (!watched && currentState === "COMPLETED") {
    inferredState = "WATCHING";
  } else if (currentState === "PAUSED" || currentState === "DROPPED") {
    inferredState = currentState;
  } else if (!currentState || currentState === "WANT_TO_WATCH") {
    inferredState = "WATCHING";
  } else {
    inferredState = currentState;
  }

  const trackingStart = previousStatus?.startedAt ?? (watched ? now : null);

  await prisma.userSeriesStatus.upsert({
    where: {
      userId_seriesId: {
        userId,
        seriesId: episode.season.seriesId
      }
    },
    update: {
      state: inferredState,
      completionPercent: progress?.percentage ?? 0,
      lastActivityAt: now,
      completedAt: progress?.completed ? now : null,
      ...(watched ? { lastWatchedAt: now } : {})
    },
    create: {
      userId,
      seriesId: episode.season.seriesId,
      state: inferredState,
      completionPercent: progress?.percentage ?? 0,
      lastActivityAt: now,
      startedAt: trackingStart,
      completedAt: progress?.completed ? now : null,
      ...(watched ? { lastWatchedAt: now } : {})
    }
  });

  if (progress?.completed && previousStatus?.state !== "COMPLETED") {
    await recordActivity({
      userId,
      type: "SERIES_COMPLETED",
      seriesId: episode.season.seriesId,
      metadata: { from: previousStatus?.state ?? null }
    });
    await notifySeriesCompleted(userId, episode.season.seriesId);
    await recordGamificationEvent({ type: "SERIES_COMPLETED", userId, seriesId: episode.season.seriesId });
  }

  invalidateRecommendationCache(userId);
  invalidateStatsCache(userId);

  return progress;
}
