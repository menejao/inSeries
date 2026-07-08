import { prisma } from "@/lib/db/prisma";

/**
 * Fase 12 (INSERIES-SERIES-PAGE-PREMIUM-01) — the pure computation `calculateSeriesProgress`
 * always did, extracted so a caller that already has `allEpisodes`/`watchedIds` in hand
 * (e.g. the series detail page, which already fetches both for its own episode list) can
 * get the identical result without `calculateSeriesProgress`'s two queries re-fetching the
 * same series/progress rows a second time. `calculateSeriesProgress` itself is unchanged
 * for every other caller — same signature, same queries, same return shape.
 */
export function computeSeriesProgressFromEpisodes(allEpisodes: Array<{ id: string }>, watchedIds: Set<string>) {
  const totalEpisodes = allEpisodes.length;
  const watchedEpisodes = allEpisodes.filter((episode) => watchedIds.has(episode.id)).length;
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

  return computeSeriesProgressFromEpisodes(allEpisodes, watchedIds);
}
