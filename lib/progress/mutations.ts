import { prisma } from "@/lib/db/prisma";
import { calculateSeriesProgress } from "@/lib/progress/calculate";
import { recordActivity } from "@/lib/social/activity";

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
    } else if (state !== "COMPLETED") {
      await recordActivity({
        userId,
        type: "SERIES_STATUS_CHANGED",
        seriesId,
        metadata: { from: previous?.state ?? null, to: state }
      });
    }
  }

  return status;
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
  }

  return progress;
}
