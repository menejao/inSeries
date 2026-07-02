import { prisma } from "@/lib/db/prisma";
import { calculateSeriesProgress } from "@/lib/progress/calculate";

export async function upsertSeriesStatus(userId: string, seriesId: string, state: "WATCHING" | "COMPLETED" | "PAUSED" | "DROPPED" | "WANT_TO_WATCH") {
  const progress = await calculateSeriesProgress(userId, seriesId);

  return prisma.userSeriesStatus.upsert({
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

  return progress;
}
