import { prisma } from "@/lib/db/prisma";

export async function calculateSeriesProgress(userId: string, seriesId: string) {
  const series = await prisma.series.findUnique({
    where: { id: seriesId },
    include: {
      seasons: {
        include: {
          episodes: {
            orderBy: { number: "asc" }
          }
        },
        orderBy: { number: "asc" }
      }
    }
  });

  if (!series) {
    return null;
  }

  const allEpisodes = series.seasons.flatMap((season) => season.episodes);
  const totalEpisodes = allEpisodes.length;

  const watchedProgress = await prisma.userEpisodeProgress.findMany({
    where: {
      userId,
      episodeId: {
        in: allEpisodes.map((episode) => episode.id)
      },
      watched: true
    }
  });

  const watchedIds = new Set(watchedProgress.map((item) => item.episodeId));
  const watchedEpisodes = watchedProgress.length;
  const percentage = totalEpisodes ? Math.round((watchedEpisodes / totalEpisodes) * 100) : 0;
  const nextEpisode = allEpisodes.find((episode) => !watchedIds.has(episode.id)) ?? null;

  return {
    totalEpisodes,
    watchedEpisodes,
    percentage,
    nextEpisode,
    completed: totalEpisodes > 0 && watchedEpisodes === totalEpisodes
  };
}
