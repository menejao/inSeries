import { prisma } from "@/lib/db/prisma";
import { calculateSeriesProgress } from "@/lib/progress/calculate";
import { recordActivity } from "@/lib/social/activity";
import { notifySeriesCompleted } from "@/lib/notifications/events";
import { invalidateRecommendationCache } from "@/lib/recommendations";
import { recordGamificationEvent } from "@/lib/gamification";

export async function upsertSeriesStatus(userId: string, seriesId: string, state: "WATCHING" | "COMPLETED" | "PAUSED" | "DROPPED" | "WANT_TO_WATCH") {
  const previous = await prisma.userSeriesStatus.findUnique({
    where: { userId_seriesId: { userId, seriesId } },
    select: { state: true }
  });

  const progress = await calculateSeriesProgress(userId, seriesId);

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
      lastActivityAt: new Date(),
      completedAt: state === "COMPLETED" ? new Date() : null
    },
    create: {
      userId,
      seriesId,
      state,
      completionPercent: progress?.percentage ?? 0,
      lastActivityAt: new Date(),
      completedAt: state === "COMPLETED" ? new Date() : null
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
    select: { state: true }
  });

  const progress = await calculateSeriesProgress(userId, episode.season.seriesId);
  const inferredState = progress?.completed ? "COMPLETED" : watched ? "WATCHING" : "WATCHING";

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
      lastActivityAt: new Date(),
      completedAt: progress?.completed ? new Date() : null
    },
    create: {
      userId,
      seriesId: episode.season.seriesId,
      state: inferredState,
      completionPercent: progress?.percentage ?? 0,
      lastActivityAt: new Date(),
      completedAt: progress?.completed ? new Date() : null
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

  return progress;
}
